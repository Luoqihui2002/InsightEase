"""Shared H2.1 integrity helpers; arithmetic remains consistency checking only."""
from math import isclose

from pydantic import BaseModel

from app.schemas.evidence import EvidenceBase, MetricDefinition, Quantity, Ref
from app.services.capability_input_service import canonical_hash
from app.services.evidence_definitions import LIMITATIONS, METRICS


class EvidenceError(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def require(condition):
    if not condition:
        raise EvidenceError('RESULT_CONTRACT_INCONSISTENT')


def close(actual, expected, tolerance=1e-10):
    require(actual is not None and expected is not None and isclose(actual, expected, rel_tol=0, abs_tol=tolerance))


def quantity(metric, value):
    return Quantity(definition_ref=METRICS[metric], value=value,
                    unavailable_reason='not_recorded' if value is None else None)


# These fields are sets in the H2 semantic contract. Ranked members, comparison
# baseline/current, decomposition terms and provenance input_refs intentionally
# do not appear here because their order is meaningful.
UNORDERED_SEMANTIC_COLLECTIONS = frozenset({
    'quality_flags', 'quality_summary', 'support_scope', 'cannot_support',
    'dimensions', 'keys', 'ranking_universe', 'ties', 'evidence_refs',
    'omissions', 'evidence', 'field_bindings', 'bindings',
    'normalization_records', 'channel_comparison', 'rankings', 'model_comparison',
})
PRESENTATION_ONLY_FIELDS = frozenset({'label', 'produced_at'})
IDENTITY_FIELDS = frozenset({'evidence_id', 'pack_id', 'content_hash'})


def _sort_semantic_items(items):
    return sorted(items, key=canonical_hash)


def canonicalize_semantic_value(value, field_name=None, *, omit_identity=False):
    """Project data into the centralized H2.1 semantic identity policy."""
    if isinstance(value, BaseModel):
        value = value.model_dump(mode='json')
    if isinstance(value, dict):
        projected = {}
        for key, child in value.items():
            if key in PRESENTATION_ONLY_FIELDS or (omit_identity and key in IDENTITY_FIELDS):
                continue
            projected[key] = canonicalize_semantic_value(child, key, omit_identity=omit_identity)
        return projected
    if isinstance(value, (list, tuple)):
        items = [canonicalize_semantic_value(child, omit_identity=omit_identity) for child in value]
        return _sort_semantic_items(items) if field_name in UNORDERED_SEMANTIC_COLLECTIONS else items
    return value


def collect_semantic_dependencies(value, path='$'):
    """Recursively inventory every versioned semantic definition used by a unit."""
    dependencies = []
    if isinstance(value, MetricDefinition):
        dependencies.append({
            'kind': 'metric_definition', 'path': path, 'id': value.metric_id,
            'version': value.version, 'unit': value.unit, 'formula_id': value.formula_id,
            'lifecycle': value.lifecycle,
        })
    elif isinstance(value, Ref):
        dependencies.append({'kind': 'definition_ref', 'path': path, 'id': value.id, 'version': value.version})
    if isinstance(value, BaseModel):
        for field in type(value).model_fields:
            if field not in {'evidence_id', 'label'}:
                dependencies.extend(collect_semantic_dependencies(getattr(value, field), f'{path}.{field}'))
    elif isinstance(value, dict):
        for key in sorted(value):
            dependencies.extend(collect_semantic_dependencies(value[key], f'{path}.{key}'))
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            dependencies.extend(collect_semantic_dependencies(child, f'{path}[{index}]'))
    return tuple(_sort_semantic_items(dependencies))


def evidence_identity_material(evidence: EvidenceBase):
    """Semantic payload plus a generic recursive dependency fingerprint."""
    return {
        'semantic_content': canonicalize_semantic_value(evidence, omit_identity=True),
        'semantic_dependencies': list(collect_semantic_dependencies(evidence)),
    }


def finalize_evidence(evidence: EvidenceBase):
    return evidence.model_copy(update={'evidence_id': canonical_hash(evidence_identity_material(evidence))})


def evidence_pack_identity_material(content):
    """Pack identity ignores view order and presentation-only text."""
    return canonicalize_semantic_value(content, omit_identity=True)


def common(metric, kind, population, grain, provenance, flags, scope, coverage='complete', dimensions=()):
    definition = METRICS[metric]
    return dict(evidence_id='pending', metric_id=metric, metric_version=definition.version,
                label=definition.label, unit=definition.unit, definition_ref=definition,
                grain=grain, population=population,
                dimensions=tuple(sorted(dimensions, key=lambda item: (item.name, item.value))),
                provenance=provenance, support_taxonomy_ref=Ref(id='evidence-support-taxonomy', version='1'),
                support_scope=tuple(sorted(set(scope))), cannot_support=tuple(sorted(LIMITATIONS)),
                quality_flags=tuple(sorted(set(flags))), computation_coverage=coverage)
