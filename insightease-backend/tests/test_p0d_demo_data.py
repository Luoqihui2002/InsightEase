from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from app.schemas.join import JoinPlan
from app.services.join_service import build_join_preview


DEMO_DIR = Path(__file__).resolve().parents[2] / "manual-test-data" / "demo-v1"


def test_flagship_demo_ground_truth_and_join_preview():
    users = pd.read_csv(DEMO_DIR / "users.csv")
    orders = pd.read_csv(DEMO_DIR / "orders.csv")

    period_rates = users.groupby("cohort_period")["converted"].mean()
    assert period_rates["previous_month"] == pytest.approx(0.24)
    assert period_rates["recent_month"] == pytest.approx(0.188)

    social = users[users["acquisition_channel"] == "social_ads"]
    social_rates = social.groupby("cohort_period")["converted"].mean()
    assert social_rates["previous_month"] == pytest.approx(0.16)
    assert social_rates["recent_month"] == pytest.approx(0.10)

    frames = {"users": users, "orders": orders}
    datasets = {
        dataset_id: SimpleNamespace(
            id=dataset_id,
            filename=f"{dataset_id}.csv",
            row_count=len(frame),
            file_size=1,
            storage_path=f"demo/{dataset_id}.csv",
        )
        for dataset_id, frame in frames.items()
    }
    plan = JoinPlan(
        id="p0d-reference-plan",
        source_analysis_plan_id="p0d-reference-analysis-plan",
        relationship_set_id="p0d-reference-relationship-set",
        base_dataset_id="users",
        included_dataset_ids=["users", "orders"],
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
            }
        ],
        confirmed_relationships=[
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
        ],
        selected_fields={
            "users": list(users.columns),
            "orders": list(orders.columns),
        },
        requires_confirmation=True,
    )

    preview, joined = build_join_preview(plan, datasets, frames)

    assert preview.output_row_count == len(joined) == 2054
    assert preview.output_column_count == 15
    assert preview.step_metrics[0].cardinality == "one_to_many"
    assert preview.step_metrics[0].match_rate == pytest.approx(0.27)
    assert preview.risk_summary.row_multiplier == pytest.approx(1.027)
    assert preview.risk_summary.result_grain == "likely_detail"
    assert preview.risk_summary.risk_level == "medium"
    assert "orders__cohort_period" in preview.output_columns
