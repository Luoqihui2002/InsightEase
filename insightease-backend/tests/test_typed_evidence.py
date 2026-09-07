"""H2 golden, hostile artifact, metamorphic and actual authenticated HTTP read tests."""
import asyncio
import copy
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pandas as pd
import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.schemas.capability import CapabilityPreflightRequest, ComparisonSpec
from app.schemas.evidence import EvidencePack, FORBIDDEN, SafeResultSummaryV2
from app.services.capability_registry import CORE_EVIDENCE, CORE_OUTPUT, CORE_ROLES
from app.services.capability_compiler import AuthoritativeInput, compile_candidate, execute_frozen
from app.services.capability_input_service import canonical_hash
from app.services.conversion_diagnosis_service import diagnose_conversion
from app.services.attribution_service import AttributionService
from app.services.evidence_common import EvidenceError
from app.services.evidence_definitions import METRICS
from app.services.evidence_service import build_evidence_pack, build_safe_result_summary_v2

DATA = Path(__file__).resolve().parents[2] / 'manual-test-data/demo-v1'
COLUMNS = dict(zip(CORE_ROLES, ('user_id', 'converted', 'cohort_period', 'acquisition_channel')))
PERIODS = ComparisonSpec(baseline='previous_month', current='recent_month')


@pytest.fixture
def users():
    return pd.read_csv(DATA / 'users.csv')


def request():
    return CapabilityPreflightRequest.model_validate(dict(candidate=dict(
        schema_version='candidate-plan@2', plan_id='h2-test', plan_version=1,
        user_question='Compare these cohorts', capability_ref=dict(capability_id='conversion_decline_diagnosis', version='1'),
        business_goal_ids=['conversion_decline'], required_evidence_types=list(CORE_EVIDENCE),
        field_bindings=[dict(dataset_ref=dict(dataset_id='users', version=None), column=c, role=r, provenance=None) for r, c in COLUMNS.items()],
        population_spec=dict(grain='unique_user', entity_role='entity_id', scope='all_input_users_in_selected_cohorts', conversion_policy='binary_required_missing_invalid'),
        comparison_spec=PERIODS.model_dump(), expected_output_contract=CORE_OUTPUT.model_dump()),
        requirements=dict(business_goal_ids=['conversion_decline'], required_evidence_types=list(CORE_EVIDENCE))))


def artifact(users):
    source = AuthoritativeInput('users', users, 'unique_user', 'test-schema', logical_frame=users)
    req = request()
    spec = compile_candidate(req, source).execution_spec
    assert spec is not None
    result = execute_frozen(req, spec, source)
    return SimpleNamespace(id='analysis-h2', user_id='owner', dataset_id='users', type='conversion_decline_diagnosis',
        status='completed', params=dict(execution_spec=spec.model_dump(mode='json'), expected_execution_spec_id=spec.execution_spec_id),
        result_data=result.model_dump(mode='json'), created_at=datetime(2026, 9, 7, tzinfo=timezone.utc),
        completed_at=datetime(2026, 9, 7, 1, tzinfo=timezone.utc))


def evidence(pack, kind, metric=None):
    return [e for e in pack.evidence if e.evidence_type == kind and (metric is None or e.metric_id == metric)]


