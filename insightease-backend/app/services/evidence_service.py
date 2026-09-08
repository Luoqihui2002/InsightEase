"""Owned read path. Derive bounded evidence from persisted artifacts without I/O to providers."""
import json
from collections import Counter
from datetime import timezone
from types import MappingProxyType

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from app.models import Analysis
from app.schemas.capability import ConversionDiagnosisResult, ExecutionSpec
from app.schemas.evidence import (EvidencePack, InputRef, Omission, Provenance, Ref, SafeResultSummaryV2)
from app.services.capability_input_service import canonical_hash
from app.services.conversion_diagnosis_evidence_adapter import adapt_conversion
from app.services.attribution_evidence_adapter import adapt_attribution
from app.services.evidence_common import (EvidenceError, canonicalize_semantic_value,
                                          evidence_pack_identity_material, require)

ADAPTERS = MappingProxyType({'ConversionDiagnosisResult@1': adapt_conversion, 'LegacyAttributionResult@1': adapt_attribution})
MAX_PACK_BYTES = 512 * 1024
MAX_SUMMARY_BYTES = 256 * 1024


def _drop_optional_unit(units):
    removable = [i for i, e in enumerate(units)
                 if e.evidence_type == 'ranking' or (e.evidence_type == 'comparison' and e.metric_id == 'channel_cvr_delta_pp')]
    if not removable:
        raise EvidenceError('EVIDENCE_SEMANTIC_UNIT_BUDGET_EXCEEDED')
    units.pop(removable[-1])


def _result_contract(analysis):
    result = analysis.result_data
    if analysis.type == 'conversion_decline_diagnosis' and result.get('schema_version') == 'ConversionDiagnosisResult@1':
        return 'ConversionDiagnosisResult@1'
    if analysis.type == 'attribution' and result.get('schema_version') in (None, 'LegacyAttributionResult@1'):
        return 'LegacyAttributionResult@1'
    raise EvidenceError('EVIDENCE_UNAVAILABLE_UNSUPPORTED_CONTRACT')


def _result_identity_material(contract, result, recorded_version):
    """Select the persisted fields used by an adapter and canonicalize set-like collections."""
    if contract == 'ConversionDiagnosisResult@1':
        payload = result
    else:
        summary = result.get('summary', {})
        payload = {
            'schema_version': result.get('schema_version'),
            'user_journey_count': result.get('user_journey_count'),
            'models': result.get('models'),
            'summary': {
                'avg_touchpoints_per_journey': summary.get('avg_touchpoints_per_journey'),
                'represented_record_count': summary.get('represented_record_count'),
                'represented_user_count': summary.get('represented_user_count'),
                'model_comparison': summary.get('model_comparison'),
            },
        }
    return canonicalize_semantic_value({'result': payload, 'recorded_version': recorded_version})


def _provenance(analysis, contract, spec):
    # Persisted content supplies its own immutable logical version; no DB migration.
    result_version = canonical_hash(_result_identity_material(
        contract, analysis.result_data, getattr(analysis, 'result_version', None)
    ))
    ref = Ref(id=analysis.id, version=result_version)
    if spec:
        fp = spec.authoritative_input_fingerprint
        bindings = sorted((b.model_dump(mode='json') for b in spec.field_bindings),
                          key=lambda item: (item['role'], item['dataset_ref']['dataset_id'], item['column']))
        params = dict(operator_parameters=spec.operator_parameters.model_dump(), population=spec.population_spec.model_dump(),
                      comparison=spec.comparison_spec.model_dump(), bindings=bindings)
        normalization_records = sorted((r.model_dump(mode='json') for r in fp.normalization_records),
                                       key=canonical_hash)
        return Provenance(source_analysis_ref=ref,
            capability_ref=Ref(id=spec.capability_ref.capability_id, version=spec.capability_ref.version),
            operator_ref=Ref(id=spec.operator_ref.operator_id, version=spec.operator_ref.version),
            execution_spec_ref=Ref(id=spec.execution_spec_id, version=spec.version),
            input_refs=tuple(InputRef(dataset_id=r.dataset_id, version=r.version) for r in spec.input_refs),
            authoritative_input_fingerprint_hash=canonical_hash(fp.model_dump(mode='json')),
            normalization_policy_ref=Ref(id=fp.normalization_policy.policy_id, version=fp.normalization_policy.version),
            normalization_policy_hash=canonical_hash(fp.normalization_policy.model_dump(mode='json')),
            normalization_records_hash=canonical_hash(normalization_records),
            parameters_hash=canonical_hash(params), comparison_baseline=spec.comparison_spec.baseline,
            comparison_current=spec.comparison_spec.current, adapter_ref=Ref(id=contract, version='h2-1.1'))
    return Provenance(source_analysis_ref=ref, capability_ref=Ref(id='touchpoint_attribution_legacy', version='1'),
        operator_ref=Ref(id='touchpoint_attribution', version='legacy-1'), execution_spec_ref=None,
        input_refs=(InputRef(dataset_id=analysis.dataset_id, version=None),), authoritative_input_fingerprint_hash=None,
        normalization_policy_ref=None, normalization_policy_hash=None, normalization_records_hash=None,
        parameters_hash=canonical_hash(analysis.params), comparison_baseline=None, comparison_current=None,
        adapter_ref=Ref(id=contract, version='h2-1.1'))


