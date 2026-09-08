"""Static H2 metric authority. No provider or dynamic discovery."""
from types import MappingProxyType
from app.schemas.evidence import MetricDefinition

_DEFINITIONS = (
    ('selected_cohort_user_count', '1', 'Selected cohort users', 'count', 'unique_selected_users', 'active'),
    ('selected_cohort_converted_user_count', '1', 'Converted selected cohort users', 'count', 'binary_flag_selected_user_count', 'active'),
    ('selected_cohort_conversion_rate', '1', 'Selected cohort conversion rate', 'fraction', 'converted_selected_users_over_selected_users', 'active'),
    # Historical definitions remain catalogued for compatibility, but the current
    # conversion adapter is not authorized to publish them without a qualified population contract.
    ('new_customer_count', '1', 'Qualified new customers', 'count', 'qualified_new_customer_count', 'reserved'),
    ('converted_customer_count', '1', 'Converted qualified new customers', 'count', 'converted_qualified_new_customer_count', 'reserved'),
    ('new_customer_cvr', '1', 'Qualified new-customer conversion rate', 'fraction', 'converted_qualified_new_customers_over_qualified_new_customers', 'reserved'),
    ('cvr_delta_pp', '1', 'Selected cohort conversion rate difference', 'percentage_point', 'current_minus_baseline_rate_times_100', 'active'),
    ('channel_user_count', '1', 'Selected cohort users in channel', 'count', 'unique_selected_users_in_channel_and_cohort', 'active'),
    ('channel_share', '1', 'Channel share of selected cohort users', 'fraction', 'channel_selected_users_over_selected_cohort_users', 'active'),
    ('channel_converted_count', '1', 'Converted selected cohort users in channel', 'count', 'binary_flag_selected_users_in_channel_and_cohort', 'active'),
    ('channel_cvr', '1', 'Selected cohort channel conversion rate', 'fraction', 'converted_selected_channel_users_over_selected_channel_users', 'active'),
    ('channel_cvr_delta_pp', '1', 'Selected cohort channel conversion rate difference', 'percentage_point', 'current_minus_baseline_channel_rate_times_100', 'active'),
    ('conversion_count_delta', '1', 'Channel converted selected-user count difference', 'count', 'current_minus_baseline_converted_selected_users', 'active'),
    ('mix_effect_pp', '1', 'Baseline-rate mix contribution', 'percentage_point', 'share_change_times_baseline_rate_times_100', 'active'),
    ('within_effect_pp', '1', 'Current-share within contribution', 'percentage_point', 'current_share_times_rate_change_times_100', 'active'),
    ('mix_within_decomposition', '1', 'Accounting decomposition', 'percentage_point', 'baseline_rate_mix_current_share_within', 'active'),
    ('input_quality', '1', 'Input grain and normalization', 'status', 'persisted_execution_quality', 'active'),
    ('represented_record_mean', 'legacy-1', 'Input records per represented user', 'records_per_user', 'represented_records_over_represented_users_rounded_2dp', 'active'),
    ('represented_record_count', 'legacy-1', 'Represented input records', 'count', 'sum_input_records_in_represented_user_groups', 'active'),
    ('represented_user_count', 'legacy-1', 'Represented users', 'count', 'nonempty_input_user_groups', 'active'),
    ('allocated_conversion_value', 'legacy-1', 'Model allocated conversion value', 'allocated_value', 'legacy_model_allocation_rounded_4dp', 'active'),
)
METRICS = MappingProxyType({mid: MetricDefinition(metric_id=mid, version=version, label=label, unit=unit,
                                                  formula_id=formula, lifecycle=lifecycle)
                            for mid, version, label, unit, formula, lifecycle in _DEFINITIONS})
LIMITATIONS = ('causal_effect', 'causal_channel_effect', 'complete_customer_journey',
               'first_touch_conversion_dominance', 'funnel_bottleneck', 'budget_optimization',
               'guaranteed_conversion_lift', 'user_quality_causal_change', 'causal_acquisition_priority')