def test_golden_population_denominators_channels_decomposition_rankings(users):
    pack = build_evidence_pack(artifact(users))
    summary = build_safe_result_summary_v2(pack)
    overall, = evidence(pack, 'comparison', 'cvr_delta_pp')
    assert (overall.baseline.denominator.value, overall.baseline.numerator.value, overall.baseline.value) == (1000, 240, .24)
    assert (overall.current.denominator.value, overall.current.numerator.value, overall.current.value) == (1000, 188, .188)
    assert overall.delta == pytest.approx(-5.2)
    assert overall.baseline.definition_ref.metric_id == 'new_customer_cvr'
    assert overall.baseline.definition_ref.version == '1'
    assert overall.grain.keys == ('user_id',)
    assert overall.grain.row_semantics == 'unique_registered_user'
    assert overall.population.cohort_values == ('previous_month', 'recent_month')
    assert overall.population.new_customer_only is None  # H1 assumption, not invented registration filtering.
    assert overall.population.time_window == 'cohort_labels_only_dates_not_recorded'
    dec, = summary.decompositions
    assert (dec.mix_effect, dec.within_effect, dec.total_delta) == pytest.approx((-2.56, -2.64, -5.2))
    assert dec.reconciliation_residual == pytest.approx(0, abs=1e-10)
    assert dec.formula_ref.version == '1'
    oracle = users.groupby(['cohort_period', 'acquisition_channel']).converted.agg(['size', 'sum', 'mean'])
    channels = evidence(pack, 'comparison', 'channel_cvr_delta_pp')
    assert len(channels) == len(dec.members) == 5
    for item in channels:
        for point in (item.baseline, item.current):
            row = oracle.loc[(point.population.cohort_values[0], item.population.channel)]
            assert point.denominator.value == row['size']
            assert point.numerator.value == row['sum']
            assert point.value == row['mean']
            assert point.share.value == row['size'] / 1000
            assert point.share.denominator.value == 1000
            assert point.definition_ref.metric_id == 'channel_cvr'
            assert point.share.definition_ref.metric_id == 'channel_share'
    expected = {'channel_cvr_delta_pp': 'social_ads', 'within_effect_pp': 'social_ads',
                'conversion_count_delta': 'organic', 'mix_effect_pp': 'organic'}
    assert {r.ranking_metric: r.members[0].entity for r in summary.rankings} == expected
    for r in summary.rankings:
        assert r.total_count == r.included_count == 5
        assert r.direction == 'ascending' and r.computation_coverage == 'complete'
        assert r.evidence_id in summary.evidence_refs
    assert pack.coverage.core == 'complete' and pack.coverage.funnel == 'not_requested'
    assert 'checkout' not in pack.model_dump_json() and 'payment_success' not in summary.model_dump_json()
    assert all('causal_effect' in e.cannot_support and 'budget_optimization' in e.cannot_support for e in pack.evidence)
    assert 'main_driver' not in summary.model_dump_json()
    assert not pack.omissions and len(pack.evidence) == 12
    assert summary.comparisons[0] == overall
    assert EvidencePack.model_validate_json(pack.model_dump_json()) == pack
    assert SafeResultSummaryV2.model_validate_json(summary.model_dump_json()) == summary
    assert len(summary.model_dump_json().encode()) < 256 * 1024


def legacy_artifact(users):
    orders = pd.read_csv(DATA / 'orders.csv')
    joined = users.merge(orders[['user_id', 'order_id']], on='user_id', how='left')
    result = AttributionService.attribution_analysis(joined, 'user_id', 'acquisition_channel', 'register_date',
                                                    conversion_col='converted', models=['first_touch', 'last_touch', 'linear'])
    a = artifact(users)
    a.type = 'attribution'
    a.result_data = result
    a.params = dict(user_id_col='user_id', touchpoint_col='acquisition_channel', timestamp_col='register_date', conversion_col='converted')
    return a


def test_true_metric_unsupported_scope_and_top3_values(users):
    a = legacy_artifact(users)
    pack = build_evidence_pack(a)
    summary = build_safe_result_summary_v2(pack)
    mean, = summary.key_metrics
    assert mean.value == 1.03 and mean.numerator.value == 2054 and mean.denominator.value == 2000
    assert mean.support_scope == ('represented_record_mean',)
    assert {'complete_customer_journey', 'first_touch_conversion_dominance', 'funnel_bottleneck', 'causal_acquisition_priority'} <= set(mean.cannot_support)
    assert mean.grain.row_semantics == 'joined_or_source_input_records'
    assert 'legacy_limited' in mean.quality_flags
    assert mean.provenance.execution_spec_ref is None
    assert mean.provenance.input_refs[0].version is None
    for ranking in summary.rankings:
        model = ranking.dimensions[0].value
        expected = sorted(a.result_data['models'][model].items(), key=lambda row: (-row[1]['value'], row[0]))[:3]
        assert [(m.entity, m.value) for m in ranking.members[:3]] == [(name, value['value']) for name, value in expected]
        assert [m.rank for m in ranking.members[:3]] == [1, 2, 3]
    assert [(m.entity, m.value) for m in summary.rankings[0].members[:3]] == [('organic', 150), ('search_ads', 128), ('social_ads', 64)]
    assert users.groupby('acquisition_channel').converted.sum().to_dict()['social_ads'] == 64
    assert '3 items' not in summary.model_dump_json()


