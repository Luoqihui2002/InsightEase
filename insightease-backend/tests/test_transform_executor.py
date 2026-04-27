"""
Unit tests for transform_executor.py
Run with: python -m pytest tests/test_transform_executor.py -v
"""

import pytest
import pandas as pd
import numpy as np

from app.core.transform_executor import (
    execute_operations,
    build_column_stats,
    serialize_dataframe,
    TransformError,
)


@pytest.fixture
def sample_df():
    return pd.DataFrame({
        "name": ["Alice", "Bob", "Charlie", "Alice", "Bob"],
        "age": [25, 30, 35, 25, 30],
        "city": ["NY", "LA", "NY", "NY", "LA"],
        "score": [85.5, 90.0, 78.0, 88.0, 92.5],
    })


# ---------------------------------------------------------------------------
# filter
# ---------------------------------------------------------------------------

class TestFilter:
    def test_filter_eq(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [{"column": "city", "operator": "eq", "value": "NY"}], "logic": "and"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3
        assert list(result["city"].unique()) == ["NY"]

    def test_filter_gt(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [{"column": "age", "operator": "gt", "value": "25"}], "logic": "and"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3
        assert all(result["age"] > 25)

    def test_filter_and_logic(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [
            {"column": "city", "operator": "eq", "value": "NY"},
            {"column": "age", "operator": "gte", "value": "25"},
        ], "logic": "and"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3

    def test_filter_or_logic(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [
            {"column": "city", "operator": "eq", "value": "LA"},
            {"column": "age", "operator": "gt", "value": "30"},
        ], "logic": "or"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3  # Bob(LA,30), Charlie(NY,35), Bob(LA,30)

    def test_filter_contains(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [{"column": "name", "operator": "contains", "value": "li"}], "logic": "and"}}]
        result, _ = execute_operations(sample_df, ops)
        # "li" matches "Alice" (2 rows) and "Charlie" (1 row) = 3 total
        assert len(result) == 3

    def test_filter_column_not_found(self, sample_df):
        ops = [{"type": "filter", "config": {"conditions": [{"column": "nonexistent", "operator": "eq", "value": "x"}], "logic": "and"}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"


# ---------------------------------------------------------------------------
# select
# ---------------------------------------------------------------------------

class TestSelect:
    def test_select_columns(self, sample_df):
        ops = [{"type": "select", "config": {"columns": ["name", "age"]}}]
        result, _ = execute_operations(sample_df, ops)
        assert list(result.columns) == ["name", "age"]
        assert len(result) == 5

    def test_select_column_not_found(self, sample_df):
        ops = [{"type": "select", "config": {"columns": ["name", "nonexistent"]}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"


# ---------------------------------------------------------------------------
# rename
# ---------------------------------------------------------------------------

class TestRename:
    def test_rename_single(self, sample_df):
        ops = [{"type": "rename", "config": {"mappings": [{"old": "age", "new": "years"}]}}]
        result, _ = execute_operations(sample_df, ops)
        assert "years" in result.columns
        assert "age" not in result.columns

    def test_rename_multiple(self, sample_df):
        ops = [{"type": "rename", "config": {"mappings": [
            {"old": "age", "new": "years"},
            {"old": "city", "new": "location"},
        ]}}]
        result, _ = execute_operations(sample_df, ops)
        assert set(result.columns) == {"name", "years", "location", "score"}

    def test_rename_column_not_found(self, sample_df):
        ops = [{"type": "rename", "config": {"mappings": [{"old": "nonexistent", "new": "x"}]}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"


# ---------------------------------------------------------------------------
# sort
# ---------------------------------------------------------------------------

class TestSort:
    def test_sort_ascending(self, sample_df):
        ops = [{"type": "sort", "config": {"by": ["age"], "ascending": [True]}}]
        result, _ = execute_operations(sample_df, ops)
        assert list(result["age"]) == [25, 25, 30, 30, 35]

    def test_sort_descending(self, sample_df):
        ops = [{"type": "sort", "config": {"by": ["score"], "ascending": [False]}}]
        result, _ = execute_operations(sample_df, ops)
        assert result.iloc[0]["score"] == 92.5

    def test_sort_multiple(self, sample_df):
        ops = [{"type": "sort", "config": {"by": ["city", "age"], "ascending": [True, False]}}]
        result, _ = execute_operations(sample_df, ops)
        # LA first (alphabetically), then NY; within each, age desc
        la = result[result["city"] == "LA"]
        assert list(la["age"]) == [30, 30]

    def test_sort_column_not_found(self, sample_df):
        ops = [{"type": "sort", "config": {"by": ["nonexistent"]}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"


# ---------------------------------------------------------------------------
# dedup
# ---------------------------------------------------------------------------

class TestDedup:
    def test_dedup_first(self, sample_df):
        ops = [{"type": "dedup", "config": {"columns": ["name"], "keep": "first"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3
        assert set(result["name"]) == {"Alice", "Bob", "Charlie"}

    def test_dedup_last(self, sample_df):
        ops = [{"type": "dedup", "config": {"columns": ["name"], "keep": "last"}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3
        # Last Alice is index 3 (age 25), Last Bob is index 4 (age 30)
        alice = result[result["name"] == "Alice"]
        assert alice.iloc[0]["age"] == 25

    def test_dedup_global(self, sample_df):
        ops = [{"type": "dedup", "config": {"columns": [], "keep": "first"}}]
        # sample_df has no fully identical rows, so result should be 5
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 5

    def test_dedup_column_not_found(self, sample_df):
        ops = [{"type": "dedup", "config": {"columns": ["nonexistent"], "keep": "first"}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"


# ---------------------------------------------------------------------------
# derive (V1: numeric arithmetic only)
# ---------------------------------------------------------------------------

class TestDerive:
    def test_derive_addition(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "age_plus_10", "formula": "age + 10"}}]
        result, _ = execute_operations(sample_df, ops)
        assert "age_plus_10" in result.columns
        assert list(result["age_plus_10"]) == [35, 40, 45, 35, 40]

    def test_derive_multiplication(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "score_double", "formula": "score * 2"}}]
        result, _ = execute_operations(sample_df, ops)
        assert list(result["score_double"]) == [171.0, 180.0, 156.0, 176.0, 185.0]

    def test_derive_power(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "age_sq", "formula": "age ** 2"}}]
        result, _ = execute_operations(sample_df, ops)
        assert list(result["age_sq"]) == [625, 900, 1225, 625, 900]

    def test_derive_parentheses(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "calc", "formula": "(age + score) * 2"}}]
        result, _ = execute_operations(sample_df, ops)
        expected = [(25 + 85.5) * 2, (30 + 90.0) * 2, (35 + 78.0) * 2, (25 + 88.0) * 2, (30 + 92.5) * 2]
        assert list(result["calc"]) == pytest.approx(expected, rel=1e-5)

    def test_derive_column_not_found(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "x", "formula": "nonexistent + 1"}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_NOT_FOUND"

    def test_derive_new_column_conflict(self, sample_df):
        ops = [{"type": "derive", "config": {"newColumn": "age", "formula": "age + 1"}}]
        with pytest.raises(TransformError) as exc_info:
            execute_operations(sample_df, ops)
        assert exc_info.value.error_category == "COLUMN_CONFLICT"


# ---------------------------------------------------------------------------
# sample
# ---------------------------------------------------------------------------

class TestSample:
    def test_sample_count(self, sample_df):
        ops = [{"type": "sample", "config": {"method": "count", "count": 3}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 3

    def test_sample_percentage(self, sample_df):
        ops = [{"type": "sample", "config": {"method": "percentage", "percentage": 40}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 2  # 40% of 5 = 2

    def test_sample_seed_reproducible(self, sample_df):
        ops = [{"type": "sample", "config": {"method": "count", "count": 3, "seed": 42}}]
        r1, _ = execute_operations(sample_df, ops)
        r2, _ = execute_operations(sample_df, ops)
        assert list(r1.index) == list(r2.index)

    def test_sample_count_exceeds_rows(self, sample_df):
        ops = [{"type": "sample", "config": {"method": "count", "count": 100}}]
        result, _ = execute_operations(sample_df, ops)
        assert len(result) == 5


# ---------------------------------------------------------------------------
# chain
# ---------------------------------------------------------------------------

class TestChain:
    def test_filter_then_rename_then_select(self, sample_df):
        ops = [
            {"type": "filter", "config": {"conditions": [{"column": "city", "operator": "eq", "value": "NY"}], "logic": "and"}},
            {"type": "rename", "config": {"mappings": [{"old": "age", "new": "years"}]}},
            {"type": "select", "config": {"columns": ["name", "years"]}},
        ]
        result, summary = execute_operations(sample_df, ops)
        assert len(result) == 3
        assert list(result.columns) == ["name", "years"]
        assert summary["steps_executed"] == 3


# ---------------------------------------------------------------------------
# utilities
# ---------------------------------------------------------------------------

class TestUtilities:
    def test_build_column_stats(self, sample_df):
        stats = build_column_stats(sample_df)
        assert len(stats) == 4
        age_stat = next(s for s in stats if s["name"] == "age")
        assert age_stat["non_null_count"] == 5
        assert age_stat["null_count"] == 0
        assert "min" in age_stat

    def test_serialize_dataframe(self, sample_df):
        cols, data, total = serialize_dataframe(sample_df, limit=2)
        assert cols == ["name", "age", "city", "score"]
        assert len(data) == 2
        assert total == 5
        assert data[0]["name"] == "Alice"
