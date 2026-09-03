import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi import HTTPException

from app.schemas.join import JoinPlan
from app.api.v1.endpoints.join import _get_owned_datasets
from app.services import join_service


def dataset(dataset_id: str, filename: str, rows: int = 10):
    return SimpleNamespace(
        id=dataset_id,
        filename=filename,
        row_count=rows,
        file_size=1024,
        storage_path=f"data/uploads/{dataset_id}/{filename}",
    )


def plan(
    *,
    included=("users", "orders"),
    join_steps=None,
    relationships=None,
    selected_fields=None,
) -> JoinPlan:
    join_steps = join_steps or [
        {
            "left_dataset_id": "users",
            "right_dataset_id": "orders",
            "left_field": "user_id",
            "right_field": "user_id",
            "join_type": "left",
            "relationship_id": "users-orders",
            "relationship_status": "confirmed",
            "expected_cardinality": "one_to_many",
        }
    ]
    relationships = relationships or [
        {
            "id": "users-orders",
            "source_dataset_id": "users",
            "source_field": "user_id",
            "target_dataset_id": "orders",
            "target_field": "user_id",
            "status": "confirmed",
            "expected_cardinality": "one_to_many",
            "risk_level": "low",
        }
    ]
    return JoinPlan(
        id="join-plan-1",
        source_analysis_plan_id="analysis-plan-1",
        relationship_set_id="relationship-set-1",
        base_dataset_id=included[0],
        included_dataset_ids=list(included),
        join_steps=join_steps,
        confirmed_relationships=relationships,
        selected_fields=selected_fields or {
            "users": ["user_id", "segment"],
            "orders": ["user_id", "amount"],
        },
        requires_confirmation=True,
    )


def build(plan_value: JoinPlan, frames: dict[str, pd.DataFrame]):
    datasets = {
        dataset_id: dataset(dataset_id, f"{dataset_id}.csv", len(frame))
        for dataset_id, frame in frames.items()
    }
    return join_service.build_join_preview(plan_value, datasets, frames)


def test_one_to_one_join_is_low_risk():
    join_plan = plan()
    join_plan.join_steps[0].expected_cardinality = "one_to_one"
    join_plan.confirmed_relationships[0].expected_cardinality = "one_to_one"
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2], "segment": ["a", "b"]}),
            "orders": pd.DataFrame({"user_id": [1, 2], "amount": [10, 20]}),
        },
    )

    assert len(result) == 2
    assert preview.step_metrics[0].cardinality == "one_to_one"
    assert preview.risk_summary.risk_level == "low"


def test_one_to_many_join_reports_grain_shift_and_collision_name():
    join_plan = plan(selected_fields={
        "users": ["user_id", "name"],
        "orders": ["user_id", "name", "amount"],
    })
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2], "name": ["u1", "u2"]}),
            "orders": pd.DataFrame({
                "user_id": [1, 1, 2],
                "name": ["o1", "o2", "o3"],
                "amount": [10, 20, 30],
            }),
        },
    )

    assert len(result) == 3
    assert "orders__name" in preview.output_columns
    assert preview.risk_summary.result_grain == "likely_detail"
    assert any("粒度" in warning for warning in preview.risk_summary.warnings)


def test_many_to_many_requires_high_risk_confirmation():
    join_plan = plan()
    join_plan.join_steps[0].expected_cardinality = "many_to_many"
    join_plan.confirmed_relationships[0].expected_cardinality = "many_to_many"
    preview, _ = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 1], "segment": ["a", "b"]}),
            "orders": pd.DataFrame({"user_id": [1, 1], "amount": [10, 20]}),
        },
    )

    assert preview.step_metrics[0].cardinality == "many_to_many"
    assert preview.risk_summary.risk_level == "high"


def test_partial_match_and_null_keys_are_visible_and_nulls_do_not_match():
    join_plan = plan()
    join_plan.join_steps[0].expected_cardinality = "one_to_one"
    join_plan.confirmed_relationships[0].expected_cardinality = "one_to_one"
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2, None], "segment": ["a", "b", "c"]}),
            "orders": pd.DataFrame({"user_id": [1, 3, None], "amount": [10, 30, 99]}),
        },
    )

    metrics = preview.step_metrics[0]
    assert metrics.matched_left_rows == 1
    assert metrics.unmatched_left_rows == 2
    assert metrics.left_null_key_count == 1
    assert metrics.right_null_key_count == 1
    assert metrics.left_null_key_rate == pytest.approx(1 / 3)
    assert result["amount"].notna().sum() == 1