def test_legacy_historical_unknown_operands_not_fabricated(users):
    a = legacy_artifact(users)
    del a.result_data['summary']['represented_record_count']
    del a.result_data['summary']['represented_user_count']
    item, = build_safe_result_summary_v2(build_evidence_pack(a)).key_metrics
    assert item.value == 1.03 and item.numerator.value is None
    assert item.numerator.unavailable_reason == 'not_recorded'
    assert 'represented_record_count_not_recorded' in item.quality_flags


@pytest.mark.parametrize('mutation', ['cvr', 'denominator', 'delta', 'mix', 'residual', 'channel_share', 'channel_term',
                                   'rank_entity', 'rank_value', 'rank_order', 'rank_ties', 'rank_universe', 'coverage', 'funnel', 'operator', 'normalization'])
def test_inconsistent_internal_result_rejects_not_repairs(users, mutation):
    a = artifact(users)
    r = a.result_data
    if mutation == 'cvr': r['overall_comparison']['baseline']['cvr'] = .30
    elif mutation == 'denominator': r['overall_comparison']['baseline']['user_count'] = 0
    elif mutation == 'delta': r['overall_comparison']['cvr_delta_pp'] = -10
    elif mutation == 'mix': r['decomposition']['mix_effect_pp'] = 0
    elif mutation == 'residual': r['decomposition']['reconciliation_residual_pp'] = 1
    elif mutation == 'channel_share': r['channel_comparison'][0]['baseline']['share'] = .8
    elif mutation == 'channel_term': r['channel_comparison'][0]['mix_effect_pp'] = 9
    elif mutation == 'rank_entity': r['rankings'][0]['items'][0]['channel'] = 'not_a_channel'
    elif mutation == 'rank_value': r['rankings'][0]['items'][0]['value'] = 42
    elif mutation == 'rank_order': r['rankings'][0]['items'].reverse()
    elif mutation == 'rank_ties': r['rankings'][0]['items'][0]['ties'] = []
    elif mutation == 'rank_universe': r['rankings'][0]['ranking_universe'] = ['invented']
    elif mutation == 'coverage': r['coverage']['status'] = 'partial'
    elif mutation == 'funnel': r['optional_branches']['funnel']['status'] = 'computed'
    elif mutation == 'operator': r['operator_ref']['version'] = '2'
    elif mutation == 'normalization': r['normalization_records'][0]['string_count'] = 1
    before = copy.deepcopy(r)
    with pytest.raises(EvidenceError, match='RESULT_CONTRACT_INCONSISTENT'):
        build_evidence_pack(a)
    assert r == before


def test_channel_enter_exit_boundary_remains_partial(users):
    a = artifact(users)
    frame = users.copy()
    frame.loc[(frame.cohort_period == 'recent_month') & (frame.acquisition_channel == 'push'), 'acquisition_channel'] = 'new_channel'
    # H1 creation correctly refuses full recipe coverage. Test the adapter with the
    # pure operator's boundary output, not a fabricated successfully compiled run.
    result = diagnose_conversion(frame, COLUMNS, PERIODS, 'unique_user')
    a.params['execution_spec']['authoritative_input_fingerprint']['normalization_records'] = []
    a.result_data = result.model_dump(mode='json')
    pack = build_evidence_pack(a)
    assert pack.coverage.overall == 'complete' and pack.coverage.channels == 'partial'
    dec, = build_safe_result_summary_v2(pack).decompositions
    assert dec.computation_coverage == 'unavailable'
    assert dec.mix_effect is None and dec.within_effect is None and dec.members == ()
    assert len([e for e in evidence(pack, 'comparison') if e.computation_coverage == 'partial']) == 2


def test_provenance_hash_stability_time_excluded(users):
    a = artifact(users)
    first = build_evidence_pack(a)
    a.completed_at += timedelta(days=1)
    second = build_evidence_pack(a)
    assert first.content_hash == second.content_hash and first.pack_id == second.pack_id
    assert first.evidence == second.evidence and first.produced_at != second.produced_at
    data = first.model_dump(mode='json', exclude={'produced_at', 'pack_id', 'content_hash'})
    assert canonical_hash(data) == first.content_hash


