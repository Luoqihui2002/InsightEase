"""Honest legacy aggregates. Contradictory persisted Top3 data fails closed."""
from math import isfinite

from app.schemas.evidence import (Coverage, Dimension, Grain, MetricEvidence, Population, QualityEvidence,
                                  RankingEvidence, RankingMember, Ref)
from app.services.attribution_service import AttributionService
from app.services.evidence_common import close, common, finalize_evidence, quantity, require


def number(value):
    require(type(value) in (int, float) and isfinite(value))
    return value


def _ranking_rows(summary, models):
    """Return recorded Top3 rows or None when the historical artifact recorded none."""
    comparisons = summary.get('model_comparison')
    if comparisons in (None, []):
        return None
    require(isinstance(comparisons, list) and len(comparisons) == len(models))
    require(all(isinstance(row, dict) for row in comparisons))
    require(len({row.get('model') for row in comparisons}) == len(comparisons))
    require({row.get('model') for row in comparisons} == set(models))
    has_top3 = ['top3' in row for row in comparisons]
    if not any(has_top3):
        return None
    require(all(has_top3))
    return {row['model']: row for row in comparisons}


def _validate_allocations(entries):
    require(isinstance(entries, dict) and 0 < len(entries) <= 200)
    persisted_order = list(entries)
    for entry in entries.values():
        require(isinstance(entry, dict))
        require(number(entry.get('value')) >= 0 and 0 <= number(entry.get('percentage')) <= 100)
    total = sum(entry['value'] for entry in entries.values())
    require(total > 0)
    for entry in entries.values():
        tolerance = .0051 + 100 * (len(entries) + 1) * .00005 / total
        close(entry['percentage'], entry['value'] / total * 100, tolerance)
    return persisted_order


def _validated_persisted_ranking(model, entries, comparison):
    """Validate only. Returned members preserve the producer-recorded order and rank."""
    require(comparison.get('model_name') == AttributionService.ATTRIBUTION_MODELS.get(model, model))
    persisted_order = _validate_allocations(entries)
    values = [entries[name]['value'] for name in persisted_order]
    require(all(left >= right for left, right in zip(values, values[1:])))

    top = comparison.get('top3')
    expected_names = persisted_order[:min(3, len(entries))]
    require(isinstance(top, list) and len(top) == len(expected_names))
    require(all(isinstance(row, dict) for row in top))
    require([row.get('touchpoint') for row in top] == expected_names)
    require(len({row.get('touchpoint') for row in top}) == len(top))
    members = []
    for row, name in zip(top, expected_names):
        require(set(row) == {'touchpoint', 'value', 'percentage', 'rank', 'ties'})
        value = entries[name]['value']
        close(number(row.get('value')), value)
        close(number(row.get('percentage')), entries[name]['percentage'])
        expected_rank = 1 + sum(entry['value'] > value for entry in entries.values())
        require(type(row.get('rank')) is int and row['rank'] == expected_rank)
        expected_ties = tuple(sorted(candidate for candidate, entry in entries.items() if entry['value'] == value))
        ties = row.get('ties')
        require(isinstance(ties, list) and tuple(ties) == expected_ties)
        members.append(RankingMember(rank=row['rank'], ties=expected_ties, entity=row['touchpoint'],
                                     value=row['value'], unit='allocated_value'))
    return tuple(members)


def adapt_attribution(result, params, provenance):
    require(isinstance(result, dict) and isinstance(result.get('summary'), dict) and isinstance(result.get('models'), dict))
    summary, models = result['summary'], result['models']
    require(0 < len(models) <= 6 and set(models) <= set(AttributionService.ATTRIBUTION_MODELS))
    comparisons = _ranking_rows(summary, models)
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
    if comparisons is None:
        flags += ('legacy_ranking_not_recorded',)
    flags = tuple(sorted(set(flags)))
    key = params.get('user_id_col')
    require(isinstance(key, str) and bool(key))
    grain = Grain(semantic_ref=Ref(id='represented-user-grain', version='legacy-1'), entity='represented_user',
                  keys=(key,), row_semantics='joined_or_source_input_records')
    pop = Population(semantic_ref=Ref(id='represented-population', version='legacy-1'),
                     entity_type='represented_user', entity_key=key, population_kind='represented_population',
                     cohort_basis='not_recorded', cohort_field=None, cohort_values=(), time_window='not_recorded',
                     filter_scope='represented_input_users', new_customer_only=None,
                     registration_status_verified=None, population_role='represented')
    def base(metric, kind, scope, dimensions=()):
        return common(metric, kind, pop, grain, provenance, flags, scope, dimensions=dimensions)
    metric = MetricEvidence(**base('represented_record_mean', 'metric', ('represented_record_mean',)), value=mean,
                            numerator=quantity('represented_record_count', records), denominator=quantity('represented_user_count', users))
    quality = QualityEvidence(**base('input_quality', 'quality', ('quality_assessment',)), input_record_count=records,
                              unique_user_count=users, selected_user_count=users, excluded_other_cohort_count=None,
                              projection='legacy_not_verified', normalization_applied=None,
                              boolean_count=None, numeric_count=None, string_count=None)
    rankings = []
    allocations = []
    if comparisons is not None:
        for model in sorted(models):
            entries = models[model]
            members = _validated_persisted_ranking(model, entries, comparisons[model])
            rankings.append(RankingEvidence(**base('allocated_conversion_value', 'ranking', ('model_allocation',),
                            (Dimension(name='model', value=model),)), ranking_metric='allocated_conversion_value',
                            ranking_universe=tuple(sorted(entries)), direction='descending', included_count=len(members),
                            total_count=len(entries), transport_coverage=('complete' if len(members) == len(entries) else 'partial'),
                            members=members))
    else:
        # Full allocation values remain authoritative facts even when the historical
        # artifact did not persist an authoritative ranking view.
        for model in sorted(models):
            entries = models[model]
            _validate_allocations(entries)
            for touchpoint in sorted(entries):
                allocations.append(MetricEvidence(**base('allocated_conversion_value', 'metric', ('model_allocation',), (
                    Dimension(name='model', value=model), Dimension(name='touchpoint', value=touchpoint))),
                    value=entries[touchpoint]['value'], numerator=None, denominator=None))
    units = [metric, quality, *allocations, *rankings]
    transport = 'partial' if comparisons is None or any(r.transport_coverage == 'partial' for r in rankings) else 'complete'
    coverage = Coverage(core='partial', overall='unavailable', channels=('partial' if rankings else 'unavailable'),
                        decomposition='unavailable', funnel='missing_input', transport=transport)
    return [finalize_evidence(unit) for unit in units], coverage, flags
