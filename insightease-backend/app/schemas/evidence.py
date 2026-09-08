"""Server-generated H2 evidence. Closed semantic units, never arbitrary result JSON."""
import re
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, model_validator
from app.schemas.capability import Contract

FORBIDDEN = frozenset({
    'raw_rows', 'rows', 'preview_rows', 'raw_data', 'full_table', 'result_data',
    'file_path', 'storage_path', 'absolute_path', 'db_url', 'connection_string',
    'api_key', 'token', 'password', 'secret', 'credentials', 'credential',
    'signed_url', 'sql', 'raw_sql', 'source_bytes',
})


def safe_text(value: str) -> str:
    if (value.casefold() in FORBIDDEN or re.search(
        r'(?i)(?:[a-z]:[\\/]|\\\\|://|^/|\b(?:select\s+.+\s+from|drop\s+table|insert\s+into)\b|'
        r'(?:api[_-]?key|password|secret|token)\s*[:=])', value
    )):
        raise ValueError('UNSAFE_EVIDENCE_METADATA')
    return value


Text = Annotated[str, Field(strict=True, min_length=1, max_length=200), AfterValidator(safe_text)]
Number = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Count = Annotated[int, Field(strict=True, ge=0)]
Unit = Literal['count', 'fraction', 'percentage_point', 'records_per_user', 'allocated_value', 'percent', 'status']
Support = Literal['population_count', 'population_rate', 'period_rate_difference', 'segment_rate',
                  'segment_rate_difference', 'segment_share_difference', 'accounting_decomposition',
                  'descriptive_contribution', 'represented_record_mean', 'model_allocation', 'quality_assessment']
Limitation = Literal['causal_effect', 'causal_channel_effect', 'complete_customer_journey',
                     'first_touch_conversion_dominance', 'funnel_bottleneck', 'budget_optimization',
                     'guaranteed_conversion_lift', 'user_quality_causal_change', 'causal_acquisition_priority']
Status = Literal['complete', 'partial', 'unavailable']


class EvidenceContract(Contract):
    @model_validator(mode='before')
    @classmethod
    def reject_forbidden_keys(cls, value):
        def visit(item):
            if isinstance(item, dict):
                for key, child in item.items():
                    if str(key).casefold() in FORBIDDEN:
                        raise ValueError('UNSAFE_EVIDENCE_METADATA')
                    visit(child)
            elif isinstance(item, (list, tuple)):
                for child in item:
                    visit(child)
        visit(value)
        return value


class Ref(EvidenceContract):
    id: Text
    version: Text


class InputRef(EvidenceContract):
    dataset_id: Text
    version: Text | None


class MetricDefinition(EvidenceContract):
    metric_id: Text
    version: Text
    label: Text
    unit: Unit
    formula_id: Text
    lifecycle: Literal['active', 'reserved'] = 'active'


class Grain(EvidenceContract):
    semantic_ref: Ref
    entity: Literal['user', 'represented_user']
    keys: tuple[Text, ...] = Field(min_length=1, max_length=4)
    row_semantics: Literal['unique_selected_user', 'joined_or_source_input_records']


class Population(EvidenceContract):
    semantic_ref: Ref
    entity_type: Literal['user', 'represented_user']
    entity_key: Text
    population_kind: Literal['selected_cohort_population', 'represented_population']
    cohort_basis: Literal['bound_cohort_labels', 'not_recorded']
    cohort_field: Text | None
    cohort_values: tuple[Text, ...] = Field(max_length=2)
    time_window: Literal['cohort_labels_only_dates_not_recorded', 'not_recorded']
    filter_scope: Literal['all_input_users_in_selected_cohorts', 'represented_input_users']
    new_customer_only: None = None  # H1 does not independently establish registration eligibility.
    registration_status_verified: bool | None
    population_role: Literal['baseline', 'current', 'comparison', 'represented']
    channel: Text | None = None


class Dimension(EvidenceContract):
    name: Literal['acquisition_channel', 'model', 'touchpoint']
    value: Text


class Provenance(EvidenceContract):
    source_analysis_ref: Ref
    capability_ref: Ref
    operator_ref: Ref
    execution_spec_ref: Ref | None
    input_refs: tuple[InputRef, ...] = Field(max_length=2)
    authoritative_input_fingerprint_hash: Text | None
    normalization_policy_ref: Ref | None
    normalization_policy_hash: Text | None
    normalization_records_hash: Text | None
    parameters_hash: Text
    comparison_baseline: Text | None
    comparison_current: Text | None
    adapter_ref: Ref
    grounding_eligibility: Literal['descriptive_only'] = 'descriptive_only'


class Quantity(EvidenceContract):
    definition_ref: MetricDefinition
    value: Number | None
    unavailable_reason: Literal['not_recorded'] | None = None

    @model_validator(mode='after')
    def availability(self):
        if (self.value is None) != (self.unavailable_reason is not None):
            raise ValueError('quantity availability mismatch')
        return self


class Ratio(EvidenceContract):
    definition_ref: MetricDefinition
    value: Number
    unit: Literal['fraction'] = 'fraction'
    numerator: Quantity
    denominator: Quantity


class RateObservation(Ratio):
    population: Population
    share: Ratio | None = None