@pytest.mark.parametrize('component', ['execution_spec_id', 'fingerprint', 'policy', 'result_version'])
def test_provenance_mutation_changes_pack_identity(users, component):
    a = artifact(users)
    before = build_evidence_pack(a)
    s = a.params['execution_spec']
    if component == 'execution_spec_id':
        s['execution_spec_id'] = a.params['expected_execution_spec_id'] = 'changed'
    elif component == 'fingerprint': s['authoritative_input_fingerprint']['input']['semantic_state']['frame_hash'] = 'changed'
    elif component == 'policy': s['authoritative_input_fingerprint']['normalization_policy']['version'] = '2'
    else: a.result_version = 'archive-revision-2'
    after = build_evidence_pack(a)
    assert before.content_hash != after.content_hash
    assert {e.evidence_id for e in before.evidence}.isdisjoint(e.evidence_id for e in after.evidence)


def test_row_order_fact_invariance_provenance_changes(users):
    a, b = build_evidence_pack(artifact(users)), build_evidence_pack(artifact(users.sample(frac=1, random_state=77)))
    assert a.content_hash != b.content_hash
    for left, right in zip(a.evidence, b.evidence):
        assert left.model_dump(exclude={'evidence_id', 'provenance'}) == right.model_dump(exclude={'evidence_id', 'provenance'})


def test_duplicated_population_counts_double_rates_stable(users):
    clone = users.copy()
    clone.user_id += '-clone'
    summary = build_safe_result_summary_v2(build_evidence_pack(artifact(pd.concat([users, clone], ignore_index=True))))
    overall = summary.comparisons[0]
    assert (overall.baseline.denominator.value, overall.baseline.numerator.value) == (2000, 480)
    assert (overall.current.denominator.value, overall.current.numerator.value) == (2000, 376)
    assert (overall.baseline.value, overall.current.value, overall.delta) == pytest.approx((.24, .188, -5.2))
    assert (summary.decompositions[0].mix_effect, summary.decompositions[0].within_effect) == pytest.approx((-2.56, -2.64))


def test_identical_periods_no_wording_induced_decline(users):
    previous = users[users.cohort_period == 'previous_month'].copy()
    current = previous.copy()
    current.cohort_period = 'recent_month'
    current.user_id += '-current'
    summary = build_safe_result_summary_v2(build_evidence_pack(artifact(pd.concat([previous, current]))))
    assert summary.comparisons[0].delta == 0
    assert summary.decompositions[0].mix_effect == summary.decompositions[0].within_effect == 0


def test_unit_budget_keeps_atomic_core_and_reports_omissions():
    frame = pd.DataFrame([dict(user_id=f'{period}-{i}-{flag}', converted=flag, cohort_period=period, acquisition_channel=f'c{i:03}')
                          for period in ('previous_month', 'recent_month') for i in range(40) for flag in (0, 1)])
    pack = build_evidence_pack(artifact(frame))
    assert len(pack.evidence) == 32 and pack.coverage.core == 'complete' and pack.coverage.transport == 'partial'
    assert pack.omissions
    dec, = evidence(pack, 'decomposition')
    assert len(dec.members) == 40  # Never break required decomposition identity into a subset.
    assert all(m.baseline.denominator.value == 2 and m.current.denominator.value == 2 for m in dec.members)
    assert {o.evidence_type for o in pack.omissions} == {'comparison', 'ranking'}
    assert len(build_safe_result_summary_v2(pack).decompositions[0].members) == 40


def test_summary_top20_keeps_global_rank_and_marks_transport(users):
    a = legacy_artifact(users)
    values = {f'c{i:02}': {'value': float(30-i), 'percentage': round((30-i)/465*100, 2)} for i in range(30)}
    a.result_data['models'] = {'linear': values}
    a.result_data['summary']['model_comparison'] = [dict(model='linear', top3=[dict(touchpoint=n, percentage=e['percentage']) for n, e in list(values.items())[:3]])]
    pack = build_evidence_pack(a)
    summary = build_safe_result_summary_v2(pack)
    ranking, = summary.rankings
    assert ranking.members[0].entity == 'c00' and ranking.members[-1].entity == 'c19'
    assert ranking.members[-1].rank == 20 and ranking.members[-1].value == 11
    assert ranking.included_count == 20 and ranking.total_count == 30
    assert ranking.rank_scope == 'global_computed_universe'
    assert ranking.computation_coverage == 'complete' and ranking.transport_coverage == 'partial'
    assert summary.coverage.transport == 'partial' and summary.omissions[-1].total_count == 30
    assert len(evidence(pack, 'ranking')[0].members) == 30  # Projection did not mutate authority.


