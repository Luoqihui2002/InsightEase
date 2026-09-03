#!/usr/bin/env python3
"""Generate the deterministic InsightEase V1 flagship demo dataset.

The business pattern is encoded as exact cohort and funnel counts. Randomness is
used only to vary dates, devices, countries, campaigns, and order values.
"""

from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


RANDOM_SEED = 20260903
OUTPUT_DIR = Path(__file__).resolve().parents[1]

PERIODS = {
    "previous_month": (datetime(2026, 7, 1), datetime(2026, 7, 31, 23, 59, 59)),
    "recent_month": (datetime(2026, 8, 1), datetime(2026, 8, 31, 23, 59, 59)),
}

# (users, product_view, add_to_cart, checkout, payment_success)
COHORTS = {
    "previous_month": {
        "organic": (300, 270, 180, 105, 90),
        "search_ads": (300, 270, 174, 102, 78),
        "social_ads": (150, 135, 90, 45, 24),
        "affiliate": (150, 132, 84, 48, 30),
        "push": (100, 85, 50, 30, 18),
    },
    "recent_month": {
        "organic": (200, 180, 120, 70, 60),
        "search_ads": (200, 180, 116, 68, 50),
        "social_ads": (400, 360, 220, 120, 40),
        "affiliate": (120, 106, 67, 38, 24),
        "push": (80, 68, 40, 24, 14),
    },
}

COUNTRIES = ["CN", "SG", "MY"]
DEVICES = ["iOS", "Android", "Web"]
PRODUCT_CATEGORIES = ["electronics", "home", "beauty", "sports", "apparel"]


def _write_csv(name: str, headers: list[str], rows: list[list[object]]) -> None:
    path = OUTPUT_DIR / name
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"wrote {len(rows):>5} rows  {path.name}")


def _random_datetime(rng: random.Random, start: datetime, end: datetime) -> datetime:
    seconds = int((end - start).total_seconds())
    return start + timedelta(seconds=rng.randint(0, seconds))


def _stage_members(
    rng: random.Random,
    user_ids: list[str],
    product_count: int,
    cart_count: int,
    checkout_count: int,
    conversion_count: int,
) -> dict[str, set[str]]:
    ordered = user_ids[:]
    rng.shuffle(ordered)
    product_order = ordered[:product_count]
    product = set(product_order)
    rng.shuffle(product_order)
    cart_order = product_order[:cart_count]
    cart = set(cart_order)
    rng.shuffle(cart_order)
    checkout_order = cart_order[:checkout_count]
    checkout = set(checkout_order)
    rng.shuffle(checkout_order)
    payment = set(checkout_order[:conversion_count])
    return {
        "product_view": product,
        "add_to_cart": cart,
        "checkout": checkout,
        "payment_success": payment,
    }


