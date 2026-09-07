"""Compile typed goals against trusted, server-loaded data. Never executes writes."""
from dataclasses import dataclass, field
from hashlib import sha256
import json

import pandas as pd

from app.schemas.capability import (
    CapabilityPreflightRequest, ColumnProvenance, CompileOutcome, VersionedDatasetRef,
    ExecutionSpec, FrozenFieldBinding, OperatorParameters,
)
from app.services.capability_registry import CAPABILITIES, CORE_ROLES, GOAL_EVIDENCE, REGISTRY_VERSION
from app.services.conversion_diagnosis_service import DiagnosisError, diagnose_conversion, project_users


def canonical_hash(value) -> str:
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def frame_version(frame: pd.DataFrame) -> str:
    """Version parsed values, column order/types and row order; never export raw data."""
    digest = sha256()
    digest.update(json.dumps([(str(c), str(t)) for c, t in zip(frame.columns, frame.dtypes)]).encode())
    digest.update(pd.util.hash_pandas_object(frame, index=False).values.tobytes())
    return digest.hexdigest()


@dataclass
class AuthoritativeInput:
    """Internal-only adapter output, not accepted in any HTTP/provider schema."""
    dataset_id: str
    frame: pd.DataFrame
    grain: str
    metadata_version: str
    provenance: dict[str, ColumnProvenance] = field(default_factory=dict)
    base_frame: pd.DataFrame | None = None
    base_dataset_id: str | None = None

    @property
    def version(self):
        return canonical_hash({"frame": frame_version(self.frame), "metadata": self.metadata_version})


