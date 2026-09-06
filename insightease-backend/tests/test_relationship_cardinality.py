from pathlib import Path

import pandas as pd
import pytest

from app.services.assistant_profile_service import profile_dataset
from app.services.relationship_inference_service import infer_relationships


def _user_key_relationship(left, right):
    profiles = {
        name: profile_dataset(frame, dataset_id=name, name=name, include_examples=False)
        for name, frame in (("users", left), ("orders", right))
    }
    relationships = infer_relationships(profiles)["relationships"]
    relation = next(
        rel for rel in relationships
        if rel["source_column"] == rel["target_column"] == "user_id"
    )
    cardinality = relation["relationship_type"]
    if relation["source_dataset_id"] != "users":
        cardinality = {"many_to_one": "one_to_many", "one_to_many": "many_to_one"}.get(cardinality, cardinality)
    return cardinality


def test_flagship_demo_user_order_cardinality():
    demo = Path(__file__).resolve().parents[2] / "manual-test-data/demo-v1"
    users = pd.read_csv(demo / "users.csv")
    orders = pd.read_csv(demo / "orders.csv")
    assert orders["user_id"].nunique() == 540
    assert len(orders) == 594
    assert _user_key_relationship(users, orders) == "one_to_many"


@pytest.mark.parametrize(
    "left,right,expected",
    [
        (["U1", "U2"], ["U1", "U2"], "one_to_one"),
        (["U1", "U2"], ["U1", "U2", "U2"], "one_to_many"),
        (["U1", "U2", "U2"], ["U1", "U2"], "many_to_one"),
        (["U1", "U2", "U2"], ["U1", "U2", "U2"], "many_to_many"),
        (["U1", "U2", None], ["U1", "U2", "U2"], "one_to_many"),
    ],
)
def test_cardinality_uses_non_null_counts(left, right, expected):
    assert _user_key_relationship(
        pd.DataFrame({"user_id": left}), pd.DataFrame({"user_id": right})
    ) == expected


def test_rounded_unique_rate_does_not_hide_a_duplicate():
    users = pd.DataFrame({"user_id": [f"U{i}" for i in range(20001)]})
    orders = pd.DataFrame({"user_id": [f"U{i}" for i in range(20000)] + ["U0"]})
    assert round(orders["user_id"].nunique() / len(orders), 4) == 1.0
    assert _user_key_relationship(users, orders) == "one_to_many"


def test_all_null_key_does_not_infer_a_relationship():
    profiles = {
        name: profile_dataset(pd.DataFrame({"user_id": values}), dataset_id=name, name=name, include_examples=False)
        for name, values in (("users", [None, None]), ("orders", ["U1", "U2"]))
    }
    assert infer_relationships(profiles)["relationships"] == []
