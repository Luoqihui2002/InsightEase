"""
Unit tests for transform schemas (Pydantic validation).
Run with: python -m pytest tests/test_transform_schemas.py -v
"""

import pytest
from pydantic import ValidationError

from app.schemas.transform import (
    Operation,
    DeriveConfig,
    FilterConfig,
    TransformPreviewRequest,
    TransformRequest,
    TransformOptions,
)


class TestDeriveConfig:
    def test_valid_numeric_formula(self):
        cfg = DeriveConfig(newColumn="x", formula="age + 10")
        assert cfg.formula == "age + 10"

    def test_valid_formula_with_parentheses(self):
        cfg = DeriveConfig(newColumn="x", formula="(a + b) * 2")
        assert cfg.formula == "(a + b) * 2"

    def test_reject_string_function(self):
        with pytest.raises(ValidationError) as exc_info:
            DeriveConfig(newColumn="x", formula="UPPER(name)")
        assert "unsupported function" in str(exc_info.value).lower()

    def test_reject_if_function(self):
        with pytest.raises(ValidationError) as exc_info:
            DeriveConfig(newColumn="x", formula="IF(a > 0, 1, 0)")
        err = str(exc_info.value).lower()
        assert "invalid character" in err or "unsupported function" in err

    def test_reject_import(self):
        with pytest.raises(ValidationError) as exc_info:
            DeriveConfig(newColumn="x", formula="__import__('os')")
        err = str(exc_info.value).lower()
        assert "invalid character" in err or "unsupported function" in err

    def test_reject_eval(self):
        with pytest.raises(ValidationError) as exc_info:
            DeriveConfig(newColumn="x", formula="eval('1+1')")
        err = str(exc_info.value).lower()
        assert "invalid character" in err or "unsupported function" in err

    def test_reject_attribute_access(self):
        with pytest.raises(ValidationError) as exc_info:
            DeriveConfig(newColumn="x", formula="df.shape")
        err = str(exc_info.value).lower()
        assert "invalid character" in err or "unsupported function" in err


class TestFilterConfig:
    def test_valid_filter(self):
        cfg = FilterConfig(
            conditions=[{"column": "age", "operator": "gt", "value": "18"}],
            logic="and",
        )
        assert cfg.conditions[0].operator == "gt"

    def test_invalid_operator(self):
        with pytest.raises(ValidationError):
            FilterConfig(
                conditions=[{"column": "age", "operator": "invalid", "value": "18"}],
                logic="and",
            )

    def test_invalid_logic(self):
        with pytest.raises(ValidationError):
            FilterConfig(
                conditions=[{"column": "age", "operator": "eq", "value": "18"}],
                logic="xor",
            )


class TestOperation:
    def test_valid_filter_operation(self):
        op = Operation(
            type="filter",
            config={"conditions": [{"column": "age", "operator": "gt", "value": "18"}], "logic": "and"},
        )
        assert op.type == "filter"

    def test_invalid_operation_type(self):
        with pytest.raises(ValidationError):
            Operation(type="join", config={})

    def test_valid_derive_operation(self):
        op = Operation(type="derive", config={"newColumn": "x", "formula": "a + 1"})
        assert op.type == "derive"


class TestTransformPreviewRequest:
    def test_valid_request(self):
        req = TransformPreviewRequest(
            operations=[
                {"type": "filter", "config": {"conditions": [{"column": "age", "operator": "gt", "value": "18"}], "logic": "and"}},
            ]
        )
        assert len(req.operations) == 1

    def test_too_many_operations(self):
        ops = [{"type": "filter", "config": {"conditions": [{"column": "age", "operator": "gt", "value": "18"}], "logic": "and"}}] * 21
        with pytest.raises(ValidationError):
            TransformPreviewRequest(operations=ops)

    def test_empty_operations(self):
        with pytest.raises(ValidationError):
            TransformPreviewRequest(operations=[])


class TestTransformRequest:
    def test_valid_request_with_options(self):
        req = TransformRequest(
            operations=[{"type": "select", "config": {"columns": ["name"]}}],
            options=TransformOptions(filename="result.csv"),
        )
        assert req.options.filename == "result.csv"

    def test_valid_request_without_options(self):
        req = TransformRequest(
            operations=[{"type": "select", "config": {"columns": ["name"]}}],
        )
        assert req.options is None

    def test_invalid_save_mode(self):
        with pytest.raises(ValidationError):
            TransformRequest(
                operations=[{"type": "select", "config": {"columns": ["name"]}}],
                options=TransformOptions(save_mode="invalid"),
            )
