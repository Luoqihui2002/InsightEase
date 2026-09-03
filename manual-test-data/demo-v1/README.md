# InsightEase V1 Flagship Demo Data

This public synthetic dataset supports one repeatable portfolio scenario:

> 最近一个月新客转化表现为什么下降？请比较不同营销渠道的转化表现，并帮我定位主要原因。

The pack contains four grains:

| File | Grain | Main role |
|---|---|---|
| `users.csv` | one row per user | required, base grain |
| `orders.csv` | one row per order | required, creates the real 1:N join |
| `marketing_touchpoints.csv` | one row per touchpoint | candidate/reference |
| `event_log.csv` | one row per user event | candidate/reference funnel evidence |

The data is synthetic and contains no personal information. Exact cohort counts encode the story; the fixed seed only varies non-causal details such as timestamps and GMV.

## Reproduce and validate

From the repository root:

```bash
python manual-test-data/demo-v1/scripts/generate_demo_data.py
insightease-backend/.venv/bin/python manual-test-data/demo-v1/scripts/validate_demo_data.py
```

The generator rewrites the four CSV files and `GROUND_TRUTH.md` deterministically. Review the ground truth before the demo; do not change it to fit product output.

## Intended relationship review

- Confirm `users.user_id` → `orders.user_id` as 1:N.
- `users.user_id` → `marketing_touchpoints.user_id` is also 1:N, but remains outside the flagship derived dataset.
- Keep `event_log.csv` as reference evidence for the within-channel funnel diagnosis.

The Join Builder should preview a LEFT join from users to orders, surface the grain shift from user to order, and create nothing until explicit confirmation.
