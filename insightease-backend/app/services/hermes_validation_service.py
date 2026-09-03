"""Validation helpers for bounded Hermes requests and advisory plans."""

from __future__ import annotations

import json
from typing import Any, Dict

from app.schemas.assistant import (
    AnalysisRelationshipRequirement,
    AssistantAnalysisPlan,
    AssistantCandidateDataset,
    AssistantNextAction,
    BoundedPlanningContext,
)


MAX_REQUEST_BYTES = 256 * 1024
MAX_SAFE_TABLES = 3
MAX_TABLE_ROWS = 5
MAX_TABLE_COLUMNS = 12
MAX_DATASETS = 20
MAX_SCHEMA_COLUMNS = 100
MAX_TOTAL_SCHEMA_COLUMNS = 500
MAX_RELATIONSHIP_EDGES = 200
MAX_HINT_ITEMS = 8
MAX_HINT_TEXT_CHARS = 500

FORBIDDEN_KEYS = {
    "raw_rows",
    "raw_data",
    "full_table",
    "result_data",
    "storage_path",
    "file_path",
    "credentials",
    "credential",
    "secret",
    "token",
    "api_key",
    "password",
    "connection_string",
    "signed_url",
}

ALLOWED_SAFETY_PATHS = {
    "safety.allow_raw_data",
    "safety.allow_auto_run",
    "safety.allow_sql_generation",
    "safety.allow_dataset_mutation",
    "safety.require_user_confirmation_for_execution",
}

SAFETY_FLAG_KEYS = {
    "allow_raw_data",
    "allow_auto_run",
    "allow_sql_generation",
    "allow_dataset_mutation",
    "require_user_confirmation_for_execution",
}


