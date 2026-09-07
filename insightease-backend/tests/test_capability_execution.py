"""H1 offline golden, metamorphic, compiler and artifact boundary verification."""
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest
from fastapi import HTTPException, BackgroundTasks
from pydantic import ValidationError

from app.schemas.capability import (
    CapabilityPreflightRequest, ColumnProvenance, ComparisonSpec, ExecutionSpec,
)
from app.services.capability_registry import CAPABILITIES, CORE_EVIDENCE, CORE_OUTPUT, CORE_ROLES
from app.services.capability_compiler import AuthoritativeInput, compile_candidate, execute_frozen
from app.services.conversion_diagnosis_service import DiagnosisError, diagnose_conversion
from app.services import capability_execution_service as boundary

DATA = Path(__file__).resolve().parents[2] / "manual-test-data/demo-v1"
COLUMNS = dict(zip(CORE_ROLES, ("user_id", "converted", "cohort_period", "acquisition_channel")))
PERIODS = ComparisonSpec(baseline="previous_month", current="recent_month")


@pytest.fixture
def users():
    return pd.read_csv(DATA / "users.csv")


def request(grain="unique_user"):
    return CapabilityPreflightRequest.model_validate({
        "candidate": {
            "schema_version": "candidate-plan@2", "plan_id": "p1", "plan_version": 1,
            "user_question": "Compare cohort conversion decline and channels",
            "capability_ref": {"capability_id": "conversion_decline_diagnosis", "version": "1"},
            "business_goal_ids": ["conversion_decline", "channel_diagnosis"],
            "required_evidence_types": list(CORE_EVIDENCE),
            "field_bindings": [{"dataset_ref": {"dataset_id": "users", "version": None}, "column": column, "role": role, "provenance": None} for role, column in COLUMNS.items()],
            "population_spec": {"grain": grain, "entity_role": "entity_id", "scope": "all_input_users_in_selected_cohorts", "conversion_policy": "binary_required_missing_invalid"},
            "comparison_spec": PERIODS.model_dump(), "expected_output_contract": CORE_OUTPUT.model_dump(),
        },
        "requirements": {"business_goal_ids": ["conversion_decline", "channel_diagnosis"], "required_evidence_types": list(CORE_EVIDENCE)},
    })


def source(users, grain="unique_user"):
    return AuthoritativeInput("users", users, grain, "metadata-1")


def run(users, grain="unique_user"):
    return diagnose_conversion(users, COLUMNS, PERIODS, grain)


def business(result):
    return result.model_dump(exclude={"input_grain_summary"})


def test_demo_golden_and_independent_channel_oracle(users):
    result = run(users)
    b, c = result.overall_comparison.baseline, result.overall_comparison.current
    assert (b.user_count, b.converted_user_count, b.cvr) == (1000, 240, .24)
    assert (c.user_count, c.converted_user_count, c.cvr) == (1000, 188, .188)
    assert result.overall_comparison.cvr_delta_pp == pytest.approx(-5.2)
    assert result.decomposition.mix_effect_pp == pytest.approx(-2.56)
    assert result.decomposition.within_effect_pp == pytest.approx(-2.64)
    assert result.decomposition.reconciliation_residual_pp == pytest.approx(0, abs=1e-10)
    # Independent oracle from raw committed users, not the production recipe.
    table = users.groupby(["cohort_period", "acquisition_channel"])["converted"].agg(["size", "sum", "mean"])
    for row in result.channel_comparison:
        for actual, period in ((row.baseline, PERIODS.baseline), (row.current, PERIODS.current)):
            oracle = table.loc[(period, row.channel)]
            assert actual.user_count == oracle["size"]
            assert actual.converted_user_count == oracle["sum"]
            assert actual.cvr == oracle["mean"]
            assert actual.share == oracle["size"] / 1000
    assert result.optional_branches.funnel.status == "not_requested"
    assert result.coverage.status == "complete"
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


def test_row_order_invariant(users):
    assert run(users) == run(users.sample(frac=1, random_state=43))


