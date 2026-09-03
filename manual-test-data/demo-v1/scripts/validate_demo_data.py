#!/usr/bin/env python3
"""Validate flagship demo invariants and print a pandas LEFT-join reference."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


DEMO_DIR = Path(__file__).resolve().parents[1]


def main() -> None:
    users = pd.read_csv(DEMO_DIR / "users.csv")
    orders = pd.read_csv(DEMO_DIR / "orders.csv")
    touchpoints = pd.read_csv(DEMO_DIR / "marketing_touchpoints.csv")
    events = pd.read_csv(DEMO_DIR / "event_log.csv")

    assert len(users) == 2000
    assert users["user_id"].is_unique
    assert orders["order_id"].is_unique
    assert touchpoints["touchpoint_id"].is_unique
    assert events["event_id"].is_unique
    assert set(orders["user_id"]).issubset(set(users["user_id"]))
    assert set(touchpoints["user_id"]).issubset(set(users["user_id"]))
    assert set(events["user_id"]).issubset(set(users["user_id"]))
    assert orders["user_id"].duplicated().any()
    assert touchpoints["user_id"].duplicated().any()

    by_period = users.groupby("cohort_period")["converted"].agg(["sum", "count"])
    conversion_rates = by_period["sum"] / by_period["count"]
    assert conversion_rates["previous_month"] == 0.24
    assert conversion_rates["recent_month"] == 0.188

    social = users[users["acquisition_channel"] == "social_ads"]
    social_rates = social.groupby("cohort_period")["converted"].mean()
    social_shares = social.groupby("cohort_period").size() / users.groupby("cohort_period").size()
    assert social_rates["previous_month"] == 0.16
    assert social_rates["recent_month"] == 0.10
    assert social_shares["previous_month"] == 0.15
    assert social_shares["recent_month"] == 0.40

    joined = users.merge(
        orders,
        on="user_id",
        how="left",
        suffixes=("__users", "__orders"),
        validate="one_to_many",
    )
    expected_rows = int(orders.groupby("user_id").size().clip(lower=1).sum())
    users_without_orders = int((~users["user_id"].isin(orders["user_id"])).sum())
    expected_rows += users_without_orders
    assert len(joined) == expected_rows
    assert len(joined.columns) == len(users.columns) + len(orders.columns) - 1

    paid_users = orders.loc[orders["payment_status"] == "paid", "user_id"].nunique()
    assert paid_users == int(users["converted"].sum())

    print("demo invariant validation: PASS")
    print("relationship: users.user_id 1:N orders.user_id")
    print(f"reference left-join rows: {len(joined)}")
    print(f"reference left-join columns: {len(joined.columns)}")
    print(f"reference row multiplier: {len(joined) / len(users):.4f}")
    print(f"users matching at least one order: {1 - users_without_orders / len(users):.2%}")


if __name__ == "__main__":
    main()