class EvidenceBase(EvidenceContract):
    schema_version: Literal['evidence@1'] = 'evidence@1'
    evidence_id: Text
    metric_id: Text
    metric_version: Text
    label: Text
    unit: Unit
    definition_ref: MetricDefinition
    grain: Grain
    population: Population
    dimensions: tuple[Dimension, ...] = Field(max_length=2)
    provenance: Provenance
    support_taxonomy_ref: Ref
    support_scope: tuple[Support, ...] = Field(min_length=1, max_length=8)
    cannot_support: tuple[Limitation, ...] = Field(min_length=1, max_length=12)
    quality_flags: tuple[Text, ...] = Field(max_length=24)
    computation_coverage: Status


class MetricEvidence(EvidenceBase):
    evidence_type: Literal['metric'] = 'metric'
    value: Number
    numerator: Quantity | None
    denominator: Quantity | None


class ComparisonEvidence(EvidenceBase):
    evidence_type: Literal['comparison'] = 'comparison'
    baseline: RateObservation | None
    current: RateObservation | None
    delta: Number | None
    delta_unit: Literal['percentage_point'] = 'percentage_point'
    comparison_semantics: Literal['current_minus_baseline_two_disjoint_cohorts'] = 'current_minus_baseline_two_disjoint_cohorts'


class RankingMember(EvidenceContract):
    rank: Annotated[int, Field(strict=True, ge=1)]
    ties: tuple[Text, ...] = Field(max_length=200)
    entity: Text
    value: Number
    unit: Unit


class RankingEvidence(EvidenceBase):
    evidence_type: Literal['ranking'] = 'ranking'
    ranking_metric: Text
    ranking_universe: tuple[Text, ...] = Field(max_length=200)
    direction: Literal['ascending', 'descending']
    rank_scope: Literal['global_computed_universe'] = 'global_computed_universe'
    included_count: Count
    total_count: Count
    transport_coverage: Status
    members: tuple[RankingMember, ...] = Field(max_length=200)


class ChannelTerm(EvidenceContract):
    channel: Text
    baseline: RateObservation
    current: RateObservation
    mix_effect_pp: Number
    within_effect_pp: Number


class DecompositionEvidence(EvidenceBase):
    evidence_type: Literal['decomposition'] = 'decomposition'
    formula_ref: Ref
    baseline: RateObservation
    current: RateObservation
    total_delta: Number
    mix_effect: Number | None
    within_effect: Number | None
    reconciliation_residual: Number | None
    members: tuple[ChannelTerm, ...] = Field(max_length=200)


class QualityEvidence(EvidenceBase):
    evidence_type: Literal['quality'] = 'quality'
    input_record_count: Count | None
    unique_user_count: Count
    selected_user_count: Count
    excluded_other_cohort_count: Count | None
    projection: Literal['identity', 'validated_user_projection', 'legacy_not_verified']
    normalization_applied: bool | None
    boolean_count: Count | None
    numeric_count: Count | None
    string_count: Count | None


Evidence = Annotated[MetricEvidence | ComparisonEvidence | RankingEvidence | DecompositionEvidence | QualityEvidence,
                     Field(discriminator='evidence_type')]


class Coverage(EvidenceContract):
    core: Status
    overall: Status
    channels: Status
    decomposition: Status
    funnel: Literal['not_requested', 'missing_input', 'blocked', 'computed']
    transport: Status


class Omission(EvidenceContract):
    reason: Literal['evidence_unit_budget', 'ranking_member_budget', 'semantic_unit_byte_budget']
    transport_layer: Literal['pack', 'summary'] = 'pack'
    evidence_type: Literal['comparison', 'ranking', 'metric', 'quality', 'decomposition']
    evidence_id: Text | None
    included_count: Count
    total_count: Count
    selection_policy: Literal['required_core_then_channels_then_rankings@1', 'global_rank_prefix@1']


class EvidencePack(EvidenceContract):
    schema_version: Literal['EvidencePack@1'] = 'EvidencePack@1'
    pack_id: Text
    pack_version: Literal['1'] = '1'
    provenance: Provenance
    produced_at: Text
    coverage: Coverage
    evidence: tuple[Evidence, ...] = Field(min_length=1, max_length=32)
    omissions: tuple[Omission, ...] = Field(max_length=32)
    quality_summary: tuple[Text, ...] = Field(max_length=24)
    content_hash: Text


class SafeResultSummaryV2(EvidenceContract):
    schema_version: Literal['SafeResultSummary@2'] = 'SafeResultSummary@2'
    pack_ref: Ref
    pack_content_hash: Text
    analysis_ref: Ref
    capability_ref: Ref
    coverage: Coverage
    key_metrics: tuple[MetricEvidence, ...] = Field(max_length=32)
    comparisons: tuple[ComparisonEvidence, ...] = Field(max_length=32)
    rankings: tuple[RankingEvidence, ...] = Field(max_length=6)
    decompositions: tuple[DecompositionEvidence, ...] = Field(max_length=1)
    quality: tuple[QualityEvidence, ...] = Field(max_length=2)
    quality_flags: tuple[Text, ...] = Field(max_length=24)
    limitations: tuple[Limitation, ...] = Field(max_length=12)
    omissions: tuple[Omission, ...] = Field(max_length=64)
    evidence_refs: tuple[Text, ...] = Field(max_length=32)

    @model_validator(mode='after')
    def bounded_rankings(self):
        if any(len(r.members) > 20 for r in self.rankings):
            raise ValueError('SUMMARY_RANKING_BUDGET')
        return self
