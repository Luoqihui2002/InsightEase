# InsightEase V1 Flagship Demo — Ground Truth

> Generated from the exact cohort rules in `scripts/generate_demo_data.py`; do not edit numbers by hand.

## Scope

- Fixed seed: `20260903`
- Previous month: `2026-07-01` through `2026-07-31`
- Recent month: `2026-08-01` through `2026-08-31`
- New customer conversion: a user with at least one `paid` first order / all registered users in the period.

## Overall result

- Previous-month CVR: **24.0%** (240/1000)
- Recent-month CVR: **18.8%** (188/1000)
- Overall conversion decline: **-5.20 percentage points**
- Traffic-mix contribution: **-2.56 percentage points**
- Within-channel contribution: **-2.64 percentage points**

## Channel truth

| Channel | Previous users | Previous CVR | Recent users | Recent CVR | Share change |
|---|---:|---:|---:|---:|---:|
| organic | 300 | 30.0% | 200 | 30.0% | -10.0 pp |
| search_ads | 300 | 26.0% | 200 | 25.0% | -10.0 pp |
| social_ads | 150 | 16.0% | 400 | 10.0% | +25.0 pp |
| affiliate | 150 | 20.0% | 120 | 20.0% | -3.0 pp |
| push | 100 | 18.0% | 80 | 17.5% | -2.0 pp |

## Social ads funnel

| Stage | Previous | Previous rate | Recent | Recent rate |
|---|---:|---:|---:|---:|
| product_view | 135 | 90.0% | 360 | 90.0% |
| add_to_cart | 90 | 60.0% | 220 | 55.0% |
| checkout | 45 | 30.0% | 120 | 30.0% |
| payment_success | 24 | 16.0% | 40 | 10.0% |
| checkout → payment_success | 24/45 | 53.3% | 40/120 | 33.3% |

## Expected interpretation

- Best channel in both periods: **organic**.
- Worst recent-month channel: **social_ads**.
- Main driver: **social_ads share rose from 15% to 40% while remaining structurally lower-converting** (mix shift).
- Secondary driver: **social_ads CVR fell from 16% to 10%, concentrated at checkout → payment_success**.
- Product-view rate for social_ads is stable at 90%; the data does not support an awareness-stage diagnosis.

## Join and lineage reference

- `users.csv`: 2000 rows, unique `user_id`.
- `orders.csv`: 594 rows; 428 unique paid users; 54 users have multiple order rows.
- Expected relationship: `users.user_id` 1:N `orders.user_id`.
- Expected LEFT join row count is computed by `scripts/validate_demo_data.py` and must match the Join Preview before dataset creation.
- `marketing_touchpoints.csv` and `event_log.csv` provide candidate/reference evidence; they are not required in the flagship users→orders derived dataset.

## Validation rule

The product result passes when it preserves the direction, channel ordering, and main/secondary drivers above. UI or model output must never be used to rewrite this file.