def compile_candidate(request: CapabilityPreflightRequest, source: AuthoritativeInput) -> CompileOutcome:
    plan, reviewed = request.candidate, request.requirements
    cap = CAPABILITIES.get((plan.capability_ref.capability_id, plan.capability_ref.version))
    if cap is None:
        return CompileOutcome(status="unsupported", code="UNKNOWN_CAPABILITY")
    goals = set(reviewed.business_goal_ids) | set(plan.business_goal_ids)
    evidence = set(reviewed.required_evidence_types) | set(plan.required_evidence_types)
    for goal in goals:
        evidence.update(GOAL_EVIDENCE[goal])
    missing_goals = goals - set(cap.supported_business_goals)
    missing_evidence = evidence - set(cap.output_contract.required_evidence_types)
    if missing_goals or missing_evidence:
        return CompileOutcome(status="unsupported", code="CAPABILITY_OUTPUT_COVERAGE_MISMATCH", missing_goals=tuple(sorted(missing_goals)), missing_evidence=tuple(sorted(missing_evidence)))
    if not set(reviewed.business_goal_ids).issubset(plan.business_goal_ids) or not evidence.issubset(plan.required_evidence_types):
        return CompileOutcome(status="unsupported", code="GOAL_SHRINKING", missing_goals=tuple(sorted(set(reviewed.business_goal_ids)-set(plan.business_goal_ids))), missing_evidence=tuple(sorted(evidence-set(plan.required_evidence_types))))
    if plan.expected_output_contract != cap.output_contract:
        return CompileOutcome(status="unsupported", code="CAPABILITY_OUTPUT_COVERAGE_MISMATCH", missing_evidence=tuple(sorted(set(cap.output_contract.required_evidence_types)-set(plan.expected_output_contract.required_evidence_types))))
    if cap.lifecycle != "enabled":
        return CompileOutcome(status="unsupported", code="LEGACY_MANUAL_ONLY")
    bindings = {b.role: b for b in plan.field_bindings}
    if len(bindings) != len(plan.field_bindings):
        return CompileOutcome(status="data_invalid", code="DUPLICATE_FIELD_ROLE")
    if set(cap.required_field_roles) - bindings.keys():
        return CompileOutcome(status="needs_clarification", code="MISSING_FIELD_ROLE")
    if set(bindings) - set(cap.required_field_roles):
        # Optional cross-check is declared but deliberately not implemented in H1.
        return CompileOutcome(status="unsupported", code="OPTIONAL_ROLE_NOT_IMPLEMENTED")
    if source.grain not in cap.accepted_grains or source.grain != plan.population_spec.grain:
        return CompileOutcome(status="unsupported", code="GRAIN_MISMATCH")
    source_version = source.version
    for binding in plan.field_bindings:
        if binding.dataset_ref.dataset_id != source.dataset_id:
            return CompileOutcome(status="needs_clarification", code="INPUT_DATASET_MISMATCH")
        if binding.dataset_ref.version not in (None, source_version):
            return CompileOutcome(status="stale", code="INPUT_VERSION_CHANGED")
        if binding.column not in source.frame:
            return CompileOutcome(status="needs_clarification", code="UNKNOWN_COLUMN")
        expected = source.provenance.get(binding.column)
        if source.grain == "user_order_detail" and expected is None:
            return CompileOutcome(status="data_invalid", code="UNPROVEN_COLUMN_PROVENANCE")
        if binding.provenance != expected:
            return CompileOutcome(status="data_invalid", code="COLUMN_PROVENANCE_MISMATCH")
    columns = {role: bindings[role].column for role in CORE_ROLES}
    try:
        if source.grain == "user_order_detail":
            if source.base_frame is None or source.base_dataset_id is None:
                raise DiagnosisError("UNPROVEN_BASE_POPULATION")
            base_columns = {r: bindings[r].provenance.source_column for r in CORE_ROLES}
            if any(bindings[r].provenance.source_dataset_id != source.base_dataset_id for r in CORE_ROLES):
                raise DiagnosisError("POPULATION_FIELDS_MUST_ORIGINATE_AT_BASE")
            base = project_users(source.base_frame, base_columns, "unique_user")
            derived = project_users(source.frame, columns, "user_order_detail")
            if not base.equals(derived):
                raise DiagnosisError("BASE_POPULATION_MISMATCH")
        result = diagnose_conversion(source.frame, columns, plan.comparison_spec, source.grain)
    except DiagnosisError as exc:
        return CompileOutcome(status=exc.status, code=exc.code)
    if result.decomposition.coverage.status != "complete":
        return CompileOutcome(status="unsupported", code="CHANNEL_ENTER_EXIT_REQUIRES_POLICY", missing_evidence=("mix_within_decomposition",))
    refs = [VersionedDatasetRef(dataset_id=source.dataset_id, version=source_version)]
    if source.base_frame is not None:
        refs.append(VersionedDatasetRef(dataset_id=source.base_dataset_id, version=frame_version(source.base_frame)))
    frozen_bindings = tuple(FrozenFieldBinding(dataset_ref=refs[0], column=b.column, role=b.role, provenance=b.provenance) for b in plan.field_bindings)
    plan_hash = canonical_hash(request.model_dump(mode="json"))
    metadata_version = canonical_hash({"input": source.metadata_version, "registry": REGISTRY_VERSION, "capability": cap.model_dump(mode="json")})
    spec = ExecutionSpec(
        execution_spec_id=canonical_hash({"plan": plan_hash, "inputs": [r.model_dump() for r in refs], "metadata": metadata_version}),
        capability_ref=plan.capability_ref, operator_ref=cap.deterministic_operator,
        input_refs=tuple(refs), field_bindings=frozen_bindings,
        population_spec=plan.population_spec, comparison_spec=plan.comparison_spec,
        required_output_contract=cap.output_contract, plan_version=plan.plan_version,
        plan_hash=plan_hash, metadata_version=metadata_version, operator_parameters=OperatorParameters(),
    )
    return CompileOutcome(status="ready", code="COMPILED", execution_spec=spec)


def execute_frozen(request: CapabilityPreflightRequest, spec: ExecutionSpec, source: AuthoritativeInput):
    """Recompile against current owned input; client/persisted spec is never trusted."""
    outcome = compile_candidate(request, source)
    if not outcome.executable:
        raise DiagnosisError(outcome.code, outcome.status)
    if spec != outcome.execution_spec:
        raise DiagnosisError("EXECUTION_SPEC_STALE_OR_MODIFIED", "stale")
    return diagnose_conversion(source.frame, {b.role: b.column for b in spec.field_bindings}, spec.comparison_spec, source.grain)