class HermesValidationError(ValueError):
    def __init__(
        self,
        code: str,
        message: str,
        user_message: str,
        *,
        retryable: bool = False,
        fallback_available: bool = True,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.user_message = user_message
        self.retryable = retryable
        self.fallback_available = fallback_available

    def to_detail(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "user_message": self.user_message,
            "retryable": self.retryable,
            "fallback_available": self.fallback_available,
        }


def validate_explain_result_payload(payload: Dict[str, Any]) -> None:
    _validate_payload_size(payload)
    _reject_forbidden_keys(payload)

    result_summary = payload.get("result_summary")
    if not isinstance(result_summary, dict):
        raise HermesValidationError(
            "INVALID_RESULT_SUMMARY",
            "result_summary must be an object.",
            "Result summary format is invalid, so the local fallback should be used.",
        )

    _validate_safe_result_summary(result_summary)


def validate_plan_analysis_payload(payload: Dict[str, Any]) -> None:
    _validate_payload_size(payload)
    _reject_forbidden_keys(payload)

    context = payload.get("assistant_context")
    if not isinstance(context, dict):
        raise HermesValidationError(
            "INVALID_REQUEST",
            "assistant_context must be an object.",
            "Assistant context format is invalid, so the local planner should be used.",
        )

    _validate_planning_context(context)

    history_summary = context.get("analysis_history_summary")
    if isinstance(history_summary, dict):
        _validate_safe_result_summary(history_summary)


def validate_and_normalize_analysis_plan(
    plan: AssistantAnalysisPlan,
    context: BoundedPlanningContext,
    user_question: str,
) -> AssistantAnalysisPlan:
    """Validate every provider reference against allowed metadata context."""
    dataset_by_id = {dataset.id: dataset for dataset in context.datasets}
    allowed_dataset_ids = set(dataset_by_id)

    if not set(context.selected_dataset_ids).issubset(allowed_dataset_ids):
        raise _invalid_plan("Selected dataset ids are outside the bounded dataset context.")
    if context.selected_dataset_id and context.selected_dataset_id not in allowed_dataset_ids:
        raise _invalid_plan("Selected dataset id is outside the bounded dataset context.")

    required_ids = _unique_strings(plan.required_dataset_ids)
    candidate_ids = _unique_strings(
        [*plan.candidate_dataset_ids, *(item.dataset_id for item in plan.candidate_datasets)]
    )
    reference_ids = _unique_strings(plan.reference_dataset_ids)

    for label, ids in (
        ("required", required_ids),
        ("candidate", candidate_ids),
        ("reference", reference_ids),
    ):
        unknown = set(ids) - allowed_dataset_ids
        if unknown:
            raise _invalid_plan(f"Plan references unknown {label} dataset ids.")

    if set(required_ids) & set(candidate_ids):
        raise _invalid_plan("Required datasets cannot also be candidate datasets.")

    required_id_set = set(required_ids)
    normalized_fields = []
    for field in plan.required_fields:
        if field.dataset_id not in required_id_set:
            raise _invalid_plan("A required field references a non-required dataset.")
        allowed_columns = _column_names(dataset_by_id[field.dataset_id])
        if any(column not in allowed_columns for column in field.candidate_columns):
            raise _invalid_plan("A required field references an unknown schema column.")
        normalized_fields.append(field)

    normalized_metrics = []
    for metric in plan.metrics:
        if metric.dataset_id not in required_id_set:
            raise _invalid_plan("A metric references a non-required dataset.")
        if metric.field and metric.field not in _column_names(dataset_by_id[metric.dataset_id]):
            raise _invalid_plan("A metric references an unknown schema column.")
        normalized_metrics.append(metric)

    normalized_relationships = _validate_plan_relationships(
        plan.required_relationships,
        context,
        dataset_by_id,
        required_id_set,
    )

    candidate_by_id = {item.dataset_id: item for item in plan.candidate_datasets}
    normalized_candidates = [
        AssistantCandidateDataset(
            dataset_id=dataset_id,
            dataset_name=_dataset_name(dataset_by_id[dataset_id]),
            reasons=candidate_by_id.get(dataset_id).reasons[:8]
            if dataset_id in candidate_by_id
            else ["Hermes identified this dataset as optional context."],
            confidence=candidate_by_id.get(dataset_id).confidence
            if dataset_id in candidate_by_id
            else "medium",
        )
        for dataset_id in candidate_ids
    ]

    readiness = _normalized_readiness(
        plan,
        required_ids,
        normalized_relationships,
    )
    next_action, next_actions = _normalized_next_actions(
        readiness,
        plan.recommended_analysis_type,
    )

    warnings = _unique_strings(plan.warnings)
    if len(required_ids) > 1:
        warnings = _unique_strings([
            *warnings,
            "Multiple source datasets require a user-reviewed analysis dataset step; no join has been executed.",
        ])
    if any(item.status == "requires_confirmation" for item in normalized_relationships):
        warnings = _unique_strings([
            *warnings,
            "At least one required relationship is not confirmed in the active Relationship Set.",
        ])

    return AssistantAnalysisPlan.model_validate(
        {
            **plan.model_dump(),
            "user_question": user_question,
            "required_dataset_ids": required_ids,
            "required_datasets": [_dataset_name(dataset_by_id[item]) for item in required_ids],
            "candidate_dataset_ids": candidate_ids,
            "candidate_datasets": normalized_candidates,
            "reference_dataset_ids": reference_ids,
            "required_fields": normalized_fields,
            "required_relationships": normalized_relationships,
            "metrics": normalized_metrics,
            "relationship_set_id": context.relationship_set.id if context.relationship_set else None,
            "relationship_set_name": context.relationship_set.name if context.relationship_set else None,
            "warnings": warnings[:20],
            "execution_readiness": readiness,
            "next_action": next_action,
            "next_actions": next_actions,
            "source": "hermes_live",
            "fallback_used": False,
        }
    )


def _validate_plan_relationships(
    relationships: list[AnalysisRelationshipRequirement],
    context: BoundedPlanningContext,
    dataset_by_id: dict[str, Any],
    required_dataset_ids: set[str],
) -> list[AnalysisRelationshipRequirement]:
    confirmed = context.relationship_set.relationships if context.relationship_set else []
    normalized = []

    for relationship in relationships:
        endpoint_ids = {
            relationship.source_dataset_id,
            relationship.target_dataset_id,
        }
        if not endpoint_ids.issubset(required_dataset_ids):
            raise _invalid_plan("A relationship references datasets outside the required subset.")
        if relationship.source_dataset_id not in dataset_by_id or relationship.target_dataset_id not in dataset_by_id:
            raise _invalid_plan("A relationship references an unknown dataset.")
        if relationship.source_column not in _column_names(dataset_by_id[relationship.source_dataset_id]):
            raise _invalid_plan("A relationship references an unknown source column.")
        if relationship.target_column not in _column_names(dataset_by_id[relationship.target_dataset_id]):
            raise _invalid_plan("A relationship references an unknown target column.")

        match = next(
            (candidate for candidate in confirmed if _same_relationship(relationship, candidate)),
            None,
        )
        if relationship.status == "confirmed" and match is None:
            raise _invalid_plan("Hermes claimed an unconfirmed relationship was confirmed.")

        if match is not None:
            normalized.append(
                relationship.model_copy(
                    update={
                        "relationship_id": match.id or relationship.relationship_id,
                        "status": "confirmed",
                        "relationship_type": match.relationship_type or relationship.relationship_type,
                        "risk_level": match.risk_level or relationship.risk_level,
                    }
                )
            )
        else:
            normalized.append(relationship)

    return normalized


def _same_relationship(requirement: AnalysisRelationshipRequirement, candidate: Any) -> bool:
    direct = (
        requirement.source_dataset_id == candidate.source_dataset_id
        and requirement.source_column == candidate.source_column
        and requirement.target_dataset_id == candidate.target_dataset_id
        and requirement.target_column == candidate.target_column
    )
    reverse = (
        requirement.source_dataset_id == candidate.target_dataset_id
        and requirement.source_column == candidate.target_column
        and requirement.target_dataset_id == candidate.source_dataset_id
        and requirement.target_column == candidate.source_column
    )
    return direct or reverse


def _normalized_readiness(
    plan: AssistantAnalysisPlan,
    required_dataset_ids: list[str],
    relationships: list[AnalysisRelationshipRequirement],
) -> str:
    if plan.execution_readiness == "unsupported":
        return "unsupported"
    if not required_dataset_ids:
        return "needs_clarification"
    if plan.clarifying_questions:
        return "needs_clarification"
    if any(field.required and not field.candidate_columns for field in plan.required_fields):
        return "needs_clarification"
    if any(item.status == "requires_confirmation" for item in relationships):
        return "needs_clarification"
    if len(required_dataset_ids) > 1:
        if not _relationships_connect_required_datasets(required_dataset_ids, relationships):
            return "needs_clarification"
        return "needs_join"
    return "ready_single_table"


def _relationships_connect_required_datasets(
    required_dataset_ids: list[str],
    relationships: list[AnalysisRelationshipRequirement],
) -> bool:
    if len(required_dataset_ids) < 2:
        return True
    adjacency = {dataset_id: set() for dataset_id in required_dataset_ids}
    for relationship in relationships:
        adjacency[relationship.source_dataset_id].add(relationship.target_dataset_id)
        adjacency[relationship.target_dataset_id].add(relationship.source_dataset_id)
    visited = set()
    pending = [required_dataset_ids[0]]
    while pending:
        dataset_id = pending.pop()
        if dataset_id in visited:
            continue
        visited.add(dataset_id)
        pending.extend(adjacency[dataset_id] - visited)
    return visited == set(required_dataset_ids)


def _normalized_next_actions(readiness: str, analysis_type: str) -> tuple[str, list[AssistantNextAction]]:
    if readiness == "ready_single_table":
        return "review_plan", [
            AssistantNextAction(
                type="navigate",
                label="确认计划并进入分析页",
                target=_analysis_target(analysis_type),
            )
        ]
    if readiness == "needs_join":
        return "create_analysis_dataset", [
            AssistantNextAction(
                type="warning",
                label="需要创建多表分析数据集",
            )
        ]
    if readiness == "unsupported":
        return "clarify", [AssistantNextAction(type="warning", label="当前不支持该分析类型")]
    return "clarify", [AssistantNextAction(type="confirm", label="请补充信息后重新生成计划")]


def _analysis_target(analysis_type: str) -> str:
    return {
        "descriptive": "/app/statistics",
        "data_overview": "/app/data-overview",
        "attribution": "/app/attribution",
        "forecast": "/app/forecast",
        "path_analysis": "/app/path",
        "ab_test": "/app/statistics",
        "regression": "/app/statistics",
        "smart_process": "/app/data-workshop",
        "visualization": "/app/visualization",
    }[analysis_type]


def _dataset_name(dataset: Any) -> str:
    return dataset.filename or dataset.name or dataset.id


def _column_names(dataset: Any) -> set[str]:
    return {column.name for column in dataset.columns}


def _unique_strings(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _invalid_plan(message: str) -> HermesValidationError:
    return HermesValidationError(
        "INVALID_PLAN_RESPONSE",
        message,
        "Hermes returned a plan outside the allowed metadata context, so InsightEase used the deterministic fallback.",
    )


def _validate_payload_size(payload: Dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    if len(encoded) > MAX_REQUEST_BYTES:
        raise HermesValidationError(
            "CONTEXT_TOO_LARGE",
            f"Request body exceeds {MAX_REQUEST_BYTES} bytes.",
            "The assistant context is too large, so InsightEase will use the local fallback.",
        )


def _validate_safe_result_summary(summary: Dict[str, Any]) -> None:
    tables = summary.get("tables", [])
    if tables is None:
        tables = []
    if not isinstance(tables, list):
        raise HermesValidationError(
            "INVALID_RESULT_SUMMARY",
            "result_summary.tables must be a list.",
            "Result table summary format is invalid, so the local fallback should be used.",
        )
    if len(tables) > MAX_SAFE_TABLES:
        raise HermesValidationError(
            "SUMMARY_TOO_LARGE",
            f"SafeResultSummary contains more than {MAX_SAFE_TABLES} tables.",
            "The result summary is too large for Hermes dry-run validation.",
        )

    for table in tables:
        if not isinstance(table, dict):
            continue
        columns = table.get("columns", [])
        rows = table.get("rows", [])
        if isinstance(columns, list) and len(columns) > MAX_TABLE_COLUMNS:
            raise HermesValidationError(
                "SUMMARY_TOO_LARGE",
                f"SafeResultSummary table contains more than {MAX_TABLE_COLUMNS} columns.",
                "The result summary has too many preview columns for Hermes dry-run validation.",
            )
        if isinstance(rows, list) and len(rows) > MAX_TABLE_ROWS:
            raise HermesValidationError(
                "SUMMARY_TOO_LARGE",
                f"SafeResultSummary table contains more than {MAX_TABLE_ROWS} rows.",
                "The result summary has too many preview rows for Hermes dry-run validation.",
            )
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict) and len(row.keys()) > MAX_TABLE_COLUMNS:
                    raise HermesValidationError(
                        "SUMMARY_TOO_LARGE",
                        f"SafeResultSummary row contains more than {MAX_TABLE_COLUMNS} columns.",
                        "The result summary has too many preview columns for Hermes dry-run validation.",
                    )

    hints = summary.get("explanation_hints")
    if isinstance(hints, dict):
        _validate_explanation_hints(hints)


def _validate_explanation_hints(hints: Dict[str, Any]) -> None:
    list_fields = {
        "selected_fields",
        "primary_metric_names",
        "primary_metric_interpretation",
        "module_specific_findings",
        "chart_summaries",
        "table_summaries",
        "limitations",
        "recommended_followups",
    }

    for key, value in hints.items():
        if key in list_fields:
            if not isinstance(value, list):
                raise HermesValidationError(
                    "INVALID_RESULT_SUMMARY",
                    f"explanation_hints.{key} must be a list.",
                    "Result explanation hints are malformed, so the local fallback should be used.",
                )
            if len(value) > MAX_HINT_ITEMS:
                raise HermesValidationError(
                    "SUMMARY_TOO_LARGE",
                    f"explanation_hints.{key} contains more than {MAX_HINT_ITEMS} items.",
                    "The result explanation hints are too large for Hermes validation.",
                )

        if isinstance(value, str) and len(value) > MAX_HINT_TEXT_CHARS:
            raise HermesValidationError(
                "SUMMARY_TOO_LARGE",
                f"explanation_hints.{key} exceeds {MAX_HINT_TEXT_CHARS} characters.",
                "The result explanation hints are too large for Hermes validation.",
            )


def _validate_planning_context(context: Dict[str, Any]) -> None:
    datasets = context.get("datasets", [])
    if datasets is None:
        datasets = []
    if not isinstance(datasets, list):
        raise HermesValidationError(
            "INVALID_REQUEST",
            "assistant_context.datasets must be a list.",
            "The dataset context is malformed, so InsightEase will use the local planner.",
        )
    if isinstance(datasets, list):
        if len(datasets) > MAX_DATASETS:
            raise HermesValidationError(
                "CONTEXT_TOO_LARGE",
                f"Assistant context contains more than {MAX_DATASETS} datasets.",
                "The dataset context is too large, so InsightEase will use the local planner.",
            )
        total_columns = 0
        dataset_ids = set()
        dataset_columns: dict[str, set[str]] = {}
        for dataset in datasets:
            if not isinstance(dataset, dict):
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Each planning dataset must be an object.",
                    "The dataset context is malformed, so InsightEase will use the local planner.",
                )
            dataset_id = dataset.get("id")
            if not isinstance(dataset_id, str) or not dataset_id:
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Each planning dataset requires an id.",
                    "The dataset context is malformed, so InsightEase will use the local planner.",
                )
            if dataset_id in dataset_ids:
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Planning dataset ids must be unique.",
                    "The dataset context is malformed, so InsightEase will use the local planner.",
                )
            dataset_ids.add(dataset_id)
            schema = dataset.get("schema", [])
            if not isinstance(schema, list):
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Dataset schema must be a list.",
                    "The dataset schema is malformed, so InsightEase will use the local planner.",
                )
            total_columns += len(schema)
            dataset_columns[dataset_id] = {
                column.get("name")
                for column in schema
                if isinstance(column, dict) and isinstance(column.get("name"), str)
            }
            if len(schema) > MAX_SCHEMA_COLUMNS:
                raise HermesValidationError(
                    "CONTEXT_TOO_LARGE",
                    f"Dataset schema contains more than {MAX_SCHEMA_COLUMNS} columns.",
                    "The dataset schema is too large, so InsightEase will use the local planner.",
                )
        if total_columns > MAX_TOTAL_SCHEMA_COLUMNS:
            raise HermesValidationError(
                "CONTEXT_TOO_LARGE",
                f"Assistant context contains more than {MAX_TOTAL_SCHEMA_COLUMNS} total schema columns.",
                "The combined dataset schema is too large, so InsightEase will use the local planner.",
            )

        selected_ids = context.get("selected_dataset_ids", [])
        if not isinstance(selected_ids, list) or any(item not in dataset_ids for item in selected_ids):
            raise HermesValidationError(
                "INVALID_REQUEST",
                "Selected dataset ids must exist in the bounded dataset context.",
                "The selected dataset context is invalid, so InsightEase will use the local planner.",
            )
        selected_id = context.get("selected_dataset_id")
        if selected_id is not None and selected_id not in dataset_ids:
            raise HermesValidationError(
                "INVALID_REQUEST",
                "Selected dataset id must exist in the bounded dataset context.",
                "The selected dataset context is invalid, so InsightEase will use the local planner.",
            )

    relationship_set = context.get("relationship_set")
    if isinstance(relationship_set, dict):
        dataset_nodes = relationship_set.get("dataset_nodes", [])
        if not isinstance(dataset_nodes, list) or any(
            not isinstance(node, dict) or node.get("dataset_id") not in dataset_ids
            for node in dataset_nodes
        ):
            raise HermesValidationError(
                "INVALID_REQUEST",
                "Relationship set nodes must exist in the bounded dataset context.",
                "The relationship context is invalid, so InsightEase will use the local planner.",
            )
        relationships = relationship_set.get("relationships", [])
        if not isinstance(relationships, list):
            raise HermesValidationError(
                "INVALID_REQUEST",
                "Relationship set relationships must be a list.",
                "The relationship context is malformed, so InsightEase will use the local planner.",
            )
        if len(relationships) > MAX_RELATIONSHIP_EDGES:
            raise HermesValidationError(
                "CONTEXT_TOO_LARGE",
                f"Relationship set contains more than {MAX_RELATIONSHIP_EDGES} edges.",
                "The relationship context is too large, so InsightEase will use the local planner.",
            )
        for relationship in relationships:
            if not isinstance(relationship, dict):
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Each relationship must be an object.",
                    "The relationship context is malformed, so InsightEase will use the local planner.",
                )
            source_id = relationship.get("source_dataset_id")
            target_id = relationship.get("target_dataset_id")
            source_column = relationship.get("source_column")
            target_column = relationship.get("target_column")
            if source_id not in dataset_ids or target_id not in dataset_ids:
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Relationship endpoints must exist in the bounded dataset context.",
                    "The relationship context is invalid, so InsightEase will use the local planner.",
                )
            if (
                source_column not in dataset_columns.get(source_id, set())
                or target_column not in dataset_columns.get(target_id, set())
            ):
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    "Relationship fields must exist in the bounded dataset schemas.",
                    "The relationship context is invalid, so InsightEase will use the local planner.",
                )