def test_order_fanout_and_validated_projection(users):
    orders = pd.read_csv(DATA / "orders.csv")
    joined = users.merge(orders[["user_id", "order_id"]], on="user_id", how="left")
    assert len(joined) == 2054
    expanded = pd.concat([joined, joined.iloc[[0, 0, 0]]], ignore_index=True)
    assert business(run(users)) == business(run(joined, "user_order_detail")) == business(run(expanded, "user_order_detail"))
    result = run(expanded, "user_order_detail")
    assert result.input_grain_summary.unique_users == 2000
    assert result.input_grain_summary.projection == "validated_user_projection"


def test_clone_ids_double_counts_not_rates(users):
    clone = users.copy()
    clone["user_id"] += "-clone"
    result = run(pd.concat([users, clone]))
    assert result.overall_comparison.baseline.user_count == 2000
    assert result.overall_comparison.baseline.converted_user_count == 480
    assert result.overall_comparison.current.converted_user_count == 376
    assert result.overall_comparison.cvr_delta_pp == pytest.approx(-5.2)
    assert result.decomposition.mix_effect_pp == pytest.approx(-2.56)
    assert result.decomposition.within_effect_pp == pytest.approx(-2.64)


def test_identical_period_populations_are_zero(users):
    previous = users[users.cohort_period == "previous_month"].copy()
    recent = previous.copy()
    recent["cohort_period"] = "recent_month"
    recent["user_id"] += "-new"
    result = run(pd.concat([previous, recent]))
    assert result.overall_comparison.cvr_delta_pp == 0
    assert result.decomposition.mix_effect_pp == 0
    assert result.decomposition.within_effect_pp == 0
    for ranking in result.rankings:
        assert all(item.rank == 1 and len(item.ties) == 5 for item in ranking.items)


def test_metric_specific_ranking_changes_with_data(users):
    original = run(users)
    by_metric = {r.ranking_metric: r for r in original.rankings}
    assert by_metric["channel_cvr_delta"].items[0].channel == "social_ads"
    assert by_metric["conversion_count_delta"].items[0].channel == "organic"
    assert by_metric["mix_effect_pp"].items[0].channel == "organic"
    assert by_metric["within_effect_pp"].items[0].channel == "social_ads"
    users.loc[(users.cohort_period == "recent_month") & (users.acquisition_channel == "organic"), "converted"] = 0
    rankings = {r.ranking_metric: r for r in run(users).rankings}
    assert rankings["channel_cvr_delta"].items[0].channel == "organic"
    assert rankings["within_effect_pp"].items[0].channel == "organic"
    assert all(r.direction == "ascending" and r.coverage.status == "complete" and len(r.ranking_universe) == 5 for r in rankings.values())


def test_channel_rename_preserves_math(users):
    original = run(users)
    users["acquisition_channel"] = users.acquisition_channel.replace({"social_ads": "arbitrary-new-channel"})
    renamed = run(users)
    assert renamed.overall_comparison == original.overall_comparison
    assert renamed.decomposition == original.decomposition
    assert renamed.rankings[0].items[0].channel == "arbitrary-new-channel"


@pytest.mark.parametrize("column,value", [("converted", 0), ("cohort_period", "recent_month"), ("acquisition_channel", "different-channel")])
def test_conflicting_user_attributes_block(users, column, value):
    # Select a converted baseline user so each parameter definitely conflicts.
    duplicate = users[(users.converted == 1) & (users.cohort_period == "previous_month")].iloc[[0]].copy()
    duplicate[column] = value
    with pytest.raises(DiagnosisError, match="CONFLICTING_USER_ATTRIBUTES"):
        run(pd.concat([users, duplicate]), "user_order_detail")


@pytest.mark.parametrize("period", ["previous_month", "recent_month", "all"])
def test_empty_population(users, period):
    empty = users.iloc[:0] if period == "all" else users[users.cohort_period != period]
    outcome = compile_candidate(request(), source(empty))
    assert not outcome.executable and outcome.code == "INSUFFICIENT_POPULATION"
    assert outcome.status == "data_invalid"


