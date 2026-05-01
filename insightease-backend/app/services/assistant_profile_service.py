"""
AI Data Assistant — Dataset Profile Service.

Deterministic, metadata-first profiling. No LLM calls.
Read-only: never modifies datasets.
"""

from typing import Any, Dict, List, Optional
import pandas as pd
import numpy as np
from collections import Counter

from app.api.v1.endpoints.analysis import MISSING_VALUE_TOKENS, normalize_missing_values


# ---------------------------------------------------------------------------
# Column role detection heuristics
# ---------------------------------------------------------------------------

ID_ROLE_PATTERNS: Dict[str, str] = {
    "user_id": "user_id",
    "uid": "user_id",
    "customer_id": "user_id",
    "member_id": "user_id",
    "device_id": "device_id",
    "did": "device_id",
    "session_id": "session_id",
    "order_id": "order_id",
    "txn_id": "order_id",
    "transaction_id": "order_id",
    "product_id": "product_id",
    "sku_id": "product_id",
    "spu_id": "product_id",
    "item_id": "product_id",
    "goods_id": "product_id",
    "journey_id": "order_id",
}

METRIC_PATTERNS = [
    "sales", "gmv", "revenue", "amount", "price", "cost",
    "orders", "traffic", "sessions", "count", "rate", "score",
    "ltv", "value", "quantity", "discount", "avg", "mean",
    "total", "sum", "cnt", "num", "pct", "percentage",
]

EXPERIMENT_PATTERNS = ["group", "variant", "treatment", "control", "arm", "bucket"]

TEXT_PATTERNS = ["review", "comment", "text", "content", "description", "feedback", "note"]

TIME_PATTERNS = ["date", "dt", "day", "month", "year", "time", "timestamp", "at", "created", "updated", "event_time", "touch_time", "order_date"]

EVENT_PATTERNS = ["event", "event_name", "action", "page", "page_name", "screen", "block_type"]

STATUS_PATTERNS = ["status", "state", "type", "flag", "label", "tag", "category", "level"]


def _clean_name(name: str) -> str:
    """Normalize column name for pattern matching."""
    return name.lower().strip().replace(" ", "_")


def detect_column_role(name: str, dtype: str, unique_rate: float, null_rate: float, examples: List[Any]) -> str:
    """Return a ColumnRole string using deterministic heuristics."""
    cname = _clean_name(name)
    dtype_str = str(dtype).lower()

    # 1. ID roles (exact or suffix match)
    for pattern, role in ID_ROLE_PATTERNS.items():
        if cname == pattern or cname.endswith("_" + pattern):
            return role
    if cname.endswith("_id") and unique_rate > 0.8:
        return "unknown"  # generic ID, can't be more specific

    # 2. Timestamp / date
    if any(p in cname for p in TIME_PATTERNS):
        if "datetime" in dtype_str or "date" in dtype_str or "time" in dtype_str:
            if "date" in cname and "time" not in cname and "timestamp" not in cname:
                return "date"
            return "timestamp"

    # 3. Event name
    if any(p in cname for p in EVENT_PATTERNS):
        return "event_name"

    # 4. Treatment group
    if any(p in cname for p in EXPERIMENT_PATTERNS):
        if unique_rate < 0.2:
            return "treatment_group"

    # 5. Amount / revenue metric
    if any(p in cname for p in ["amount", "revenue", "gmv", "sales", "price", "cost", "ltv", "value"]):
        if "int" in dtype_str or "float" in dtype_str:
            return "amount_revenue"

    # 6. Generic metric (numeric with metric-like name)
    if any(p in cname for p in METRIC_PATTERNS):
        if "int" in dtype_str or "float" in dtype_str:
            return "metric"

    # 7. Status / category
    if any(p in cname for p in STATUS_PATTERNS):
        if unique_rate < 0.3:
            return "status"
        return "category"

    # 8. Text field
    if any(p in cname for p in TEXT_PATTERNS):
        return "text_field"

    # 9. Label / target
    if any(p in cname for p in ["label", "target", "y_", "is_", "converted", "churn", "retention"]):
        return "label_target"

    # 10. Fallback by dtype
    if "int" in dtype_str or "float" in dtype_str:
        if unique_rate > 0.95 and not cname.endswith("_id"):
            return "metric"
        if unique_rate > 0.95:
            return "unknown"
        return "metric"

    if "bool" in dtype_str:
        return "dimension"

    if unique_rate < 0.05:
        return "dimension"

    if unique_rate < 0.3:
        return "category"

    return "unknown"


