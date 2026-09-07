"""Honest legacy aggregates. Missing historic lineage is never backfilled."""
from math import isfinite

from app.schemas.evidence import (Coverage, Dimension, Grain, MetricEvidence, Population,
                                  QualityEvidence, RankingEvidence, RankingMember)
from app.services.attribution_service import AttributionService
from app.services.evidence_common import close, common, quantity, require


def number(value):
    require(type(value) in (int, float) and isfinite(value))
    return value


def adapt_attribution(result, params, provenance):
    require(isinstance(result, dict) and isinstance(result.get('summary'), dict) and isinstance(result.get('models'), dict))
    summary, models = result['summary'], result['models']
    require(0 < len(models) <= 6 and set(models) <= set(AttributionService.ATTRIBUTION_MODELS))
    users = result.get('user_journey_count')
    require(type(users) is int and users > 0)
    mean = number(summary.get('avg_touchpoints_per_journey'))
    require(mean >= 1)
    records = summary.get('represented_record_count')
    if records is not None:
        require(type(records) is int and records >= users)
        require(summary.get('represented_user_count') == users)
        close(mean, round(records / users, 2))
    flags = ('legacy_limited', 'legacy_input_versions_not_recorded', 'legacy_execution_spec_not_recorded',
             'represented_records_not_behavioral_touchpoints', 'legacy_conversion_semantics_not_verified', 'mean_rounded_2dp')
    if records is None:
        flags += ('represented_record_count_not_recorded',)
    key = params.get('user_id_col')
    require(isinstance(key, str) and bool(key))
    grain = Grain(entity='represented_user', keys=(key,), row_semantics='joined_or_source_input_records')
    pop = Population(entity_type='represented_user', entity_key=key, cohort_basis='not_recorded', cohort_field=None,
                     cohort_values=(), time_window='not_recorded', filter_scope='represented_input_users', population_role='represented')
    def base(metric, kind, scope, dimensions=()):
        return common(metric, kind, pop, grain, provenance, flags, scope, dimensions=dimensions)
    metric = MetricEvidence(**base('represented_record_mean', 'metric', ('represented_record_mean',)), value=mean,
                            numerator=quantity('represented_record_count', records), denominator=quantity('represented_user_count', users))
    quality = QualityEvidence(**base('input_quality', 'quality', ('quality_assessment',)), input_record_count=records,
                              unique_user_count=users, selected_user_count=users, excluded_other_cohort_count=None,
                              projection='legacy_not_verified', normalization_applied=None,
                              boolean_count=None, numeric_count=None, string_count=None)
    comparisons = summary.get('model_comparison')
    require(isinstance(comparisons, list) and len(comparisons) == len(models))
    require({r.get('model') for r in comparisons} == set(models))
    rankings = []
    for model in sorted(models):
        entries = models[model]
        require(isinstance(entries, dict) and 0 < len(entries) <= 200)
        for entry in entries.values():
            require(isinstance(entry, dict))
            require(number(entry.get('value')) >= 0 and 0 <= number(entry.get('percentage')) <= 100)
        ordered = sorted(entries, key=lambda name: (-entries[name]['value'], name))
        total = sum(entry['value'] for entry in entries.values())
        require(total > 0)
        # Persisted model shares/values are rounded independently (4dp / 2dp).
        for entry in entries.values():
            tolerance = .0051 + 100 * (len(entries) + 1) * .00005 / total
            close(entry['percentage'], entry['value'] / total * 100, tolerance)
        top = next(r['top3'] for r in comparisons if r['model'] == model)
        require(isinstance(top, list) and len(top) == min(3, len(entries)))
        require(len({r.get('touchpoint') for r in top}) == len(top))
        for row in top:
            name = row.get('touchpoint')
            require(name in entries)
            close(number(row.get('percentage')), entries[name]['percentage'])
            require(entries[name]['value'] >= entries[ordered[len(top)-1]]['value'])
        members = []
        for name in ordered:
            value = entries[name]['value']
            ties = tuple(sorted(n for n in entries if entries[n]['value'] == value))
            rank = 1 + sum(e['value'] > value for e in entries.values())
            members.append(RankingMember(rank=rank, ties=ties, entity=name, value=value, unit='allocated_value'))
        rankings.append(RankingEvidence(**base('allocated_conversion_value', 'ranking', ('model_allocation',),
                        (Dimension(name='model', value=model),)), ranking_metric='allocated_conversion_value',
                        ranking_universe=tuple(sorted(entries)), direction='descending', included_count=len(members),
                        total_count=len(entries), transport_coverage='complete', members=tuple(members)))
    return [metric, quality, *rankings], Coverage(core='partial', overall='unavailable', channels='partial',
            decomposition='unavailable', funnel='missing_input', transport='complete'), flags