@pytest.mark.parametrize('key', sorted(FORBIDDEN))
def test_recursive_forbidden_key_rejected(users, key):
    data = build_evidence_pack(artifact(users)).model_dump(mode='json')
    data['evidence'][0]['baseline']['population'][key] = 'sensitive-sentinel'
    with pytest.raises(ValidationError): EvidencePack.model_validate(data)


@pytest.mark.parametrize('value', [float('nan'), float('inf'), float('-inf'), True, '0.24'])
def test_strict_numeric_contract(users, value):
    data = build_evidence_pack(artifact(users)).model_dump(mode='json')
    data['evidence'][0]['baseline']['value'] = value
    with pytest.raises(ValidationError): EvidencePack.model_validate(data)


@pytest.mark.parametrize('value', ['C:\\private\\input.csv', '/home/user/private', 'postgresql://user:pass@host',
                                  'api_key=hidden', 'SELECT * FROM customer', 'token'])
def test_sensitive_dimension_values_rejected(users, value):
    a = artifact(users)
    for row in a.result_data['channel_comparison']:
        if row['channel'] == 'push': row['channel'] = value
    for ranking in a.result_data['rankings']:
        ranking['ranking_universe'] = [value if n == 'push' else n for n in ranking['ranking_universe']]
        for item in ranking['items']:
            if item['channel'] == 'push': item['channel'] = value
            item['ties'] = [value if n == 'push' else n for n in item['ties']]
        ranking['items'].sort(key=lambda i: (i['value'], i['channel']))
    with pytest.raises(EvidenceError, match='RESULT_CONTRACT_INCONSISTENT'): build_evidence_pack(a)


def test_no_raw_rows_even_when_legacy_artifact_has_extra_sensitive_payload(users):
    a = legacy_artifact(users)
    a.result_data['raw_rows'] = [{'user_id': 'UNIQUE_RAW_SENTINEL', 'password': 'PRIVATE_SENTINEL'}]
    a.result_data['summary']['secret'] = 'PRIVATE_SENTINEL'
    a.params['db_url'] = 'PRIVATE_SENTINEL'
    pack = build_evidence_pack(a)
    summary = build_safe_result_summary_v2(pack)
    def scan(value):
        if isinstance(value, dict):
            assert not set(value).intersection(FORBIDDEN)
            for child in value.values(): scan(child)
        elif isinstance(value, list):
            for child in value: scan(child)
    for model in (pack, summary):
        scan(model.model_dump(mode='json'))
        assert 'PRIVATE_SENTINEL' not in model.model_dump_json() and 'UNIQUE_RAW_SENTINEL' not in model.model_dump_json()


def test_unknown_contract_and_unavailable_result(users):
    for kind in ('descriptive', 'forecast', 'arbitrary'):
        a = artifact(users)
        a.type = kind
        with pytest.raises(EvidenceError, match='UNSUPPORTED_CONTRACT'): build_evidence_pack(a)
    for status, result in [('pending', {}), ('failed', {}), ('completed', None)]:
        a = artifact(users)
        a.status, a.result_data = status, result
        with pytest.raises(EvidenceError, match='RESULT_UNAVAILABLE'): build_evidence_pack(a)