def detect_semantic_type(series: pd.Series, examples: List[Any]) -> str:
    """Detect semantic type from pandas Series and sample values."""
    dtype_str = str(series.dtype).lower()

    if "datetime" in dtype_str or "date" in dtype_str or "time" in dtype_str:
        return "datetime"

    if "bool" in dtype_str:
        return "boolean"

    if series.dtype == "object" or str(series.dtype) == "string":
        # Check if it's actually numeric stored as string
        non_null = series.dropna()
        if len(non_null) > 0:
            numeric_attempt = pd.to_numeric(non_null, errors="coerce")
            if numeric_attempt.notna().sum() / len(non_null) > 0.9:
                return "numeric"
        # Check if it's datetime stored as string
        if len(non_null) > 0:
            datetime_attempt = pd.to_datetime(non_null, errors="coerce", infer_datetime_format=True)
            if datetime_attempt.notna().sum() / len(non_null) > 0.8:
                return "datetime"
        # Check text vs categorical
        avg_len = non_null.astype(str).str.len().mean() if len(non_null) > 0 else 0
        if avg_len > 30:
            return "text"
        if series.nunique() / max(len(non_null), 1) < 0.3:
            return "categorical"
        return "text"

    if "int" in dtype_str or "float" in dtype_str:
        return "numeric"

    return "unknown"


# ---------------------------------------------------------------------------
# Table classification heuristics
# ---------------------------------------------------------------------------