def test_low_match_left_join_is_medium_because_base_rows_are_preserved():
    join_plan = plan()
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2, 3, 4], "segment": ["a", "b", "c", "d"]}),
            "orders": pd.DataFrame({"user_id": [1, 1], "amount": [10, 20]}),
        },
    )

    assert len(result) == 5
    assert preview.step_metrics[0].match_rate == pytest.approx(0.25)
    assert preview.risk_summary.risk_level == "medium"
    assert any("基础记录将被保留" in warning for warning in preview.risk_summary.warnings)


def test_low_match_inner_join_remains_high_risk():
    join_plan = plan()
    join_plan.join_steps[0].join_type = "inner"
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2, 3, 4], "segment": ["a", "b", "c", "d"]}),
            "orders": pd.DataFrame({"user_id": [1, 1], "amount": [10, 20]}),
        },
    )

    assert len(result) == 2
    assert preview.step_metrics[0].match_rate == pytest.approx(0.25)
    assert preview.risk_summary.risk_level == "high"
    assert any("大量基础记录将被丢弃" in warning for warning in preview.risk_summary.warnings)


def test_unconfirmed_or_mismatched_relationship_snapshot_is_rejected():
    join_plan = plan()
    join_plan.confirmed_relationships[0].id = "different-edge"

    with pytest.raises(HTTPException) as exc_info:
        build(
            join_plan,
            {
                "users": pd.DataFrame({"user_id": [1], "segment": ["a"]}),
                "orders": pd.DataFrame({"user_id": [1], "amount": [10]}),
            },
        )

    assert exc_info.value.status_code == 422


def test_missing_field_is_rejected_without_exposing_field_names():
    with pytest.raises(HTTPException) as exc_info:
        build(
            plan(),
            {
                "users": pd.DataFrame({"different": [1], "segment": ["a"]}),
                "orders": pd.DataFrame({"user_id": [1], "amount": [10]}),
            },
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "Join 所需字段不存在"


def test_row_explosion_returns_blocked_preview(monkeypatch):
    monkeypatch.setattr(join_service, "MAX_OUTPUT_ROWS", 3)
    join_plan = plan()
    join_plan.join_steps[0].expected_cardinality = "many_to_many"
    join_plan.confirmed_relationships[0].expected_cardinality = "many_to_many"
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 1], "segment": ["a", "b"]}),
            "orders": pd.DataFrame({"user_id": [1, 1], "amount": [10, 20]}),
        },
    )

    assert preview.risk_summary.risk_level == "blocked"
    assert preview.output_row_count == 4
    assert preview.preview_rows == []
    assert len(result) == 2  # no dangerous merge was executed


def test_three_table_chain_reuses_surviving_join_key():
    join_plan = plan(
        included=("users", "orders", "payments"),
        join_steps=[
            {
                "left_dataset_id": "users",
                "right_dataset_id": "orders",
                "left_field": "user_id",
                "right_field": "user_id",
                "join_type": "left",
                "relationship_id": "users-orders",
                "relationship_status": "confirmed",
                "expected_cardinality": "one_to_many",
            },
            {
                "left_dataset_id": "orders",
                "right_dataset_id": "payments",
                "left_field": "user_id",
                "right_field": "user_id",
                "join_type": "left",
                "relationship_id": "orders-payments",
                "relationship_status": "confirmed",
                "expected_cardinality": "many_to_one",
            },
        ],
        relationships=[
            {
                "id": "users-orders",
                "source_dataset_id": "users",
                "source_field": "user_id",
                "target_dataset_id": "orders",
                "target_field": "user_id",
                "status": "confirmed",
                "expected_cardinality": "one_to_many",
                "risk_level": "low",
            },
            {
                "id": "orders-payments",
                "source_dataset_id": "orders",
                "source_field": "user_id",
                "target_dataset_id": "payments",
                "target_field": "user_id",
                "status": "confirmed",
                "expected_cardinality": "many_to_one",
                "risk_level": "low",
            },
        ],
        selected_fields={
            "users": ["user_id", "segment"],
            "orders": ["user_id", "amount"],
            "payments": ["user_id", "paid"],
        },
    )
    preview, result = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1, 2], "segment": ["a", "b"]}),
            "orders": pd.DataFrame({"user_id": [1, 1, 2], "amount": [10, 20, 30]}),
            "payments": pd.DataFrame({"user_id": [1, 2], "paid": [True, False]}),
        },
    )

    assert len(preview.step_metrics) == 2
    assert result["paid"].tolist() == [True, True, False]