@pytest.mark.parametrize("value", [None, 2, -1, "1", "true", float("inf")])
def test_invalid_conversion(users, value):
    users["converted"] = users.converted.astype(object)
    users.loc[0, "converted"] = value
    assert compile_candidate(request(), source(users)).status == "data_invalid"


def test_boolean_conversion_and_unknown_channel_are_preserved(users):
    users["converted"] = users.converted.astype(bool)
    users["acquisition_channel"] = users.acquisition_channel.replace({"social_ads": "unknown"})
    assert run(users).overall_comparison.cvr_delta_pp == pytest.approx(-5.2)


def test_enter_exit_not_zero_filled_or_compiled_as_complete(users):
    users.loc[(users.cohort_period == "recent_month") & (users.acquisition_channel == "social_ads"), "acquisition_channel"] = "new_channel"
    result = run(users)
    assert result.overall_comparison.cvr_delta_pp == pytest.approx(-5.2)
    assert result.decomposition.coverage.status == "unavailable"
    assert result.decomposition.coverage.reason == "channel_enter_exit_requires_policy"
    assert result.decomposition.mix_effect_pp is None
    assert result.decomposition.within_effect_pp is None
    new = next(r for r in result.channel_comparison if r.channel == "new_channel")
    assert new.baseline is None and new.channel_cvr_delta is None
    assert result.rankings[0].coverage.status == "partial"
    outcome = compile_candidate(request(), source(users))
    assert not outcome.executable and outcome.missing_evidence == ("mix_within_decomposition",)


def test_candidate_compile_freeze_and_execute(users):
    candidate, data = request(), source(users)
    assert "executable" not in candidate.candidate.model_dump()
    outcome = compile_candidate(candidate, data)
    assert outcome.executable
    spec = outcome.execution_spec
    assert all(r.version for r in spec.input_refs)
    assert spec.operator_parameters.formula == "baseline_rate_mix_current_share_within@1"
    assert spec == ExecutionSpec.model_validate_json(spec.model_dump_json())
    assert execute_frozen(candidate, spec, data) == run(users)
    with pytest.raises(ValidationError):
        spec.comparison_spec.current = "made-up"
    data.frame = data.frame.iloc[::-1]
    with pytest.raises(DiagnosisError, match="EXECUTION_SPEC_STALE_OR_MODIFIED"):
        execute_frozen(candidate, spec, data)


def test_static_registry_is_small_frozen_and_legacy_honest():
    assert len(CAPABILITIES) == 2
    with pytest.raises(TypeError):
        CAPABILITIES[("fake", "999")] = None
    legacy = CAPABILITIES[("touchpoint_attribution_legacy", "1")]
    assert legacy.lifecycle == "legacy_limited"
    assert "represented_record_mean" in legacy.supported_metrics
    assert "behavioral_touchpoint_mean" in legacy.unsupported_claims
    assert "cohort_cvr_decline" in legacy.unsupported_claims


@pytest.mark.parametrize("capability,version,code", [("touchpoint_attribution_legacy", "1", "CAPABILITY_OUTPUT_COVERAGE_MISMATCH"), ("causal_marketing_optimizer", "999", "UNKNOWN_CAPABILITY")])
def test_wrong_capability_with_valid_columns(users, capability, version, code):
    raw = request().model_dump(mode="json")
    raw["candidate"]["capability_ref"] = {"capability_id": capability, "version": version}
    outcome = compile_candidate(CapabilityPreflightRequest.model_validate(raw), source(users))
    assert not outcome.executable and outcome.code == code


@pytest.mark.parametrize("role", ["conversion_flag", "cohort", "entity_id", "acquisition_channel"])
def test_missing_role_needs_clarification(users, role):
    raw = request().model_dump(mode="json")
    raw["candidate"]["field_bindings"] = [b for b in raw["candidate"]["field_bindings"] if b["role"] != role]
    outcome = compile_candidate(CapabilityPreflightRequest.model_validate(raw), source(users))
    assert outcome.status == "needs_clarification" and not outcome.executable