def _reject_forbidden_keys(value: Any, path: str = "", depth: int = 0) -> None:
    if depth > 12:
        raise HermesValidationError(
            "INVALID_REQUEST",
            "Request contains overly deep nested content.",
            "The assistant context is too deeply nested, so the local fallback should be used.",
        )

    if isinstance(value, dict):
        for key, nested in value.items():
            current_path = f"{path}.{key}" if path else str(key)
            if _is_forbidden_path(current_path):
                raise HermesValidationError(
                    "INVALID_REQUEST",
                    f"Forbidden raw or sensitive key detected: {current_path}",
                    "The request appears to include raw data or sensitive fields, so Hermes dry-run rejected it.",
                )
            _reject_forbidden_keys(nested, current_path, depth + 1)
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _reject_forbidden_keys(nested, f"{path}[{index}]", depth + 1)


def _is_forbidden_path(path: str) -> bool:
    normalized_path = path.lower()
    if normalized_path in ALLOWED_SAFETY_PATHS:
        return False

    for segment in _path_segments(normalized_path):
        if segment in FORBIDDEN_KEYS:
            return True
        if segment in SAFETY_FLAG_KEYS:
            return True
        if segment.endswith("_token") or segment.startswith("token_"):
            return True

    return False


def _path_segments(path: str) -> list[str]:
    segments: list[str] = []
    for segment in path.split("."):
        key = segment.split("[", 1)[0]
        if key:
            segments.append(key)
    return segments
