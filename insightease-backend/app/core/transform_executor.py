"""
Transform Executor - Pure pandas operation execution.

No FastAPI / SQLAlchemy / HTTP dependencies.
Receives a pd.DataFrame + list of operations, returns a pd.DataFrame.
"""

import re
import time
import logging
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple


logger = logging.getLogger(__name__)


class TransformError(Exception):
    """Operation-level error with step index."""
    def __init__(self, message: str, step_index: int, step_type: str, error_category: str = "EXECUTION_ERROR"):
        self.step_index = step_index
        self.step_type = step_type
        self.error_category = error_category
        super().__init__(message)


# ---------------------------------------------------------------------------
# Operation dispatch
# ---------------------------------------------------------------------------

def execute_operations(df: pd.DataFrame, operations: List[Dict[str, Any]]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Execute a chain of operations on a DataFrame.

    Returns:
        result_df: transformed DataFrame
        summary: execution metadata
    """
    warnings: List[str] = []
    start_time = time.perf_counter()

    current = df.copy()
    for idx, op in enumerate(operations):
        op_type = op.get("type")
        config = op.get("config", {})

        try:
            current = _apply_operation(current, op_type, config, idx)
        except TransformError:
            raise
        except Exception as exc:
            logger.exception("Unexpected transform failure at step %s (%s)", idx, op_type)
            raise TransformError(
                message=f"第 {idx + 1} 步 {op_type} 执行失败",
                step_index=idx,
                step_type=op_type,
                error_category="EXECUTION_ERROR",
            ) from exc

    duration_ms = int((time.perf_counter() - start_time) * 1000)
    summary = {
        "steps_executed": len(operations),
        "duration_ms": duration_ms,
        "warnings": warnings,
    }
    return current, summary


def _apply_operation(df: pd.DataFrame, op_type: str, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    if op_type == "filter":
        return _exec_filter(df, config, step_index)
    if op_type == "select":
        return _exec_select(df, config, step_index)
    if op_type == "rename":
        return _exec_rename(df, config, step_index)
    if op_type == "sort":
        return _exec_sort(df, config, step_index)
    if op_type == "dedup":
        return _exec_dedup(df, config, step_index)
    if op_type == "derive":
        return _exec_derive(df, config, step_index)
    if op_type == "sample":
        return _exec_sample(df, config, step_index)
    raise TransformError(
        message=f"不支持的操作类型: {op_type}",
        step_index=step_index,
        step_type=op_type,
        error_category="UNSUPPORTED_OPERATION",
    )


# ---------------------------------------------------------------------------
# filter
# ---------------------------------------------------------------------------

def _exec_filter(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    conditions = config.get("conditions", [])
    logic = config.get("logic", "and")

    if not conditions:
        return df

    masks = []
    for cond in conditions:
        col = cond["column"]
        if col not in df.columns:
            raise TransformError(
                message=f"filter 中列 '{col}' 不存在",
                step_index=step_index,
                step_type="filter",
                error_category="COLUMN_NOT_FOUND",
            )
        masks.append(_single_condition_mask(df, cond, step_index))

    if logic == "and":
        final_mask = masks[0]
        for m in masks[1:]:
            final_mask = final_mask & m
    else:
        final_mask = masks[0]
        for m in masks[1:]:
            final_mask = final_mask | m

    return df[final_mask].reset_index(drop=True)


def _single_condition_mask(df: pd.DataFrame, cond: Dict[str, Any], step_index: int) -> pd.Series:
    col = cond["column"]
    op = cond["operator"]
    value = cond.get("value")
    series = df[col]

    if op == "isNull":
        return series.isna() | (series.astype(str) == "")
    if op == "isNotNull":
        return series.notna() & (series.astype(str) != "")

    if op in ("eq", "ne", "contains", "startswith", "endswith"):
        str_series = series.astype(str)
        if op == "eq":
            return str_series == str(value)
        if op == "ne":
            return str_series != str(value)
        if op == "contains":
            return str_series.str.contains(str(value), na=False)
        if op == "startswith":
            return str_series.str.startswith(str(value), na=False)
        if op == "endswith":
            return str_series.str.endswith(str(value), na=False)

    # numeric comparisons
    num_series = pd.to_numeric(series, errors="coerce")
    num_value = pd.to_numeric(value, errors="coerce")
    if pd.isna(num_value):
        raise TransformError(
            message=f"filter 条件值 '{value}' 无法解析为数值",
            step_index=step_index,
            step_type="filter",
            error_category="INVALID_VALUE",
        )

    if op == "gt":
        return num_series > num_value
    if op == "gte":
        return num_series >= num_value
    if op == "lt":
        return num_series < num_value
    if op == "lte":
        return num_series <= num_value

    raise TransformError(
        message=f"不支持的 filter operator: {op}",
        step_index=step_index,
        step_type="filter",
        error_category="INVALID_OPERATOR",
    )


# ---------------------------------------------------------------------------
# select
# ---------------------------------------------------------------------------

def _exec_select(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    cols = config.get("columns", [])
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise TransformError(
            message=f"select 中列 {missing} 不存在",
            step_index=step_index,
            step_type="select",
            error_category="COLUMN_NOT_FOUND",
        )
    return df[cols].copy()


# ---------------------------------------------------------------------------
# rename
# ---------------------------------------------------------------------------

def _exec_rename(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    mappings = config.get("mappings", [])
    rename_map = {}
    current_cols = set(df.columns)

    for m in mappings:
        old = m["old"]
        new = m["new"]
        if old not in current_cols:
            raise TransformError(
                message=f"rename 中原列 '{old}' 不存在",
                step_index=step_index,
                step_type="rename",
                error_category="COLUMN_NOT_FOUND",
            )
        if new in current_cols and new not in {m["old"] for m in mappings}:
            raise TransformError(
                message=f"rename 目标列名 '{new}' 与现有列冲突",
                step_index=step_index,
                step_type="rename",
                error_category="COLUMN_CONFLICT",
            )
        rename_map[old] = new

    return df.rename(columns=rename_map).copy()


# ---------------------------------------------------------------------------
# sort
# ---------------------------------------------------------------------------

def _exec_sort(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    by = config.get("by", [])
    ascending = config.get("ascending")
    na_position = config.get("na_position", "last")

    missing = [c for c in by if c not in df.columns]
    if missing:
        raise TransformError(
            message=f"sort 中列 {missing} 不存在",
            step_index=step_index,
            step_type="sort",
            error_category="COLUMN_NOT_FOUND",
        )

    if ascending is None:
        ascending = [True] * len(by)
    elif len(ascending) < len(by):
        ascending = ascending + [True] * (len(by) - len(ascending))

    return df.sort_values(by=by, ascending=ascending[:len(by)], na_position=na_position).reset_index(drop=True)


# ---------------------------------------------------------------------------
# dedup
# ---------------------------------------------------------------------------

def _exec_dedup(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    cols = config.get("columns", [])
    keep = config.get("keep", "first")
    case_sensitive = config.get("case_sensitive", True)

    if cols:
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise TransformError(
                message=f"dedup 中列 {missing} 不存在",
                step_index=step_index,
                step_type="dedup",
                error_category="COLUMN_NOT_FOUND",
            )

    if not case_sensitive and cols:
        # create temporary lower-cased columns for dedup
        tmp_df = df.copy()
        for c in cols:
            if tmp_df[c].dtype == object:
                tmp_df[c] = tmp_df[c].astype(str).str.lower()
        _, idx = tmp_df.drop_duplicates(subset=cols if cols else None, keep=keep).index.align(df.index)
        return df.loc[idx].reset_index(drop=True)

    subset = cols if cols else None
    return df.drop_duplicates(subset=subset, keep=keep).reset_index(drop=True)


# ---------------------------------------------------------------------------
# derive (V1: numeric arithmetic only)
# ---------------------------------------------------------------------------

def _exec_derive(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    new_col = config.get("newColumn", "").strip()
    formula = config.get("formula", "").strip()

    if not new_col:
        raise TransformError(
            message="derive newColumn 不能为空",
            step_index=step_index,
            step_type="derive",
            error_category="INVALID_CONFIG",
        )
    if new_col in df.columns:
        raise TransformError(
            message=f"derive 新列名 '{new_col}' 已存在",
            step_index=step_index,
            step_type="derive",
            error_category="COLUMN_CONFLICT",
        )

    # Build safe eval expression: replace column names with df["col"]
    # Handle backtick-quoted names with spaces
    expr = formula
    cols_sorted = sorted(df.columns, key=len, reverse=True)

    # First handle backtick-quoted names
    backtick_pattern = r"`([^`]+)`"
    for match in re.finditer(backtick_pattern, expr):
        col_name = match.group(1)
        if col_name not in df.columns:
            raise TransformError(
                message=f"derive formula 中列 '{col_name}' 不存在",
                step_index=step_index,
                step_type="derive",
                error_category="COLUMN_NOT_FOUND",
            )
        expr = expr.replace(f"`{col_name}`", f"df['{col_name}']")

    # Then handle unquoted names (avoid replacing inside already-replaced fragments)
    for col_name in cols_sorted:
        if " " in col_name:
            continue  # must be backtick-quoted
        # Use word boundary to avoid partial matches
        expr = re.sub(rf"\b{re.escape(col_name)}\b", f"df['{col_name}']", expr)

    # Validate no remaining bare words that could be functions/variables
    # After replacement, the only allowed bare tokens are numeric literals and operators
    remaining = re.sub(r"df\['[^']+'\]", "", expr)
    remaining = re.sub(r"[0-9+\-*/()% .\t\n]", "", remaining)
    if remaining:
        # Check if remaining is an unrecognized column name
        # (e.g. user typed "nonexistent + 1" where "nonexistent" is not a column)
        clean_remaining = remaining.strip()
        if clean_remaining and re.match(r"^[a-zA-Z_]\w*$", clean_remaining):
            raise TransformError(
                message=f"derive formula 中列 '{clean_remaining}' 不存在",
                step_index=step_index,
                step_type="derive",
                error_category="COLUMN_NOT_FOUND",
            )
        raise TransformError(
            message=f"derive formula 包含无法识别的内容: '{remaining}'",
            step_index=step_index,
            step_type="derive",
            error_category="INVALID_FORMULA",
        )

    try:
        result = eval(expr, {"__builtins__": {}}, {"df": df, "pd": pd, "np": np})
    except Exception as exc:
        logger.exception("Derive formula evaluation failed at step %s", step_index)
        raise TransformError(
            message="derive formula 计算失败，请检查字段类型和表达式",
            step_index=step_index,
            step_type="derive",
            error_category="FORMULA_EVAL_ERROR",
        ) from exc

    out = df.copy()
    out[new_col] = result
    return out


# ---------------------------------------------------------------------------
# sample
# ---------------------------------------------------------------------------

def _exec_sample(df: pd.DataFrame, config: Dict[str, Any], step_index: int) -> pd.DataFrame:
    method = config.get("method", "count")
    seed = config.get("seed")

    if method == "count":
        count = config.get("count", 100)
        n = min(count, len(df))
        if n == 0:
            return df.iloc[0:0].copy()
        return df.sample(n=n, random_state=seed).reset_index(drop=True)
    else:  # percentage
        percentage = config.get("percentage", 10)
        frac = percentage / 100.0
        if frac >= 1.0:
            return df.copy()
        return df.sample(frac=frac, random_state=seed).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def build_column_stats(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Build column statistics for preview response."""
    stats = []
    for col in df.columns:
        s = df[col]
        null_count = int(s.isna().sum())
        stat = {
            "name": str(col),
            "dtype": str(s.dtype),
            "non_null_count": int(s.notna().sum()),
            "null_count": null_count,
        }
        # numeric stats
        num_s = pd.to_numeric(s, errors="coerce")
        if num_s.notna().any():
            stat["min"] = float(num_s.min()) if num_s.notna().any() else None
            stat["max"] = float(num_s.max()) if num_s.notna().any() else None
            stat["mean"] = float(num_s.mean()) if num_s.notna().any() else None
        stats.append(stat)
    return stats


def serialize_dataframe(df: pd.DataFrame, limit: int = 100) -> Tuple[List[str], List[Dict[str, Any]], int]:
    """Serialize DataFrame to JSON-safe format."""
    columns = [str(c) for c in df.columns]
    total_rows = len(df)
    preview_df = df.head(limit)

    raw_data = preview_df.where(pd.notnull(preview_df), None).to_dict(orient="records")
    data = []
    for row in raw_data:
        safe_row = {}
        for k, v in row.items():
            key = str(k)
            if pd.isna(v):
                safe_row[key] = None
            elif isinstance(v, (pd.Timestamp, pd._libs.tslibs.timestamps.Timestamp)):
                safe_row[key] = v.isoformat()
            elif isinstance(v, (np.integer, np.floating)):
                safe_row[key] = int(v) if isinstance(v, np.integer) else float(v)
            else:
                safe_row[key] = v
        data.append(safe_row)

    return columns, data, total_rows