@pytest.mark.parametrize("key,value", [("formula", "custom expression"), ("sql", "select 1"), ("python_code", "print(1)"), ("module_path", "evil.module"), ("executable", True)])
def test_provider_cannot_supply_execution_instructions(key, value):
    raw = request().model_dump(mode="json")
    raw["candidate"][key] = value
    with pytest.raises(ValidationError):
        CapabilityPreflightRequest.model_validate(raw)


@pytest.mark.parametrize("mutation,code", [
    ("shrink", "GOAL_SHRINKING"), ("output", "CAPABILITY_OUTPUT_COVERAGE_MISMATCH"),
    ("grain", "GRAIN_MISMATCH"), ("column", "UNKNOWN_COLUMN"), ("version", "INPUT_VERSION_CHANGED"),
    ("alias", "INSUFFICIENT_POPULATION"), ("same", "COHORTS_NOT_DISJOINT"),
    ("funnel", "CAPABILITY_OUTPUT_COVERAGE_MISMATCH"), ("causal", "CAPABILITY_OUTPUT_COVERAGE_MISMATCH"),
])
def test_compiler_negative_contracts(users, mutation, code):
    raw = request().model_dump(mode="json")
    p = raw["candidate"]
    if mutation == "shrink":
        p["business_goal_ids"] = ["cohort_cvr_comparison"]
        p["required_evidence_types"] = ["cohort_cvr_comparison"]
    elif mutation == "output":
        p["expected_output_contract"]["required_evidence_types"] = ["cohort_cvr_comparison"]
    elif mutation == "grain":
        p["population_spec"]["grain"] = "represented_record"
    elif mutation == "column":
        p["field_bindings"][0]["column"] = "hallucinated"
    elif mutation == "version":
        p["field_bindings"][0]["dataset_ref"]["version"] = "old"
    elif mutation == "alias":
        p["comparison_spec"]["current"] = "current_month"
    elif mutation == "same":
        p["comparison_spec"]["current"] = "previous_month"
    elif mutation == "funnel":
        raw["requirements"]["business_goal_ids"].append("funnel_diagnosis")
    elif mutation == "causal":
        raw["requirements"]["business_goal_ids"].append("causal_channel_effect")
    outcome = compile_candidate(CapabilityPreflightRequest.model_validate(raw), source(users))
    assert not outcome.executable and outcome.code == code


def derived_request_source(users):
    raw = request("user_order_detail").model_dump(mode="json")
    provenance = {c: ColumnProvenance(source_dataset_id="base", source_column=c) for c in COLUMNS.values()}
    for b in raw["candidate"]["field_bindings"]:
        b["provenance"] = provenance[b["column"]].model_dump()
    joined = users.merge(pd.read_csv(DATA / "orders.csv")[["user_id", "order_id"]], how="left", on="user_id")
    data = AuthoritativeInput("users", joined, "user_order_detail", "saved-left-join", provenance, users, "base")
    return CapabilityPreflightRequest.model_validate(raw), data


def test_derived_provenance_and_full_population(users):
    candidate, data = derived_request_source(users)
    outcome = compile_candidate(candidate, data)
    assert outcome.executable and len(outcome.execution_spec.input_refs) == 2
    assert outcome.execution_spec.field_bindings[0].provenance.source_dataset_id == "base"
    data.frame = data.frame[data.frame.user_id != data.frame.user_id.iloc[0]]
    assert compile_candidate(candidate, data).code == "BASE_POPULATION_MISMATCH"


def test_derived_missing_provenance_and_changed_base(users):
    candidate, data = derived_request_source(users)
    spec = compile_candidate(candidate, data).execution_spec
    data.base_frame = data.base_frame.copy()
    data.base_frame.loc[0, "converted"] = 1 - data.base_frame.loc[0, "converted"]
    with pytest.raises(DiagnosisError, match="BASE_POPULATION_MISMATCH"):
        execute_frozen(candidate, spec, data)
    data.provenance.clear()
    assert compile_candidate(candidate, data).code == "UNPROVEN_COLUMN_PROVENANCE"