def test_http_ownership_server_authority_no_write_body_or_provider(users, monkeypatch):
    from app.api.v1.endpoints.analysis import router
    from app.core.database import get_db
    from app.api.v1.endpoints.auth import get_current_active_user
    from app.services import hermes_live_service
    monkeypatch.setattr(hermes_live_service, 'explain_result_with_live_hermes', AsyncMock(side_effect=AssertionError('provider forbidden')))
    a = artifact(users)
    query_log = []
    class DB:
        async def execute(self, query):
            params = query.compile().params
            query_log.append((str(query), params))
            found = a if a is not None and params.get('id_1') == a.id and params.get('user_id_1') == a.user_id else None
            return SimpleNamespace(scalar_one_or_none=lambda: found)
    app = FastAPI()
    app.include_router(router, prefix='/analysis')
    app.dependency_overrides[get_db] = lambda: DB()
    app.dependency_overrides[get_current_active_user] = lambda: SimpleNamespace(id='owner')
    async def scenario():
        nonlocal a
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            res = await client.get('/analysis/analysis-h2/evidence')
            assert res.status_code == 200
            pack = EvidencePack.model_validate(res.json()['data'])
            response = await client.request('GET', '/analysis/analysis-h2/safe-summary-v2', json={'evidence': [{'value': 999}]})
            assert response.status_code == 200
            summary = SafeResultSummaryV2.model_validate(response.json()['data'])
            assert summary.comparisons[0].baseline.value == .24
            assert summary.pack_content_hash == pack.content_hash
            assert (await client.post('/analysis/analysis-h2/evidence', json={'value': 999})).status_code == 405
            a.user_id = 'other-owner'
            assert (await client.get('/analysis/analysis-h2/evidence')).status_code == 404
            a.user_id = 'owner'
            a.status = 'failed'
            assert (await client.get('/analysis/analysis-h2/evidence')).status_code == 422
            a = None
            assert (await client.get('/analysis/analysis-h2/safe-summary-v2')).status_code == 404
    asyncio.run(scenario())
    assert all('analyses.user_id' in sql and params['user_id_1'] == 'owner' for sql, params in query_log)
    assert hermes_live_service.explain_result_with_live_hermes.await_count == 0


def test_metric_registry_is_static():
    assert METRICS['represented_record_mean'].version == 'legacy-1'
    with pytest.raises(TypeError): METRICS['new'] = METRICS['new_customer_cvr']


def test_required_semantic_unit_over_byte_budget_fails_explicitly(users, monkeypatch):
    from app.services import evidence_service
    monkeypatch.setattr(evidence_service, 'MAX_PACK_BYTES', 100)
    with pytest.raises(EvidenceError, match='SEMANTIC_UNIT_BUDGET_EXCEEDED'): build_evidence_pack(artifact(users))


@pytest.mark.parametrize('mutation', ['unknown_model', 'mean', 'records', 'top_entity', 'top_value', 'negative', 'nonfinite'])
def test_legacy_inconsistency_is_not_silently_repaired(users, mutation):
    a = legacy_artifact(users)
    r = a.result_data
    if mutation == 'unknown_model': r['models']['custom_code'] = r['models']['linear']
    elif mutation == 'mean': r['summary']['avg_touchpoints_per_journey'] = 9
    elif mutation == 'records': r['summary']['represented_record_count'] = 3000
    elif mutation == 'top_entity': r['summary']['model_comparison'][0]['top3'][0]['touchpoint'] = 'imaginary'
    elif mutation == 'top_value': r['summary']['model_comparison'][0]['top3'][0]['percentage'] = 99
    elif mutation == 'negative': r['models']['linear']['organic']['value'] = -1
    elif mutation == 'nonfinite': r['summary']['avg_touchpoints_per_journey'] = float('inf')
    with pytest.raises(EvidenceError, match='RESULT_CONTRACT_INCONSISTENT'): build_evidence_pack(a)


def test_summary_required_unit_budget_does_not_drop_denominators(users, monkeypatch):
    from app.services import evidence_service
    pack = build_evidence_pack(artifact(users))
    monkeypatch.setattr(evidence_service, 'MAX_SUMMARY_BYTES', 100)
    with pytest.raises(EvidenceError, match='SEMANTIC_UNIT_BUDGET_EXCEEDED'): build_safe_result_summary_v2(pack)


def test_empty_model_and_missing_frozen_spec_do_not_become_evidence(users):
    a = legacy_artifact(users)
    a.result_data['models'] = {}
    with pytest.raises(EvidenceError): build_evidence_pack(a)


def test_pack_byte_budget_drops_optional_units_before_rejecting_core(users, monkeypatch):
    from app.services import evidence_service
    a = artifact(users)
    full = build_evidence_pack(a)
    monkeypatch.setattr(evidence_service, 'MAX_PACK_BYTES', len(full.model_dump_json().encode()) - 100)
    bounded = build_evidence_pack(a)
    assert len(bounded.evidence) < len(full.evidence)
    assert bounded.evidence[:3] == full.evidence[:3]
    assert bounded.coverage.core == 'complete' and bounded.coverage.transport == 'partial'
    assert any(o.reason == 'semantic_unit_byte_budget' and o.transport_layer == 'pack' for o in bounded.omissions)
    a = artifact(users)
    del a.params['execution_spec']
    with pytest.raises(EvidenceError): build_evidence_pack(a)