def classify_table(column_profiles: List[Dict[str, Any]], row_count: int) -> Dict[str, Any]:
    """Classify table type based on detected column roles and names."""
    roles = {c["name"]: c["role"] for c in column_profiles}
    role_counts = Counter(roles.values())

    evidence: List[str] = []
    warnings: List[str] = []
    recommended: List[str] = []

    def _has(role: str) -> bool:
        return role_counts.get(role, 0) > 0

    def _has_name(patterns: List[str]) -> bool:
        for name in roles:
            if any(p in _clean_name(name) for p in patterns):
                return True
        return False

    # --- user ---
    if _has("user_id") and (_has_name(["signup", "register", "gender", "age", "region", "channel"]) or _has("date")):
        evidence.append(f"检测到用户标识列 ({role_counts.get('user_id', 0)} 个)")
        evidence.append("包含用户属性字段（如地区、性别、注册时间）")
        recommended = ["Statistics", "Semantic"]
        return {
            "tableType": "user",
            "confidence": 0.9,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- order ---
    if _has("order_id") and (_has("amount_revenue") or _has("metric")) and (_has("date") or _has("timestamp")):
        evidence.append(f"检测到订单标识列 ({role_counts.get('order_id', 0)} 个)")
        evidence.append("包含金额/数量指标和时间字段")
        recommended = ["Statistics", "Forecast"]
        return {
            "tableType": "order",
            "confidence": 0.9,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- experiment ---
    if _has("treatment_group") and (_has("label_target") or _has("metric")):
        evidence.append(f"检测到实验分组列 ({role_counts.get('treatment_group', 0)} 个)")
        evidence.append("包含结果指标或标签字段")
        recommended = ["Statistics", "Group comparison", "Regression"]
        return {
            "tableType": "experiment",
            "confidence": 0.9,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- review_text ---
    if _has("text_field") and (_has("metric") or _has_name(["rating", "score", "sentiment"])):
        evidence.append(f"检测到文本字段 ({role_counts.get('text_field', 0)} 个)")
        evidence.append("包含评分或情感相关字段")
        recommended = ["Semantic", "Statistics"]
        return {
            "tableType": "review_text",
            "confidence": 0.85,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- event_log ---
    if (_has("user_id") or _has("session_id")) and (_has("event_name") or _has("category")) and (_has("timestamp") or _has("date")):
        evidence.append(f"检测到用户/会话标识 ({role_counts.get('user_id', 0) + role_counts.get('session_id', 0)} 个)")
        evidence.append("包含事件名称和时间戳字段")
        recommended = ["PathAnalysis", "Funnel analysis", "Sequence mining"]
        return {
            "tableType": "event_log",
            "confidence": 0.9,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- product ---
    if _has("product_id") and _has_name(["category", "brand", "price", "rating"]):
        evidence.append(f"检测到商品标识列 ({role_counts.get('product_id', 0)} 个)")
        evidence.append("包含品类、品牌、价格等商品属性")
        recommended = ["Statistics", "Semantic"]
        return {
            "tableType": "product",
            "confidence": 0.85,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- metric_summary ---
    if _has("date") and role_counts.get("metric", 0) >= 2 and not _has("user_id") and not _has("order_id"):
        evidence.append("包含日期列和多个数值指标")
        evidence.append("无明显实体标识，疑似预聚合汇总表")
        recommended = ["Forecast", "Statistics"]
        return {
            "tableType": "metric_summary",
            "confidence": 0.8,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- campaign / transaction (weaker signals) ---
    if _has_name(["campaign", "channel", "touchpoint", "ad"]) and _has("timestamp"):
        evidence.append("包含营销相关字段和时间戳")
        recommended = ["Attribution", "Statistics"]
        return {
            "tableType": "campaign",
            "confidence": 0.7,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    if _has("amount_revenue") and _has("timestamp") and not _has("order_id"):
        evidence.append("包含金额指标和时间戳，但无订单标识")
        recommended = ["Statistics", "Forecast"]
        return {
            "tableType": "transaction",
            "confidence": 0.6,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # --- dimension ---
    if role_counts.get("dimension", 0) > 0 and role_counts.get("metric", 0) == 0 and role_counts.get("amount_revenue", 0) == 0:
        evidence.append("以分类维度为主，无明显数值指标")
        recommended = ["Statistics"]
        return {
            "tableType": "dimension",
            "confidence": 0.6,
            "evidence": evidence,
            "recommendedAnalyses": recommended,
            "warnings": warnings,
        }

    # fallback
    evidence.append("未能识别明确的业务实体类型")
    warnings.append("建议检查列名或手动指定表类型")
    return {
        "tableType": "unknown",
        "confidence": 0.3,
        "evidence": evidence,
        "recommendedAnalyses": ["Statistics"],
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Quality warnings
# ---------------------------------------------------------------------------

def compute_quality_warnings(column_profiles: List[Dict[str, Any]], row_count: int, col_count: int) -> List[str]:
    """Generate dataset-level and column-level quality warnings."""
    warnings: List[str] = []

    # Dataset-level
    if row_count < 100:
        warnings.append(f"数据集行数较少（{row_count} 行），统计结果可能不稳定")
    if col_count > 50:
        warnings.append(f"列数较多（{col_count} 列），建议关注核心字段")

    has_time = any(c["role"] in ("timestamp", "date") for c in column_profiles)
    has_id = any(c["role"].endswith("_id") for c in column_profiles)

    if not has_time:
        warnings.append("未检测到时间列，时间序列和趋势分析可能受限")
    if not has_id:
        warnings.append("未检测到标识列，多表关联和个体分析可能受限")

    total_nulls = sum(c["nullCount"] for c in column_profiles)
    total_cells = row_count * col_count
    if total_cells > 0 and total_nulls / total_cells > 0.2:
        warnings.append(f"整体缺失率较高（{(total_nulls / total_cells * 100):.1f}%），建议检查数据质量")

    # Column-level
    for c in column_profiles:
        name = c["name"]
        null_rate = c["nullRate"]
        unique_rate = c["uniqueRate"]
        role = c["role"]

        if null_rate > 0.5:
            warnings.append(f"列 '{name}' 缺失率超过 50%（{null_rate * 100:.1f}%）")
        if null_rate > 0.0 and null_rate < 0.01 and role not in ("timestamp", "date"):
            # Very low null rate is fine, skip
            pass
        if unique_rate > 0.95 and not role.endswith("_id") and role != "unknown":
            warnings.append(f"列 '{name}' 接近唯一值（{unique_rate * 100:.1f}%），可能是未识别的标识列")
        if unique_rate == 1.0 and row_count > 1 and role not in ("timestamp", "date"):
            warnings.append(f"列 '{name}' 为常数列或全部唯一，请检查数据质量")
        # Check constant column (only 1 unique value)
        if c["uniqueCount"] == 1 and row_count > 1:
            warnings.append(f"列 '{name}' 为常数列（所有行值相同），对分析无区分度")

    return warnings


# ---------------------------------------------------------------------------
# Main profiler
# ---------------------------------------------------------------------------

def profile_dataset(df: pd.DataFrame, dataset_id: str, name: str, include_examples: bool = True) -> Dict[str, Any]:
    """Generate a DatasetProfile from a pandas DataFrame. Read-only."""
    df = normalize_missing_values(df.copy())

    row_count = len(df)
    col_count = len(df.columns)
    column_profiles: List[Dict[str, Any]] = []

    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)
        null_count = int(series.isna().sum())
        null_rate = null_count / row_count if row_count > 0 else 0.0
        unique_count = int(series.nunique())
        unique_rate = unique_count / row_count if row_count > 0 else 0.0

        # Examples: up to 5 non-null values
        examples: List[Any] = []
        if include_examples:
            non_null = series.dropna()
            if len(non_null) > 0:
                sample = non_null.head(5).tolist()
                examples = [clean_example(v) for v in sample]

        # Detect semantic type
        semantic_type = detect_semantic_type(series, examples)

        # Detect role
        role = detect_column_role(col, dtype, unique_rate, null_rate, examples)

        # Stats
        min_val: Optional[Any] = None
        max_val: Optional[Any] = None
        mean_val: Optional[float] = None
        std_val: Optional[float] = None

        if semantic_type == "numeric" and series.dtype != object:
            numeric_series = pd.to_numeric(series, errors="coerce")
            if numeric_series.notna().any():
                min_val = float(numeric_series.min()) if not pd.isna(numeric_series.min()) else None
                max_val = float(numeric_series.max()) if not pd.isna(numeric_series.max()) else None
                mean_val = float(numeric_series.mean()) if not pd.isna(numeric_series.mean()) else None
                std_val = float(numeric_series.std()) if not pd.isna(numeric_series.std()) else None
        elif semantic_type == "datetime":
            dt_series = pd.to_datetime(series, errors="coerce")
            if dt_series.notna().any():
                min_val = dt_series.min().isoformat() if not pd.isna(dt_series.min()) else None
                max_val = dt_series.max().isoformat() if not pd.isna(dt_series.max()) else None

        col_warnings: List[str] = []
        if null_rate > 0.5:
            col_warnings.append(f"缺失率 {null_rate * 100:.1f}%")
        if unique_rate > 0.95 and not role.endswith("_id"):
            col_warnings.append(f"接近唯一值（{unique_rate * 100:.1f}%）")
        if unique_count == 1 and row_count > 1:
            col_warnings.append("常数列")

        column_profiles.append({
            "name": col,
            "dtype": dtype,
            "semanticType": semantic_type,
            "role": role,
            "nullCount": null_count,
            "nullRate": round(null_rate, 4),
            "uniqueCount": unique_count,
            "uniqueRate": round(unique_rate, 4),
            "examples": examples,
            "min": min_val,
            "max": max_val,
            "mean": mean_val,
            "std": std_val,
            "warnings": col_warnings,
        })

    # Table classification
    classification = classify_table(column_profiles, row_count)

    # Quality warnings
    quality_warnings = compute_quality_warnings(column_profiles, row_count, col_count)

    # Additional classification-level warnings
    if classification["tableType"] == "event_log" and not any(c["role"] == "timestamp" for c in column_profiles):
        classification["warnings"] = classification.get("warnings", [])
        classification["warnings"].append("疑似事件日志但未检测到时间戳列")
    if classification["tableType"] == "metric_summary" and not any(c["role"] == "date" for c in column_profiles):
        classification["warnings"] = classification.get("warnings", [])
        classification["warnings"].append("疑似指标汇总表但未检测到日期列")

    from datetime import datetime, timezone
    return {
        "datasetId": dataset_id,
        "name": name,
        "rowCount": row_count,
        "columnCount": col_count,
        "columns": column_profiles,
        "classification": classification,
        "qualityWarnings": quality_warnings,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def clean_example(value: Any) -> Any:
    """Clean a single example value for JSON serialization."""
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer, np.floating)):
        return float(value) if isinstance(value, np.floating) else int(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value
