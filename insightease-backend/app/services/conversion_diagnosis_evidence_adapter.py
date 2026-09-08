"""Repackage H1 persisted facts; reject inconsistency, never repair or rerun H1."""
from math import fsum, isclose

from app.schemas.capability import ConversionDiagnosisResult, ExecutionSpec
from app.schemas.evidence import (
    ChannelTerm, ComparisonEvidence, Coverage, DecompositionEvidence, Dimension, Grain,
    Population, QualityEvidence, RankingEvidence, RankingMember, RateObservation, Ratio, Ref,
)
from app.services.evidence_common import close, common, finalize_evidence, quantity, require
from app.services.evidence_definitions import METRICS

RANK_METRICS = {
    'channel_cvr_delta': 'channel_cvr_delta_pp', 'conversion_count_delta': 'conversion_count_delta',
    'mix_effect_pp': 'mix_effect_pp', 'within_effect_pp': 'within_effect_pp',
}


def validate_result(result: ConversionDiagnosisResult, spec: ExecutionSpec):
    require(result.operator_ref == spec.operator_ref)
    require(spec.capability_ref.capability_id == 'conversion_decline_diagnosis' and spec.capability_ref.version == '1')
    require(spec.operator_ref.operator_id == 'conversion_decline_recipe' and spec.operator_ref.version == '1')
    require(spec.required_output_contract.contract_id == 'ConversionDiagnosisResult' and spec.required_output_contract.version == '1')
    require(result.normalization_records == spec.authoritative_input_fingerprint.normalization_records)
    b, c = result.overall_comparison.baseline, result.overall_comparison.current
    require((b.cohort, c.cohort) == (spec.comparison_spec.baseline, spec.comparison_spec.current) and b.cohort != c.cohort)
    def rate(cell):
        require(cell.user_count > 0 and 0 <= cell.converted_user_count <= cell.user_count)
        close(cell.cvr, cell.converted_user_count / cell.user_count)
    rate(b)
    rate(c)
    close(result.overall_comparison.cvr_delta_pp, (c.cvr - b.cvr) * 100)
    channels = {r.channel: r for r in result.channel_comparison}
    require(0 < len(channels) == len(result.channel_comparison) <= 200)
    complete = all(r.baseline is not None and r.current is not None for r in channels.values())
    require(result.coverage.status == ('complete' if complete else 'partial'))
    for row in channels.values():
        require(row.baseline is not None or row.current is not None)
        for cell, overall in ((row.baseline, b), (row.current, c)):
            if cell:
                rate(cell)
                require(cell.cohort == overall.cohort)
                close(cell.share, cell.user_count / overall.user_count)
        left, right = row.baseline, row.current
        close(row.conversion_count_delta, (right.converted_user_count if right else 0) - (left.converted_user_count if left else 0))
        if left and right:
            close(row.channel_cvr_delta, (right.cvr - left.cvr) * 100)
            close(row.mix_effect_pp, (right.share - left.share) * left.cvr * 100)
            close(row.within_effect_pp, right.share * (right.cvr - left.cvr) * 100)
        else:
            require(row.channel_cvr_delta is None and row.mix_effect_pp is None and row.within_effect_pp is None)
    for side, overall in (('baseline', b), ('current', c)):
        cells = [getattr(r, side) for r in channels.values() if getattr(r, side)]
        require(sum(x.user_count for x in cells) == overall.user_count)
        require(sum(x.converted_user_count for x in cells) == overall.converted_user_count)
        close(fsum(x.share for x in cells), 1)
    dec = result.decomposition
    require(dec.coverage.status == ('complete' if complete else 'unavailable'))
    if complete:
        close(dec.mix_effect_pp, fsum(r.mix_effect_pp for r in channels.values()))
        close(dec.within_effect_pp, fsum(r.within_effect_pp for r in channels.values()))
        close(dec.reconciliation_residual_pp, result.overall_comparison.cvr_delta_pp - dec.mix_effect_pp - dec.within_effect_pp)
        close(dec.reconciliation_residual_pp, 0)
    else:
        require(dec.mix_effect_pp is None and dec.within_effect_pp is None and dec.reconciliation_residual_pp is None)
    require(len(result.rankings) == 4 and {r.ranking_metric for r in result.rankings} == set(RANK_METRICS))
    for ranking in result.rankings:
        eligible = {name: getattr(row, ranking.ranking_metric) for name, row in channels.items()
                    if getattr(row, ranking.ranking_metric) is not None}
        require(len(ranking.ranking_universe) == len(channels) and set(ranking.ranking_universe) == set(channels))
        require(len(ranking.items) == len(eligible) and {x.channel for x in ranking.items} == set(eligible))
        require(ranking.unit == ('count' if ranking.ranking_metric == 'conversion_count_delta' else 'percentage_point'))
        require(ranking.coverage.status == ('complete' if len(eligible) == len(channels) else 'partial'))
        require(list(x.channel for x in ranking.items) == sorted(eligible, key=lambda name: (eligible[name], name)))
        for item in ranking.items:
            close(item.value, eligible[item.channel])
            ties = {name for name, value in eligible.items() if isclose(value, item.value, rel_tol=0, abs_tol=1e-10)}
            require(set(item.ties) == ties and len(item.ties) == len(ties))
            require(item.rank == 1 + sum(value < item.value and name not in ties for name, value in eligible.items()))
    gs = result.input_grain_summary
    require(gs.selected_users == b.user_count + c.user_count)
    require(gs.unique_users == gs.selected_users + gs.excluded_other_cohort_users and gs.excluded_other_cohort_users >= 0)
    require(gs.input_rows >= gs.unique_users)
    require(gs.projection == ('identity' if spec.population_spec.grain == 'unique_user' else 'validated_user_projection'))
    if gs.projection == 'identity':
        require(gs.input_rows == gs.unique_users)
    require(result.optional_branches.funnel.status in ('not_requested', 'missing_input', 'blocked'))


