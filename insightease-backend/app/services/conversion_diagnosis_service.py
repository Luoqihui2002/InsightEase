"""Pure deterministic conversion recipe. No provider, storage, SQL or writes."""
from math import fsum, isclose

import pandas as pd

from app.schemas.capability import (
    ChannelComparison, ChannelMetrics, CohortMetrics, ComparisonSpec,
    ConversionDiagnosisResult, Coverage, Decomposition, FunnelBranch,
    InputGrainSummary, OptionalBranches, OverallComparison, Ranking, RankingItem,
)
from app.services.capability_registry import CORE_OPERATOR, CORE_ROLES


class DiagnosisError(ValueError):
    def __init__(self, code: str, status: str = "data_invalid"):
        super().__init__(code)
        self.code = code
        self.status = status


def project_users(frame: pd.DataFrame, columns: dict[str, str], grain: str) -> pd.DataFrame:
    """Reject ambiguity before removing identical population projections."""
    if grain not in {"unique_user", "user_order_detail"}:
        raise DiagnosisError("UNSUPPORTED_GRAIN", "unsupported")
    if set(CORE_ROLES) - columns.keys():
        raise DiagnosisError("MISSING_FIELD_ROLE", "needs_clarification")
    selected = [columns[r] for r in CORE_ROLES]
    if len(set(selected)) != len(selected) or not frame.columns.is_unique:
        raise DiagnosisError("AMBIGUOUS_FIELD_BINDING")
    if any(c not in frame for c in selected):
        raise DiagnosisError("UNKNOWN_COLUMN", "needs_clarification")
    if len(frame) > 1_000_000:
        raise DiagnosisError("INPUT_ROW_LIMIT", "unsupported")
    population = frame[selected].copy()
    population.columns = list(CORE_ROLES)
    if population.isna().any().any():
        raise DiagnosisError("MISSING_POPULATION_ATTRIBUTE")
    for role in ("entity_id", "cohort", "acquisition_channel"):
        # Category values are explicit strings, not coerced aliases or numbers.
        if not population[role].map(lambda v: isinstance(v, str) and 0 < len(v.strip()) <= 200).all():
            raise DiagnosisError("INVALID_CATEGORY_OR_ENTITY")
    values = population["conversion_flag"]
    if not values.isin([0, 1, True, False]).all():
        raise DiagnosisError("INVALID_CONVERSION_FLAG")
    population["conversion_flag"] = values.astype(int)
    conflicts = population.groupby("entity_id", sort=False)[list(CORE_ROLES[1:])].nunique(dropna=False)
    if (conflicts > 1).any().any():
        raise DiagnosisError("CONFLICTING_USER_ATTRIBUTES")
    if grain == "unique_user" and population["entity_id"].duplicated().any():
        raise DiagnosisError("UNIQUE_USER_GRAIN_VIOLATION")
    # Every attribute is proven identical. No first/last/max business choice.
    return population.drop_duplicates().sort_values("entity_id").reset_index(drop=True)


def diagnose_conversion(frame: pd.DataFrame, columns: dict[str, str], comparison: ComparisonSpec, grain: str) -> ConversionDiagnosisResult:
    users = project_users(frame, columns, grain)
    if comparison.baseline == comparison.current:
        raise DiagnosisError("COHORTS_NOT_DISJOINT")
    periods = (comparison.baseline, comparison.current)
    parts = [users[users.cohort == period] for period in periods]
    if any(part.empty for part in parts):
        raise DiagnosisError("INSUFFICIENT_POPULATION")
    overall = tuple(CohortMetrics(cohort=p, user_count=len(part), converted_user_count=int(part.conversion_flag.sum()), cvr=float(part.conversion_flag.mean())) for p, part in zip(periods, parts))
    channels = sorted(set(parts[0].acquisition_channel) | set(parts[1].acquisition_channel))
    if len(channels) > 200:
        raise DiagnosisError("CHANNEL_LIMIT", "unsupported")
    rows = []
    for channel in channels:
        metrics = []
        for period, part in zip(periods, parts):
            cell = part[part.acquisition_channel == channel]
            metrics.append(ChannelMetrics(cohort=period, user_count=len(cell), converted_user_count=int(cell.conversion_flag.sum()), cvr=float(cell.conversion_flag.mean()), share=len(cell) / len(part)) if len(cell) else None)
        b, c = metrics
        both = b is not None and c is not None
        rows.append(ChannelComparison(
            channel=channel, baseline=b, current=c,
            channel_cvr_delta=(c.cvr - b.cvr) * 100 if both else None,
            conversion_count_delta=(c.converted_user_count if c else 0) - (b.converted_user_count if b else 0),
            mix_effect_pp=(c.share - b.share) * b.cvr * 100 if both else None,
            within_effect_pp=c.share * (c.cvr - b.cvr) * 100 if both else None,
        ))
    complete = all(r.baseline is not None and r.current is not None for r in rows)
    delta = (overall[1].cvr - overall[0].cvr) * 100
    mix = fsum(r.mix_effect_pp for r in rows) if complete else None
    within = fsum(r.within_effect_pp for r in rows) if complete else None
    residual = delta - mix - within if complete else None
    if complete and not isclose(residual, 0, abs_tol=1e-10):
        raise DiagnosisError("DECOMPOSITION_RECONCILIATION_FAILED")
    coverage = Coverage(status="complete" if complete else "partial", reason=None if complete else "channel_enter_exit_requires_policy")
    rankings = []
    for metric in ("channel_cvr_delta", "conversion_count_delta", "within_effect_pp", "mix_effect_pp"):
        # Decomposition rankings cannot imply a full decomposition on enter/exit.
        eligible = [r for r in rows if getattr(r, metric) is not None]
        eligible.sort(key=lambda r: (getattr(r, metric), r.channel))
        items = []
        for row in eligible:
            value = getattr(row, metric)
            tied = tuple(sorted(r.channel for r in eligible if isclose(getattr(r, metric), value, rel_tol=0, abs_tol=1e-10)))
            rank = 1 + sum(getattr(r, metric) < value and r.channel not in tied for r in eligible)
            items.append(RankingItem(channel=row.channel, value=value, rank=rank, ties=tied))
        rankings.append(Ranking(ranking_metric=metric, ranking_universe=tuple(channels), unit="count" if metric == "conversion_count_delta" else "percentage_point", coverage=Coverage(status="complete" if len(eligible) == len(channels) else "partial", reason=None if len(eligible) == len(channels) else "channel_enter_exit_requires_policy"), items=tuple(items)))
    selected_count = sum(p.user_count for p in overall)
    return ConversionDiagnosisResult(
        operator_ref=CORE_OPERATOR,
        overall_comparison=OverallComparison(baseline=overall[0], current=overall[1], cvr_delta_pp=delta),
        channel_comparison=tuple(rows), rankings=tuple(rankings),
        decomposition=Decomposition(mix_effect_pp=mix, within_effect_pp=within, reconciliation_residual_pp=residual, coverage=Coverage(status="complete" if complete else "unavailable", reason=coverage.reason)),
        coverage=coverage,
        quality_flags=("observational_not_causal", "funnel_not_implemented", "paid_first_order_not_cross_checked"),
        input_grain_summary=InputGrainSummary(input_rows=len(frame), unique_users=len(users), selected_users=selected_count, excluded_other_cohort_users=len(users)-selected_count, projection="validated_user_projection" if grain == "user_order_detail" else "identity"),
        optional_branches=OptionalBranches(funnel=FunnelBranch(status="not_requested", reason="not_implemented")),
    )