def test_reversed_relationship_inverts_expected_cardinality():
    join_plan = plan(
        included=("orders", "users"),
        join_steps=[{
            "left_dataset_id": "orders",
            "right_dataset_id": "users",
            "left_field": "user_id",
            "right_field": "user_id",
            "join_type": "left",
            "relationship_id": "users-orders",
            "relationship_status": "confirmed",
            "expected_cardinality": "many_to_one",
        }],
        selected_fields={
            "orders": ["user_id", "amount"],
            "users": ["user_id", "segment"],
        },
    )
    preview, _ = build(
        join_plan,
        {
            "orders": pd.DataFrame({"user_id": [1, 1, 2], "amount": [10, 20, 30]}),
            "users": pd.DataFrame({"user_id": [1, 2], "segment": ["a", "b"]}),
        },
    )

    assert preview.step_metrics[0].cardinality == "many_to_one"
    assert preview.risk_summary.risk_level == "low"


def test_preview_never_writes_storage(monkeypatch):
    frames = {
        "users": pd.DataFrame({"user_id": [1], "segment": ["a"]}),
        "orders": pd.DataFrame({"user_id": [1], "amount": [10]}),
    }

    async def fake_load(value):
        return frames[value.id]

    async def fail_save(*_args, **_kwargs):
        raise AssertionError("preview must not persist files")

    monkeypatch.setattr(join_service, "load_dataset_dataframe", fake_load)
    monkeypatch.setattr(join_service.storage, "save", fail_save)
    preview, _ = asyncio.run(join_service.preview_join_plan(
        plan(),
        {"users": dataset("users", "users.csv"), "orders": dataset("orders", "orders.csv")},
    ))

    assert preview.output_row_count == 1


def test_foreign_or_missing_source_dataset_is_not_returned():
    class FakeScalars:
        def all(self):
            return [dataset("users", "users.csv")]

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    class FakeDb:
        async def execute(self, _statement):
            return FakeResult()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(_get_owned_datasets(
            ["users", "foreign-orders"],
            FakeDb(),
            SimpleNamespace(id="current-user"),
        ))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "一个或多个源数据集不存在"


def test_create_dataset_requires_high_risk_confirmation(monkeypatch):
    high_preview, frame = build(
        plan(),
        {
            "users": pd.DataFrame({"user_id": [1], "segment": ["a"]}),
            "orders": pd.DataFrame({"user_id": [1], "amount": [10]}),
        },
    )
    high_preview.risk_summary.risk_level = "high"

    async def fake_preview(*_args, **_kwargs):
        return high_preview, frame

    monkeypatch.setattr(join_service, "preview_join_plan", fake_preview)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(join_service.create_joined_dataset(
            plan=plan(),
            datasets={"users": dataset("users", "users.csv"), "orders": dataset("orders", "orders.csv")},
            filename="analysis.csv",
            confirm_high_risk=False,
            db=SimpleNamespace(),
            current_user_id="user-1",
        ))

    assert exc_info.value.status_code == 409


def test_create_dataset_persists_multi_source_lineage(monkeypatch):
    join_plan = plan()
    join_plan.join_steps[0].expected_cardinality = "one_to_one"
    join_plan.confirmed_relationships[0].expected_cardinality = "one_to_one"
    preview, frame = build(
        join_plan,
        {
            "users": pd.DataFrame({"user_id": [1], "segment": ["a"]}),
            "orders": pd.DataFrame({"user_id": [1], "amount": [10]}),
        },
    )

    async def fake_preview(*_args, **_kwargs):
        return preview, frame

    async def fake_save(*_args, **_kwargs):
        return "data/uploads/derived/analysis.csv"

    class FakeDb:
        def __init__(self):
            self.added = None

        def add(self, value):
            self.added = value

        async def commit(self):
            return None

        async def refresh(self, value):
            value.created_at = datetime.now(timezone.utc)

        async def rollback(self):
            return None

    fake_db = FakeDb()
    monkeypatch.setattr(join_service, "preview_join_plan", fake_preview)
    monkeypatch.setattr(join_service.storage, "save", fake_save)
    result = asyncio.run(join_service.create_joined_dataset(
        plan=join_plan,
        datasets={"users": dataset("users", "users.csv"), "orders": dataset("orders", "orders.csv")},
        filename="../analysis output.xlsx",
        confirm_high_risk=False,
        db=fake_db,
        current_user_id="user-1",
    ))

    assert result.filename == "analysis_output.csv"
    assert result.source_dataset_ids == ["users", "orders"]
    assert fake_db.added.user_id == "user-1"
    assert fake_db.added.source_dataset_ids == ["users", "orders"]
    assert fake_db.added.derivation_type == "join"
    assert fake_db.added.derivation_plan["source_analysis_plan_id"] == "analysis-plan-1"