def build_evidence_pack(analysis):
    """Internal-only builder. API always resolves the artifact by authenticated owner."""
    if analysis.status != 'completed' or not isinstance(analysis.result_data, dict) or not analysis.result_data:
        raise EvidenceError('EVIDENCE_RESULT_UNAVAILABLE')
    try:
        contract = _result_contract(analysis)
        spec = None
        result = analysis.result_data
        if contract == 'ConversionDiagnosisResult@1':
            spec = ExecutionSpec.model_validate(analysis.params.get('execution_spec'))
            require(analysis.params.get('expected_execution_spec_id') == spec.execution_spec_id)
            require(analysis.dataset_id == spec.input_refs[0].dataset_id)
            # Strict JSON scalar validation while accepting persisted JSON arrays for tuples.
            result = ConversionDiagnosisResult.model_validate_json(json.dumps(result, allow_nan=False), strict=True)
        provenance = _provenance(analysis, contract, spec)
        units, coverage, flags = ADAPTERS[contract](result, spec if spec else analysis.params, provenance)
        omissions = []
        if len(units) > 32:
            kept = units[:32]
            for kind, total in Counter(e.evidence_type for e in units).items():
                included = sum(e.evidence_type == kind for e in kept)
                if included < total:
                    omissions.append(Omission(reason='evidence_unit_budget', evidence_type=kind, evidence_id=None,
                        included_count=included, total_count=total, selection_policy='required_core_then_channels_then_rankings@1'))
            units = kept
            coverage = coverage.model_copy(update={'transport': 'partial'})
        timestamp = analysis.completed_at or analysis.created_at
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        before_bytes = Counter(e.evidence_type for e in units)
        while True:
            byte_omissions = []
            for kind, total in before_bytes.items():
                included = sum(e.evidence_type == kind for e in units)
                if included < total:
                    byte_omissions.append(Omission(reason='semantic_unit_byte_budget', evidence_type=kind, evidence_id=None,
                        included_count=included, total_count=total, selection_policy='required_core_then_channels_then_rankings@1'))
            all_omissions = omissions + byte_omissions
            if all_omissions:
                coverage = coverage.model_copy(update={'transport': 'partial'})
            content = dict(schema_version='EvidencePack@1', pack_version='1', provenance=provenance.model_dump(mode='json'),
                           coverage=coverage.model_dump(), evidence=[e.model_dump(mode='json') for e in units],
                           omissions=[o.model_dump() for o in all_omissions], quality_summary=list(flags))
            digest = canonical_hash(evidence_pack_identity_material(content))
            pack = EvidencePack(**content, pack_id=digest, content_hash=digest, produced_at=timestamp.isoformat())
            if len(pack.model_dump_json().encode()) <= MAX_PACK_BYTES:
                return pack
            _drop_optional_unit(units)
    except EvidenceError:
        raise
    except (ValidationError, ValueError, TypeError, KeyError, AttributeError) as exc:
        raise EvidenceError('RESULT_CONTRACT_INCONSISTENT') from exc


def build_safe_result_summary_v2(pack: EvidencePack):
    """Semantic projection only; selected items retain their authority IDs and scopes."""
    selected_units = []
    member_omissions = []
    for evidence in pack.evidence:
        selected = evidence
        if evidence.evidence_type == 'ranking' and len(evidence.members) > 20:
            selected = evidence.model_copy(update={'members': evidence.members[:20], 'included_count': 20, 'transport_coverage': 'partial'})
            member_omissions.append(Omission(reason='ranking_member_budget', transport_layer='summary', evidence_type='ranking', evidence_id=evidence.evidence_id,
                                      included_count=20, total_count=len(evidence.members), selection_policy='global_rank_prefix@1'))
        selected_units.append(selected)
    while True:
        buckets = {'metric': [], 'comparison': [], 'ranking': [], 'decomposition': [], 'quality': []}
        for unit in selected_units:
            buckets[unit.evidence_type].append(unit)
        selected_ids = {e.evidence_id for e in selected_units}
        omissions = list(pack.omissions) + [o for o in member_omissions if o.evidence_id in selected_ids]
        for kind, total in Counter(e.evidence_type for e in pack.evidence).items():
            included = len(buckets[kind])
            if included < total:
                omissions.append(Omission(reason='semantic_unit_byte_budget', transport_layer='summary',
                    evidence_type=kind, evidence_id=None, included_count=included, total_count=total,
                    selection_policy='required_core_then_channels_then_rankings@1'))
        coverage = pack.coverage.model_copy(update={'transport': 'partial'}) if omissions else pack.coverage
        summary = SafeResultSummaryV2(pack_ref=Ref(id=pack.pack_id, version=pack.pack_version), pack_content_hash=pack.content_hash,
            analysis_ref=pack.provenance.source_analysis_ref, capability_ref=pack.provenance.capability_ref,
            coverage=coverage, key_metrics=tuple(buckets['metric']), comparisons=tuple(buckets['comparison']),
            rankings=tuple(buckets['ranking']), decompositions=tuple(buckets['decomposition']), quality=tuple(buckets['quality']),
            quality_flags=pack.quality_summary, limitations=tuple(sorted({x for e in pack.evidence for x in e.cannot_support})),
            omissions=tuple(omissions), evidence_refs=tuple(e.evidence_id for e in selected_units))
        if len(summary.model_dump_json().encode()) <= MAX_SUMMARY_BYTES:
            return summary
        # Drop a whole optional unit, never operands, scope or members of required decomposition.
        _drop_optional_unit(selected_units)


async def read_owned_evidence(analysis_id, db, user_id):
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(404, detail={'code': 'ANALYSIS_NOT_FOUND'})
    try:
        return build_evidence_pack(analysis)
    except EvidenceError as exc:
        raise HTTPException(422, detail={'code': exc.code}) from exc