def test_owned_adapter_queries_owner_and_rejects_missing():
    class DB:
        async def execute(self, statement):
            sql = str(statement)
            assert "datasets.user_id" in sql and "datasets.is_deleted" in sql
            return SimpleNamespace(scalar_one_or_none=lambda: None)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(boundary.load_authoritative_input("foreign", DB(), "current-user"))
    assert exc.value.status_code == 404


def test_preflight_and_run_binding_without_db_or_provider(users, monkeypatch):
    req, data = request(), source(users)
    loader = AsyncMock(return_value=data)
    monkeypatch.setattr(boundary, "load_authoritative_input", loader)
    outcome = asyncio.run(boundary.preflight_owned(req, None, "owner"))
    assert outcome.executable
    params = {"request": req.model_dump(mode="json"), "expected_execution_spec_id": outcome.execution_spec.execution_spec_id}
    stored = asyncio.run(boundary.prepare_capability_run("users", params, None, "owner"))
    result = asyncio.run(boundary.execute_capability_artifact("users", stored, None, "owner"))
    assert result["overall_comparison"]["cvr_delta_pp"] == pytest.approx(-5.2)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(boundary.prepare_capability_run("users", stored, None, "owner"))
    assert exc.value.status_code == 422  # Cannot inject a server spec in run params.
    params["expected_execution_spec_id"] = "modified"
    with pytest.raises(HTTPException) as exc:
        asyncio.run(boundary.prepare_capability_run("users", params, None, "owner"))
    assert exc.value.status_code == 409


def test_create_analysis_rejects_before_writes(users, monkeypatch):
    from app.api.v1.endpoints import analysis as api
    from app.schemas.analysis import AnalysisCreate
    monkeypatch.setattr(boundary, "load_authoritative_input", AsyncMock(return_value=source(users)))
    class DB:
        async def execute(self, stmt):
            return SimpleNamespace(scalar_one_or_none=lambda: SimpleNamespace(id="users"))
        def add(self, obj):
            pytest.fail("invalid plan must not insert an Analysis")
        async def commit(self):
            pytest.fail("invalid plan must not commit")
    payload = AnalysisCreate(dataset_id="users", analysis_type=boundary.ANALYSIS_TYPE, params={"formula": "fake"})
    tasks = BackgroundTasks()
    with pytest.raises(HTTPException):
        asyncio.run(api.create_analysis(payload, tasks, DB(), SimpleNamespace(id="owner")))
    assert not tasks.tasks


def test_real_analysis_create_and_background_dispatch(users, monkeypatch):
    from app.api.v1.endpoints import analysis as api
    from app.schemas.analysis import AnalysisCreate
    from app.core import database
    data = source(users)
    monkeypatch.setattr(boundary, "load_authoritative_input", AsyncMock(return_value=data))
    req = request()
    spec = compile_candidate(req, data).execution_spec
    class DB:
        additions = []
        commits = 0
        async def execute(self, statement):
            return SimpleNamespace(scalar_one_or_none=lambda: SimpleNamespace(id="users"))
        def add(self, item):
            self.additions.append(item)
        async def commit(self):
            self.commits += 1
        async def refresh(self, item):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
    db = DB()
    tasks = BackgroundTasks()
    payload = AnalysisCreate(dataset_id="users", analysis_type=boundary.ANALYSIS_TYPE, params={"request": req.model_dump(mode="json"), "expected_execution_spec_id": spec.execution_spec_id})
    response = asyncio.run(api.create_analysis(payload, tasks, db, SimpleNamespace(id="owner")))
    assert response.data.status == "running"
    assert len(db.additions) == len(tasks.tasks) == 1
    assert db.additions[0].params["execution_spec"]["plan_hash"] == spec.plan_hash
    status = AsyncMock()
    monkeypatch.setattr(api, "update_analysis_status", status)
    monkeypatch.setattr(database, "AsyncSessionLocal", lambda: db)
    asyncio.run(tasks())
    assert status.call_args.args[2] == "completed"
    assert status.call_args.kwargs["result_data"]["schema_version"] == "ConversionDiagnosisResult@1"
    assert status.call_args.kwargs["result_data"]["overall_comparison"]["cvr_delta_pp"] == pytest.approx(-5.2)
    # Version changes between scheduling and execution fail without a fake result.
    data.frame = data.frame.iloc[::-1]
    asyncio.run(tasks())
    assert status.call_args.args[2] == "failed"
    assert status.call_args.kwargs["result_data"]["status"] == "stale"


