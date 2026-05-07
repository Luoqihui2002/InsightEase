"""Validation helpers for Hermes assistant dry-run endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict


MAX_REQUEST_BYTES = 256 * 1024
MAX_SAFE_TABLES = 3
MAX_TABLE_ROWS = 5
MAX_TABLE_COLUMNS = 12
MAX_DATASETS = 50
MAX_SCHEMA_COLUMNS = 100
MAX_RELATIONSHIP_EDGES = 200

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


def _validate_planning_context(context: Dict[str, Any]) -> None:
    datasets = context.get("datasets", [])
    if datasets is None:
        datasets = []
    if isinstance(datasets, list):
        if len(datasets) > MAX_DATASETS:
            raise HermesValidationError(
                "CONTEXT_TOO_LARGE",
                f"Assistant context contains more than {MAX_DATASETS} datasets.",
                "The dataset context is too large, so InsightEase will use the local planner.",
            )
        for dataset in datasets:
            if not isinstance(dataset, dict):
                continue
            schema = dataset.get("schema", [])
            if isinstance(schema, list) and len(schema) > MAX_SCHEMA_COLUMNS:
                raise HermesValidationError(
                    "CONTEXT_TOO_LARGE",
                    f"Dataset schema contains more than {MAX_SCHEMA_COLUMNS} columns.",
                    "The dataset schema is too large, so InsightEase will use the local planner.",
                )

    relationship_set = context.get("relationship_set")
    if isinstance(relationship_set, dict):
        relationships = relationship_set.get("relationships", [])
        if isinstance(relationships, list) and len(relationships) > MAX_RELATIONSHIP_EDGES:
            raise HermesValidationError(
                "CONTEXT_TOO_LARGE",
                f"Relationship set contains more than {MAX_RELATIONSHIP_EDGES} edges.",
                "The relationship context is too large, so InsightEase will use the local planner.",
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