def generate() -> dict[str, list[list[object]]]:
    rng = random.Random(RANDOM_SEED)
    users: list[list[object]] = []
    orders: list[list[object]] = []
    touchpoints: list[list[object]] = []
    events: list[list[object]] = []

    user_details: dict[str, dict[str, object]] = {}
    event_id = 1
    order_id = 1
    touchpoint_id = 1
    global_user_index = 1

    for period, channels in COHORTS.items():
        period_start, period_end = PERIODS[period]
        for channel, counts in channels.items():
            user_count, product_count, cart_count, checkout_count, conversion_count = counts
            channel_user_ids = [
                f"U{global_user_index + offset:05d}" for offset in range(user_count)
            ]
            global_user_index += user_count
            stages = _stage_members(
                rng,
                channel_user_ids,
                product_count,
                cart_count,
                checkout_count,
                conversion_count,
            )

            for cohort_index, user_id in enumerate(channel_user_ids, start=1):
                registered_at = _random_datetime(rng, period_start, period_end)
                converted = int(user_id in stages["payment_success"])
                country = COUNTRIES[(global_user_index + cohort_index) % len(COUNTRIES)]
                device = DEVICES[(cohort_index + len(channel)) % len(DEVICES)]
                user_details[user_id] = {
                    "period": period,
                    "channel": channel,
                    "registered_at": registered_at,
                    "converted": converted,
                    "stages": stages,
                }
                users.append(
                    [
                        user_id,
                        registered_at.strftime("%Y-%m-%d %H:%M:%S"),
                        country,
                        channel,
                        device,
                        1,
                        period,
                        converted,
                    ]
                )

                primary_touch_time = registered_at - timedelta(hours=rng.randint(1, 72))
                campaign = f"{channel.upper()}-{period[:3].upper()}-{1 + cohort_index % 3}"
                touchpoints.append(
                    [
                        f"T{touchpoint_id:06d}",
                        user_id,
                        channel,
                        campaign,
                        primary_touch_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "acquisition",
                    ]
                )
                touchpoint_id += 1

                if user_id in stages["product_view"] and cohort_index % 5 == 0:
                    retarget_time = registered_at + timedelta(hours=6)
                    touchpoints.append(
                        [
                            f"T{touchpoint_id:06d}",
                            user_id,
                            channel,
                            f"{channel.upper()}-RETARGET",
                            retarget_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "retargeting",
                        ]
                    )
                    touchpoint_id += 1

                sequence = ["app_open", "home_view"]
                if user_id in stages["product_view"]:
                    sequence.append("product_view")
                if user_id in stages["add_to_cart"]:
                    sequence.append("add_to_cart")
                if user_id in stages["checkout"]:
                    sequence.append("checkout")
                if converted:
                    sequence.append("payment_success")

                for step, event_name in enumerate(sequence):
                    event_time = registered_at + timedelta(minutes=step * 5 + rng.randint(0, 3))
                    page = {
                        "app_open": "app",
                        "home_view": "home",
                        "product_view": "product_detail",
                        "add_to_cart": "cart",
                        "checkout": "checkout",
                        "payment_success": "payment_result",
                    }[event_name]
                    events.append(
                        [
                            f"E{event_id:07d}",
                            user_id,
                            event_time.strftime("%Y-%m-%d %H:%M:%S"),
                            event_name,
                            page,
                            period,
                            channel,
                        ]
                    )
                    event_id += 1

                if converted:
                    paid_time = registered_at + timedelta(minutes=28 + rng.randint(0, 15))
                    base_gmv = round(rng.uniform(80, 620), 2)
                    orders.append(
                        [
                            f"O{order_id:06d}",
                            user_id,
                            paid_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "paid",
                            f"{base_gmv:.2f}",
                            PRODUCT_CATEGORIES[order_id % len(PRODUCT_CATEGORIES)],
                            1,
                            period,
                        ]
                    )
                    order_id += 1

                    # Repeat purchases make users.user_id -> orders.user_id a real 1:N edge.
                    if cohort_index % 7 == 0:
                        repeat_time = min(paid_time + timedelta(days=2), period_end)
                        repeat_gmv = round(rng.uniform(45, 280), 2)
                        orders.append(
                            [
                                f"O{order_id:06d}",
                                user_id,
                                repeat_time.strftime("%Y-%m-%d %H:%M:%S"),
                                "paid",
                                f"{repeat_gmv:.2f}",
                                PRODUCT_CATEGORIES[order_id % len(PRODUCT_CATEGORIES)],
                                0,
                                period,
                            ]
                        )
                        order_id += 1
                elif user_id in stages["checkout"] and cohort_index % 2 == 0:
                    failed_time = registered_at + timedelta(minutes=25 + rng.randint(0, 12))
                    orders.append(
                        [
                            f"O{order_id:06d}",
                            user_id,
                            failed_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "payment_failed",
                            "0.00",
                            PRODUCT_CATEGORIES[order_id % len(PRODUCT_CATEGORIES)],
                            1,
                            period,
                        ]
                    )
                    order_id += 1

    return {
        "users": users,
        "orders": orders,
        "marketing_touchpoints": touchpoints,
        "event_log": events,
    }


