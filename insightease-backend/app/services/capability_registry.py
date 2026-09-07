"""InsightEase-owned authority; no runtime registration or provider-defined formula."""
from types import MappingProxyType

from app.schemas.capability import CapabilityContract, OperatorRef, OutputContract

CORE_EVIDENCE = ("cohort_cvr_comparison", "channel_cvr_comparison", "mix_within_decomposition")
CORE_ROLES = ("entity_id", "conversion_flag", "cohort", "acquisition_channel")
CORE_OUTPUT = OutputContract(contract_id="ConversionDiagnosisResult", version="1", required_evidence_types=CORE_EVIDENCE)
CORE_OPERATOR = OperatorRef(operator_id="conversion_decline_recipe", version="1")
REGISTRY_VERSION = "capability-registry@1"
GOAL_EVIDENCE = MappingProxyType({
    "conversion_decline": CORE_EVIDENCE,
    "cohort_cvr_comparison": ("cohort_cvr_comparison",),
    "channel_diagnosis": ("channel_cvr_comparison",),
    "mix_decomposition": ("mix_within_decomposition",),
    "funnel_diagnosis": ("funnel_comparison",),
    "touchpoint_allocation": ("touchpoint_allocation",),
    "causal_channel_effect": (),
})

_flagship = CapabilityContract(
    capability_id="conversion_decline_diagnosis", version="1", lifecycle="enabled",
    display_name="跨期用户转化诊断",
    supported_question_types=("conversion_change", "channel_comparison", "accounting_decomposition"),
    supported_business_goals=("conversion_decline", "cohort_cvr_comparison", "channel_diagnosis", "mix_decomposition"),
    required_field_roles=CORE_ROLES, optional_field_roles=("paid_first_order",),
    required_grain="unique_user", accepted_grains=("unique_user", "user_order_detail"),
    join_requirements=("no_join_execution", "persisted_left_join_base_roles_only", "base_user_population_must_match"),
    deterministic_operator=CORE_OPERATOR,
    supported_metrics=("user_count", "converted_user_count", "cvr", "share", "cvr_delta_pp", "channel_cvr_delta", "conversion_count_delta", "mix_effect_pp", "within_effect_pp"),
    supported_dimensions=("cohort", "acquisition_channel"), output_contract=CORE_OUTPUT,
    supported_claims=("observed_cohort_comparison", "observed_channel_comparison", "baseline_formula_accounting_decomposition", "metric_specific_ranking"),
    unsupported_claims=("causal_channel_effect", "complete_journey", "funnel_priority", "checkout_payment_claim", "unqualified_main_driver"),
    known_limitations=("funnel_not_implemented", "paid_first_order_cross_check_not_implemented", "channel_enter_exit_requires_policy", "single_owned_population", "no_natural_language_entailment_proof"),
    assumptions=("supplied_population_represents_business_population", "comparable_conversion_windows_and_tracking", "conversion_0_or_false_negative_1_or_true_positive"),
    confirmation_requirements=("authenticated_user_manual_analysis_post", "no_provider_execution", "source_mutation_prohibited"),
)
_legacy = CapabilityContract(
    capability_id="touchpoint_attribution_legacy", version="1", lifecycle="legacy_limited",
    display_name="旧版输入记录归因分摊",
    supported_question_types=("represented_record_allocation",), supported_business_goals=("touchpoint_allocation",),
    required_field_roles=("entity_id", "represented_touchpoint", "sortable_timestamp"),
    optional_field_roles=("conversion_flag",), required_grain="represented_record", accepted_grains=("represented_record",),
    join_requirements=("input_rows_are_represented_records_not_behavioral_events",),
    deterministic_operator=OperatorRef(operator_id="touchpoint_attribution", version="legacy-1"),
    supported_metrics=("allocated_conversion_value", "share_of_allocated_value", "represented_user_count", "represented_record_mean"),
    supported_dimensions=("represented_touchpoint",),
    output_contract=OutputContract(contract_id="LegacyAttributionResult", version="1", required_evidence_types=("touchpoint_allocation",)),
    supported_claims=("allocation_within_selected_model_and_represented_records",),
    unsupported_claims=("cohort_cvr_decline", "mix_decomposition", "causal_channel_effect", "complete_journey", "funnel_priority", "first_touch_conversion_dominance", "behavioral_touchpoint_mean", "acquisition_priority"),
    known_limitations=("legacy_manual_api_only_no_h1_execution_spec", "pooled_no_cohort_denominators", "one_input_row_one_represented_touchpoint", "timestamp_ties_follow_input_order"),
    assumptions=("missing_conversion_flag_assumes_converted", "present_conversion_uses_last_record_bool", "missing_value_assumes_one", "represented_record_mean_is_not_behavioral_touchpoint_mean"),
    confirmation_requirements=("existing_authenticated_manual_analysis_post", "not_provider_callable"),
)
CAPABILITIES = MappingProxyType({(c.capability_id, c.version): c for c in (_flagship, _legacy)})
