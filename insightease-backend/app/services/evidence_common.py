"""Shared identity helpers; all arithmetic here is consistency checking only."""
from math import isclose
from app.schemas.evidence import Quantity
from app.services.capability_input_service import canonical_hash
from app.services.evidence_definitions import METRICS, LIMITATIONS


class EvidenceError(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def require(condition):
    if not condition:
        raise EvidenceError('RESULT_CONTRACT_INCONSISTENT')


def close(actual, expected, tolerance=1e-10):
    require(actual is not None and expected is not None and isclose(actual, expected, rel_tol=0, abs_tol=tolerance))


def quantity(metric, value):
    return Quantity(definition_ref=METRICS[metric], value=value,
                    unavailable_reason='not_recorded' if value is None else None)


def common(metric, kind, population, grain, provenance, flags, scope, coverage='complete', dimensions=()):
    definition = METRICS[metric]
    identity = dict(analysis=provenance.source_analysis_ref.model_dump(), metric=definition.model_dump(),
                    population=population.model_dump(), dimensions=[d.model_dump() for d in dimensions],
                    evidence_type=kind, provenance=provenance.model_dump())
    return dict(evidence_id=canonical_hash(identity), metric_id=metric, metric_version=definition.version,
                label=definition.label, unit=definition.unit, definition_ref=definition,
                grain=grain, population=population, dimensions=dimensions, provenance=provenance,
                support_scope=scope, cannot_support=LIMITATIONS, quality_flags=flags,
                computation_coverage=coverage)