def _rate(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def _render_ground_truth(data: dict[str, list[list[object]]]) -> str:
    users = data["users"]
    events = data["event_log"]
    orders = data["orders"]
    cohort_totals: dict[str, Counter[str]] = defaultdict(Counter)
    channel_totals: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)

    for row in users:
        _, _, _, channel, _, _, period, converted = row
        cohort_totals[str(period)]["users"] += 1
        cohort_totals[str(period)]["converted"] += int(converted)
        channel_totals[(str(period), str(channel))]["users"] += 1
        channel_totals[(str(period), str(channel))]["converted"] += int(converted)

    for row in events:
        _, _, _, event_name, _, period, channel = row
        if event_name in {"product_view", "add_to_cart", "checkout", "payment_success"}:
            channel_totals[(str(period), str(channel))][str(event_name)] += 1

    previous_cvr = _rate(
        cohort_totals["previous_month"]["converted"],
        cohort_totals["previous_month"]["users"],
    )
    recent_cvr = _rate(
        cohort_totals["recent_month"]["converted"],
        cohort_totals["recent_month"]["users"],
    )
    mix_effect = 0.0
    within_effect = 0.0
    for channel in COHORTS["previous_month"]:
        previous = channel_totals[("previous_month", channel)]
        recent = channel_totals[("recent_month", channel)]
        previous_share = _rate(previous["users"], cohort_totals["previous_month"]["users"])
        recent_share = _rate(recent["users"], cohort_totals["recent_month"]["users"])
        previous_rate = _rate(previous["converted"], previous["users"])
        recent_rate = _rate(recent["converted"], recent["users"])
        mix_effect += (recent_share - previous_share) * previous_rate
        within_effect += recent_share * (recent_rate - previous_rate)

    paid_orders = [row for row in orders if row[3] == "paid"]
    unique_paid_users = len({str(row[1]) for row in paid_orders})
    duplicated_order_users = sum(
        1 for count in Counter(str(row[1]) for row in orders).values() if count > 1
    )

    lines = [
        "# InsightEase V1 Flagship Demo — Ground Truth",
        "",
        "> Generated from the exact cohort rules in `scripts/generate_demo_data.py`; do not edit numbers by hand.",
        "",
        "## Scope",
        "",
        "- Fixed seed: `20260903`",
        "- Previous month: `2026-07-01` through `2026-07-31`",
        "- Recent month: `2026-08-01` through `2026-08-31`",
        "- New customer conversion: a user with at least one `paid` first order / all registered users in the period.",
        "",
        "## Overall result",
        "",
        f"- Previous-month CVR: **{previous_cvr:.1%}** ({cohort_totals['previous_month']['converted']}/{cohort_totals['previous_month']['users']})",
        f"- Recent-month CVR: **{recent_cvr:.1%}** ({cohort_totals['recent_month']['converted']}/{cohort_totals['recent_month']['users']})",
        f"- Overall conversion decline: **{(recent_cvr - previous_cvr) * 100:.2f} percentage points**",
        f"- Traffic-mix contribution: **{mix_effect * 100:.2f} percentage points**",
        f"- Within-channel contribution: **{within_effect * 100:.2f} percentage points**",
        "",
        "## Channel truth",
        "",
        "| Channel | Previous users | Previous CVR | Recent users | Recent CVR | Share change |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for channel in COHORTS["previous_month"]:
        previous = channel_totals[("previous_month", channel)]
        recent = channel_totals[("recent_month", channel)]
        previous_rate = _rate(previous["converted"], previous["users"])
        recent_rate = _rate(recent["converted"], recent["users"])
        previous_share = _rate(previous["users"], cohort_totals["previous_month"]["users"])
        recent_share = _rate(recent["users"], cohort_totals["recent_month"]["users"])
        lines.append(
            f"| {channel} | {previous['users']} | {previous_rate:.1%} | {recent['users']} | {recent_rate:.1%} | {(recent_share - previous_share) * 100:+.1f} pp |"
        )

    previous_social = channel_totals[("previous_month", "social_ads")]
    recent_social = channel_totals[("recent_month", "social_ads")]
    lines.extend(
        [
            "",
            "## Social ads funnel",
            "",
            "| Stage | Previous | Previous rate | Recent | Recent rate |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    for stage in ("product_view", "add_to_cart", "checkout", "payment_success"):
        lines.append(
            f"| {stage} | {previous_social[stage]} | {_rate(previous_social[stage], previous_social['users']):.1%} | {recent_social[stage]} | {_rate(recent_social[stage], recent_social['users']):.1%} |"
        )
    lines.extend(
        [
            f"| checkout → payment_success | {previous_social['converted']}/{previous_social['checkout']} | {_rate(previous_social['converted'], previous_social['checkout']):.1%} | {recent_social['converted']}/{recent_social['checkout']} | {_rate(recent_social['converted'], recent_social['checkout']):.1%} |",
            "",
            "## Expected interpretation",
            "",
            "- Best channel in both periods: **organic**.",
            "- Worst recent-month channel: **social_ads**.",
            "- Main driver: **social_ads share rose from 15% to 40% while remaining structurally lower-converting** (mix shift).",
            "- Secondary driver: **social_ads CVR fell from 16% to 10%, concentrated at checkout → payment_success**.",
            "- Product-view rate for social_ads is stable at 90%; the data does not support an awareness-stage diagnosis.",
            "",
            "## Join and lineage reference",
            "",
            f"- `users.csv`: {len(users)} rows, unique `user_id`.",
            f"- `orders.csv`: {len(orders)} rows; {unique_paid_users} unique paid users; {duplicated_order_users} users have multiple order rows.",
            "- Expected relationship: `users.user_id` 1:N `orders.user_id`.",
            "- Expected LEFT join row count is computed by `scripts/validate_demo_data.py` and must match the Join Preview before dataset creation.",
            "- `marketing_touchpoints.csv` and `event_log.csv` provide candidate/reference evidence; they are not required in the flagship users→orders derived dataset.",
            "",
            "## Validation rule",
            "",
            "The product result passes when it preserves the direction, channel ordering, and main/secondary drivers above. UI or model output must never be used to rewrite this file.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    data = generate()
    _write_csv(
        "users.csv",
        [
            "user_id",
            "register_date",
            "country",
            "acquisition_channel",
            "device_type",
            "new_user_flag",
            "cohort_period",
            "converted",
        ],
        data["users"],
    )
    _write_csv(
        "orders.csv",
        [
            "order_id",
            "user_id",
            "order_date",
            "payment_status",
            "gmv",
            "product_category",
            "is_first_order",
            "cohort_period",
        ],
        data["orders"],
    )
    _write_csv(
        "marketing_touchpoints.csv",
        ["touchpoint_id", "user_id", "channel", "campaign", "touch_time", "touchpoint_type"],
        data["marketing_touchpoints"],
    )
    _write_csv(
        "event_log.csv",
        ["event_id", "user_id", "event_time", "event_name", "page", "cohort_period", "channel"],
        data["event_log"],
    )
    (OUTPUT_DIR / "GROUND_TRUTH.md").write_text(_render_ground_truth(data), encoding="utf-8")
    print("wrote ground truth  GROUND_TRUTH.md")


if __name__ == "__main__":
    main()
