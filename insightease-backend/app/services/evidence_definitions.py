"""Static H2 metric authority. No provider or dynamic discovery."""
from types import MappingProxyType
from app.schemas.evidence import MetricDefinition

_DEFINITIONS = (
    ('new_customer_count', '1', 'Selected cohort users', 'count', 'unique_selected_users'),
    ('converted_customer_count', '1', 'Converted cohort users', 'count', 'binary_flag_user_count'),
    ('new_customer_cvr', '1', 'Selected cohort conversion rate', 'fraction', 'converted_users_over_selected_users'),
    ('cvr_delta_pp', '1', 'Cohort conversion rate difference', 'percentage_point', 'current_minus_baseline_rate_times_100'),
    ('channel_user_count', '1', 'Channel users', 'count', 'unique_users_in_channel_and_cohort'),
    ('channel_share', '1', 'Channel population share', 'fraction', 'channel_users_over_cohort_users'),
    ('channel_converted_count', '1', 'Converted channel users', 'count', 'binary_flag_users_in_channel_and_cohort'),
    ('channel_cvr', '1', 'Channel conversion rate', 'fraction', 'converted_channel_users_over_channel_users'),
    ('channel_cvr_delta_pp', '1', 'Channel conversion rate difference', 'percentage_point', 'current_minus_baseline_channel_rate_times_100'),
    ('conversion_count_delta', '1', 'Channel converted user count difference', 'count', 'current_minus_baseline_converted_users'),
    ('mix_effect_pp', '1', 'Baseline-rate mix contribution', 'percentage_point', 'share_change_times_baseline_rate_times_100'),
    ('within_effect_pp', '1', 'Current-share within contribution', 'percentage_point', 'current_share_times_rate_change_times_100'),
    ('mix_within_decomposition', '1', 'Accounting decomposition', 'percentage_point', 'baseline_rate_mix_current_share_within'),
    ('input_quality', '1', 'Input grain and normalization', 'status', 'persisted_execution_quality'),
    ('represented_record_mean', 'legacy-1', 'Input records per represented user', 'records_per_user', 'represented_records_over_represented_users_rounded_2dp'),
    ('represented_record_count', 'legacy-1', 'Represented input records', 'count', 'sum_input_records_in_represented_user_groups'),
    ('represented_user_count', 'legacy-1', 'Represented users', 'count', 'nonempty_input_user_groups'),
    ('allocated_conversion_value', 'legacy-1', 'Model allocated conversion value', 'allocated_value', 'legacy_model_allocation_rounded_4dp'),
)
METRICS = MappingProxyType({mid: MetricDefinition(metric_id=mid, version=version, label=label, unit=unit, formula_id=formula)
                            for mid, version, label, unit, formula in _DEFINITIONS})
LIMITATIONS = ('causal_effect', 'causal_channel_effect', 'complete_customer_journey',
               'first_touch_conversion_dominance', 'funnel_bottleneck', 'budget_optimization',
               'guaranteed_conversion_lift', 'user_quality_causal_change', 'causal_acquisition_priority')
