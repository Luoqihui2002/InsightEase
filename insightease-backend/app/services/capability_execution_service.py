"""Owned Dataset adapter and H1 analysis artifact boundary. No new database schema."""
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from app.models import Dataset
from app.schemas.capability import (
    CapabilityPreflightRequest, ColumnProvenance, Contract, ExecutionSpec, Name,
)
from app.schemas.join import JoinPlan
from app.services.capability_compiler import (
    AuthoritativeInput, canonical_hash, compile_candidate, execute_frozen,
)
from app.services.conversion_diagnosis_service import DiagnosisError
from app.services.dataset_io_service import load_dataset_dataframe

ANALYSIS_TYPE = "conversion_decline_diagnosis"


class CapabilityRunParams(Contract):
    request: CapabilityPreflightRequest
    expected_execution_spec_id: Name


class CapabilityArtifactParams(CapabilityRunParams):
    execution_spec: ExecutionSpec


async def _owned(dataset_id, db, user_id):
    result = await db.execute(select(Dataset).where(
        Dataset.id == dataset_id, Dataset.user_id == user_id, Dataset.is_deleted == False,
    ))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(404, detail="数据集不存在")
    return dataset


async def load_authoritative_input(dataset_id: str, db, user_id: str) -> AuthoritativeInput:
    dataset = await _owned(dataset_id, db, user_id)
    frame = await load_dataset_dataframe(dataset)
    metadata = {
        "dataset_id": dataset.id, "schema": dataset.schema,
        "derivation_type": dataset.derivation_type,
        "derivation_plan": dataset.derivation_plan,
        "parent_dataset_id": dataset.parent_dataset_id,
        "source_dataset_ids": dataset.source_dataset_ids,
    }
    source = AuthoritativeInput(dataset.id, frame, "unique_user", canonical_hash(metadata))
    if dataset.derivation_type == "join":
        try:
            plan = JoinPlan.model_validate(dataset.derivation_plan)
        except ValidationError as exc:
            raise DiagnosisError("INVALID_SAVED_JOIN_LINEAGE") from exc
        if any(s.join_type != "left" for s in plan.join_steps):
            raise DiagnosisError("POPULATION_REQUIRES_LEFT_JOIN")
        if dataset.parent_dataset_id != plan.base_dataset_id or set(dataset.source_dataset_ids or ()) != set(plan.included_dataset_ids):
            raise DiagnosisError("INVALID_SAVED_JOIN_LINEAGE")
        base = await _owned(plan.base_dataset_id, db, user_id)
        if base.parent_dataset_id or base.derivation_type or base.transform_chain:
            raise DiagnosisError("NESTED_POPULATION_LINEAGE_UNSUPPORTED", "unsupported")
        source.grain = "user_order_detail"
        source.base_dataset_id = base.id
        source.base_frame = await load_dataset_dataframe(base)
        # P0C preserves base column names. Right columns are deliberately not
        # accepted as population attributes; no guessing from collision prefixes.
        fields = set(plan.selected_fields.get(base.id, ()))
        fields.update(s.left_field for s in plan.join_steps if s.left_dataset_id == base.id)
        source.provenance = {c: ColumnProvenance(source_dataset_id=base.id, source_column=c) for c in fields if c in source.frame and c in source.base_frame}
    elif dataset.parent_dataset_id or dataset.derivation_type or dataset.transform_chain:
        raise DiagnosisError("UNSUPPORTED_POPULATION_LINEAGE", "unsupported")
    return source


def request_dataset_id(request: CapabilityPreflightRequest) -> str:
    ids = {b.dataset_ref.dataset_id for b in request.candidate.field_bindings}
    if len(ids) != 1:
        raise DiagnosisError("ONE_POPULATION_DATASET_REQUIRED", "needs_clarification")
    return next(iter(ids))


async def preflight_owned(request, db, user_id):
    from app.schemas.capability import CompileOutcome

    try:
        source = await load_authoritative_input(request_dataset_id(request), db, user_id)
        return compile_candidate(request, source)
    except DiagnosisError as exc:
        return CompileOutcome(status=exc.status, code=exc.code)


async def prepare_capability_run(dataset_id, params, db, user_id):
    """Validate before inserting Analysis; cannot submit an executable spec directly."""
    try:
        run = CapabilityRunParams.model_validate(params)
    except ValidationError as exc:
        raise HTTPException(422, detail={"code": "INVALID_CAPABILITY_RUN_PARAMS"}) from exc
    try:
        if request_dataset_id(run.request) != dataset_id:
            raise DiagnosisError("INPUT_DATASET_MISMATCH")
        outcome = await preflight_owned(run.request, db, user_id)
        if not outcome.executable:
            raise HTTPException(422, detail=outcome.model_dump(mode="json"))
        if outcome.execution_spec.execution_spec_id != run.expected_execution_spec_id:
            raise HTTPException(409, detail={"code": "EXECUTION_SPEC_CHANGED_REVIEW_REQUIRED"})
        return CapabilityArtifactParams(**run.model_dump(), execution_spec=outcome.execution_spec).model_dump(mode="json")
    except DiagnosisError as exc:
        raise HTTPException(422, detail={"status": exc.status, "code": exc.code}) from exc


async def execute_capability_artifact(dataset_id, params, db, user_id):
    try:
        artifact = CapabilityArtifactParams.model_validate(params)
    except ValidationError as exc:
        raise DiagnosisError("INVALID_SAVED_EXECUTION_SPEC") from exc
    if request_dataset_id(artifact.request) != dataset_id:
        raise DiagnosisError("INPUT_DATASET_MISMATCH")
    if artifact.expected_execution_spec_id != artifact.execution_spec.execution_spec_id:
        raise DiagnosisError("EXECUTION_SPEC_STALE_OR_MODIFIED", "stale")
    source = await load_authoritative_input(dataset_id, db, user_id)
    return execute_frozen(artifact.request, artifact.execution_spec, source).model_dump(mode="json")