def test_owned_lineage_adapter_uses_saved_plan_and_base_data(users, monkeypatch):
    from app.schemas.join import JoinPlan
    plan = JoinPlan(
        id="j1", source_analysis_plan_id="p1", relationship_set_id="rel1",
        base_dataset_id="base", included_dataset_ids=["base", "orders"],
        join_steps=[{"left_dataset_id": "base", "right_dataset_id": "orders", "left_field": "user_id", "right_field": "user_id", "join_type": "left", "relationship_id": "edge", "relationship_status": "confirmed", "expected_cardinality": "one_to_many"}],
        confirmed_relationships=[{"id": "edge", "source_dataset_id": "base", "source_field": "user_id", "target_dataset_id": "orders", "target_field": "user_id", "status": "confirmed", "expected_cardinality": "one_to_many", "risk_level": "high"}],
        selected_fields={"base": list(COLUMNS.values()), "orders": ["user_id", "order_id"]}, requires_confirmation=True,
    )
    base = SimpleNamespace(id="base", schema=[], parent_dataset_id=None, derivation_type=None, derivation_plan=None, source_dataset_ids=None, transform_chain=None)
    derived = SimpleNamespace(id="users", schema=[], derivation_type="join", derivation_plan=plan.model_dump(mode="json"), parent_dataset_id="base", source_dataset_ids=["base", "orders"])
    joined = users.merge(pd.read_csv(DATA / "orders.csv")[["user_id", "order_id"]], how="left", on="user_id")
    monkeypatch.setattr(boundary, "_owned", AsyncMock(side_effect=lambda id, db, owner: base if id == "base" else derived))
    from app.services.dataset_io_service import CapabilityDatasetFrames
    monkeypatch.setattr(boundary, "load_capability_dataset_frames", AsyncMock(side_effect=lambda ds: CapabilityDatasetFrames(users, users) if ds.id == "base" else CapabilityDatasetFrames(joined, joined)))
    loaded = asyncio.run(boundary.load_authoritative_input("users", None, "owner"))
    req, _ = derived_request_source(users)
    assert compile_candidate(req, loaded).executable
    assert loaded.provenance["converted"].source_dataset_id == "base"
    derived.derivation_plan["join_steps"][0]["join_type"] = "inner"
    with pytest.raises(DiagnosisError, match="POPULATION_REQUIRES_LEFT_JOIN"):
        asyncio.run(boundary.load_authoritative_input("users", None, "owner"))


def test_schema_required_fields_wrong_role_and_optional_cross_check(users):
    raw = request().model_dump(mode="json")
    del raw["candidate"]["population_spec"]
    with pytest.raises(ValidationError):
        CapabilityPreflightRequest.model_validate(raw)
    raw = request().model_dump(mode="json")
    raw["candidate"]["field_bindings"][0]["role"] = "target_metric"
    with pytest.raises(ValidationError):
        CapabilityPreflightRequest.model_validate(raw)
    raw = request().model_dump(mode="json")
    extra = dict(raw["candidate"]["field_bindings"][0], role="paid_first_order")
    raw["candidate"]["field_bindings"].append(extra)
    assert compile_candidate(CapabilityPreflightRequest.model_validate(raw), source(users)).code == "OPTIONAL_ROLE_NOT_IMPLEMENTED"


def test_missing_channel_id_and_duplicate_user_are_invalid(users):
    for column in ("user_id", "cohort_period", "acquisition_channel"):
        bad = users.copy()
        bad.loc[0, column] = None
        assert compile_candidate(request(), source(bad)).status == "data_invalid"
    assert compile_candidate(request(), source(pd.concat([users, users.iloc[[0]]]))).code == "UNIQUE_USER_GRAIN_VIOLATION"