def adapt_conversion(result, spec, provenance):
    validate_result(result, spec)
    fields = {b.role: b.column for b in spec.field_bindings}
    flags = tuple(sorted(set((*result.quality_flags, 'new_customer_qualification_not_verified',
                              'registration_population_not_verified', 'calendar_window_not_recorded'))))
    grain = Grain(semantic_ref=Ref(id='selected-user-grain', version='1'), entity='user',
                  keys=(fields['entity_id'],), row_semantics='unique_selected_user')
    def population(role, cohort=None, channel=None):
        return Population(semantic_ref=Ref(id='selected-cohort-population', version='1'),
                          entity_type='user', entity_key=fields['entity_id'],
                          population_kind='selected_cohort_population',
                          cohort_basis='bound_cohort_labels', cohort_field=fields['cohort'],
                          cohort_values=(cohort,) if cohort else (spec.comparison_spec.baseline, spec.comparison_spec.current),
                          time_window='cohort_labels_only_dates_not_recorded', filter_scope=spec.population_spec.scope,
                          new_customer_only=None, registration_status_verified=False,
                          population_role=role, channel=channel)
    overall = result.overall_comparison
    def observation(cell, role, channel=None):
        if cell is None:
            return None
        prefix = 'channel_' if channel is not None else ''
        numerator = 'channel_converted_count' if prefix else 'selected_cohort_converted_user_count'
        denominator = 'channel_user_count' if prefix else 'selected_cohort_user_count'
        share = None
        if channel is not None:
            total = overall.baseline if role == 'baseline' else overall.current
            share = Ratio(definition_ref=METRICS['channel_share'], value=cell.share, numerator=quantity('channel_user_count', cell.user_count),
                          denominator=quantity('selected_cohort_user_count', total.user_count))
        return RateObservation(definition_ref=METRICS['channel_cvr' if channel is not None else 'selected_cohort_conversion_rate'],
                               value=cell.cvr, numerator=quantity(numerator, cell.converted_user_count),
                               denominator=quantity(denominator, cell.user_count), share=share,
                               population=population(role, cell.cohort, channel))
    both_pop = population('comparison')
    base_obs, current_obs = observation(overall.baseline, 'baseline'), observation(overall.current, 'current')
    def base(metric, kind, scope, coverage='complete', channel=None):
        return common(metric, kind, population('comparison', channel=channel), grain, provenance, flags, scope, coverage,
                      (Dimension(name='acquisition_channel', value=channel),) if channel is not None else ())
    overall_ev = ComparisonEvidence(**base('cvr_delta_pp', 'comparison', ('population_rate', 'period_rate_difference')),
                                    baseline=base_obs, current=current_obs, delta=overall.cvr_delta_pp)
    channels = []
    terms = []
    for row in sorted(result.channel_comparison, key=lambda r: r.channel):
        b, c = observation(row.baseline, 'baseline', row.channel), observation(row.current, 'current', row.channel)
        channels.append(ComparisonEvidence(**base('channel_cvr_delta_pp', 'comparison',
                         ('segment_rate', 'segment_rate_difference', 'segment_share_difference'),
                         'complete' if b and c else 'partial', row.channel), baseline=b, current=c, delta=row.channel_cvr_delta))
        if result.decomposition.coverage.status == 'complete':
            terms.append(ChannelTerm(channel=row.channel, baseline=b, current=c,
                                     mix_effect_pp=row.mix_effect_pp, within_effect_pp=row.within_effect_pp))
    dec = DecompositionEvidence(**base('mix_within_decomposition', 'decomposition',
                                ('accounting_decomposition', 'descriptive_contribution'), result.decomposition.coverage.status),
                                formula_ref=Ref(id='baseline_rate_mix_current_share_within', version='1'),
                                baseline=base_obs, current=current_obs, total_delta=overall.cvr_delta_pp,
                                mix_effect=result.decomposition.mix_effect_pp, within_effect=result.decomposition.within_effect_pp,
                                reconciliation_residual=result.decomposition.reconciliation_residual_pp, members=tuple(terms))
    rankings = [RankingEvidence(**base(RANK_METRICS[r.ranking_metric], 'ranking', ('descriptive_contribution',), r.coverage.status),
                ranking_metric=RANK_METRICS[r.ranking_metric], ranking_universe=tuple(sorted(r.ranking_universe)), direction=r.direction,
                included_count=len(r.items), total_count=len(r.ranking_universe), transport_coverage='complete',
                members=tuple(RankingMember(rank=i.rank, ties=tuple(sorted(i.ties)), entity=i.channel,
                                            value=i.value, unit=r.unit) for i in r.items))
                for r in sorted(result.rankings, key=lambda r: r.ranking_metric)]
    records = result.normalization_records
    primary = next((r for r in records if r.dataset_id == spec.input_refs[0].dataset_id), None)
    gs = result.input_grain_summary
    quality = QualityEvidence(**common('input_quality', 'quality', both_pop, grain, provenance, flags, ('quality_assessment',)),
                              input_record_count=gs.input_rows, unique_user_count=gs.unique_users, selected_user_count=gs.selected_users,
                              excluded_other_cohort_count=gs.excluded_other_cohort_users, projection=gs.projection,
                              normalization_applied=primary.normalization_applied if primary else None,
                              boolean_count=primary.boolean_count if primary else None,
                              numeric_count=primary.numeric_count if primary else None, string_count=primary.string_count if primary else None)
    coverage = Coverage(core=result.coverage.status, overall='complete', channels=result.coverage.status,
                        decomposition=result.decomposition.coverage.status, funnel=result.optional_branches.funnel.status, transport='complete')
    # Required core and its limitations first; optional rank units yield before channels.
    units = [overall_ev, dec, quality, *channels, *rankings]
    return [finalize_evidence(unit) for unit in units], coverage, flags
