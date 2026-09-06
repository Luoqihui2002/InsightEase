"""
AI Data Assistant — Relationship Inference Service.

Deterministic, metadata-only relationship inference. No LLM calls.
No raw value reads. Read-only: never modifies datasets.
"""

from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import re

from app.services.assistant_profile_service import profile_dataset, _clean_name, ID_ROLE_PATTERNS


# ---------------------------------------------------------------------------
# Synonym mappings for column name matching
# ---------------------------------------------------------------------------

COLUMN_SYNONYMS: Dict[str, List[str]] = {
    "user_id": ["user_id", "userid", "uid", "customer_id", "buyer_id", "member_id"],
    "product_id": ["product_id", "productid", "pid", "sku", "item_id", "goods_id", "sku_id", "spu_id"],
    "order_id": ["order_id", "orderid", "oid", "transaction_id", "purchase_id", "txn_id"],
    "session_id": ["session_id", "sessionid", "sid", "visit_id"],
    "device_id": ["device_id", "deviceid", "did", "machine_id"],
    "campaign_id": ["campaign_id", "campaignid", "cid", "ad_id", "promotion_id"],
}

# Flatten synonym groups for reverse lookup
SYNONYM_TO_CANONICAL: Dict[str, str] = {}
for canonical, synonyms in COLUMN_SYNONYMS.items():
    for s in synonyms:
        SYNONYM_TO_CANONICAL[_clean_name(s)] = canonical


# ---------------------------------------------------------------------------
# Table type direction preferences
# ---------------------------------------------------------------------------

# Preferred source (fact/transactional tables) -> target (dimension/entity tables)
TABLE_TYPE_SOURCE_PRIORITY = [
    "order", "event_log", "campaign", "experiment",
    "transaction", "review_text", "metric_summary", "unknown",
]
TABLE_TYPE_TARGET_PRIORITY = [
    "user", "product", "dimension",
    "order", "event_log", "campaign", "experiment",
    "transaction", "review_text", "metric_summary", "unknown",
]


def _table_type_priority(table_type: str, is_source: bool = True) -> int:
    """Lower number = higher priority for source/target role."""
    priority_list = TABLE_TYPE_SOURCE_PRIORITY if is_source else TABLE_TYPE_TARGET_PRIORITY
    try:
        return priority_list.index(table_type)
    except ValueError:
        return 999


# ---------------------------------------------------------------------------
# Column name normalization for matching
# ---------------------------------------------------------------------------

def _normalize_name(name: str) -> str:
    """Normalize column name for comparison."""
    n = name.lower().strip()
    n = re.sub(r'[\s\-_]+', '', n)
    n = re.sub(r'([a-z])([A-Z])', r'\1\2', n)  # camelCase -> camelcase
    return n


def _strip_prefix(name: str) -> str:
    """Strip common prefixes like buyer_, seller_, source_, target_."""
    prefixes = ["buyer", "seller", "recipient", "source", "target", "sender", "receiver"]
    n = _clean_name(name)
    for prefix in prefixes:
        if n.startswith(prefix + "_"):
            return n[len(prefix) + 1:]
    return n


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------

METRIC_ROLES = {"metric", "amount_revenue"}
TEXT_ROLES = {"text_field"}
ID_ROLES = {"user_id", "device_id", "session_id", "order_id", "product_id", "unknown"}


def _is_key_like_column(col: Dict[str, Any]) -> bool:
    """Determine if a column is plausible as a relationship key."""
    role = col.get("role", "unknown")
    name = col.get("name", "")
    null_rate = col.get("nullRate", 0)
    unique_rate = col.get("uniqueRate", 0)

    # Exclude metric and text columns
    if role in METRIC_ROLES or role in TEXT_ROLES:
        return False

    # Exclude high-null columns unless strong ID signal
    if null_rate > 0.3:
        # Allow if exact name match with known ID pattern
        cname = _clean_name(name)
        if cname not in ID_ROLE_PATTERNS and not cname.endswith("_id"):
            return False

    # Include specific ID roles
    if role in ID_ROLES:
        return True

    # Include columns ending with _id
    if _clean_name(name).endswith("_id"):
        return True

    # Include high-unique identifier-like columns
    if unique_rate > 0.5 and _clean_name(name).endswith("_id"):
        return True

    return False


def _generate_candidates(
    profiles: Dict[str, Dict[str, Any]],
    max_per_pair: int = 20,
) -> List[Tuple[str, str, str, str]]:
    """
    Generate candidate column pairs between different datasets.

    Returns list of (source_dataset_id, target_dataset_id, source_column, target_column).
    """
    dataset_ids = list(profiles.keys())
    candidates: List[Tuple[str, str, str, str, float]] = []

    for i in range(len(dataset_ids)):
        for j in range(len(dataset_ids)):
            if i == j:
                continue
            source_id = dataset_ids[i]
            target_id = dataset_ids[j]
            source_profile = profiles[source_id]
            target_profile = profiles[target_id]
            source_cols = [c for c in source_profile.get("columns", []) if _is_key_like_column(c)]
            target_cols = [c for c in target_profile.get("columns", []) if _is_key_like_column(c)]

            pair_candidates: List[Tuple[str, str, str, str, float]] = []
            for sc in source_cols:
                for tc in target_cols:
                    score = _quick_pair_score(sc, tc)
                    if score > 0:
                        pair_candidates.append((source_id, target_id, sc["name"], tc["name"], score))

            # Sort by quick score and take top N per pair
            pair_candidates.sort(key=lambda x: x[4], reverse=True)
            candidates.extend(pair_candidates[:max_per_pair])

    return [(s, t, sc, tc) for s, t, sc, tc, _ in candidates]


def _quick_pair_score(source_col: Dict[str, Any], target_col: Dict[str, Any]) -> float:
    """Fast pre-filter score for candidate generation. Reject incompatible pairs."""
    s_name = source_col.get("name", "")
    t_name = target_col.get("name", "")
    s_role = source_col.get("role", "unknown")
    t_role = target_col.get("role", "unknown")
    s_type = source_col.get("semanticType", "unknown")
    t_type = target_col.get("semanticType", "unknown")

    # Reject metric/text role mismatches
    if (s_role in METRIC_ROLES or t_role in METRIC_ROLES or
        s_role in TEXT_ROLES or t_role in TEXT_ROLES):
        return 0.0

    # Reject type-incompatible
    if not _types_compatible(s_type, t_type):
        return 0.0

    # Name match quick score
    s_norm = _normalize_name(s_name)
    t_norm = _normalize_name(t_name)
    s_strip = _normalize_name(_strip_prefix(s_name))
    t_strip = _normalize_name(_strip_prefix(t_name))

    if s_norm == t_norm:
        return 1.0
    if s_strip == t_strip:
        return 0.8
    # Synonym match
    s_canon = SYNONYM_TO_CANONICAL.get(_clean_name(s_name))
    t_canon = SYNONYM_TO_CANONICAL.get(_clean_name(t_name))
    if s_canon and t_canon and s_canon == t_canon:
        return 0.9

    # Weak match: same suffix _id
    if s_norm.endswith("id") and t_norm.endswith("id"):
        return 0.3

    return 0.0


def _types_compatible(t1: str, t2: str) -> bool:
    """Check if two semantic types are compatible for joining."""
    # Same family
    if t1 == t2:
        return True
    # String IDs can often match integer IDs
    if (t1 in ("text", "categorical") and t2 in ("numeric", "text", "categorical")):
        return True
    if (t2 in ("text", "categorical") and t1 in ("numeric", "text", "categorical")):
        return True
    # Boolean is tricky for joins
    if t1 == "boolean" or t2 == "boolean":
        return False
    return False


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score_column_name_match(s_name: str, t_name: str) -> Tuple[float, str]:
    """Score column name similarity."""
    s_clean = _clean_name(s_name)
    t_clean = _clean_name(t_name)
    s_norm = _normalize_name(s_name)
    t_norm = _normalize_name(t_name)
    s_strip = _normalize_name(_strip_prefix(s_name))
    t_strip = _normalize_name(_strip_prefix(t_name))

    # Exact match
    if s_clean == t_clean:
        return 0.35, f"列名完全匹配：{s_name}"

    # Normalized match
    if s_norm == t_norm:
        return 0.30, f"列名规范化后匹配：{s_name} <-> {t_name}"

    # Strip prefix match
    if s_strip == t_strip:
        return 0.25, f"去除前缀后匹配：{s_name} <-> {t_name}"

    # Synonym match
    s_canon = SYNONYM_TO_CANONICAL.get(s_clean)
    t_canon = SYNONYM_TO_CANONICAL.get(t_clean)
    if s_canon and t_canon and s_canon == t_canon:
        return 0.25, f"列名为同义标识符：{s_name} <-> {t_name}"

    # Weak partial
    if s_norm in t_norm or t_norm in s_norm:
        return 0.10, f"列名部分相似：{s_name} <-> {t_name}"

    return 0.0, ""


def _score_role_match(s_role: str, t_role: str) -> Tuple[float, str]:
    """Score column role compatibility."""
    if s_role == t_role and s_role in ID_ROLES:
        return 0.25, f"字段角色一致：两侧均识别为 {s_role}"
    # Compatible ID roles
    if s_role in ID_ROLES and t_role in ID_ROLES:
        return 0.15, f"字段角色兼容：{s_role} <-> {t_role}"
    # Incompatible
    if s_role in METRIC_ROLES or t_role in METRIC_ROLES:
        return -1.0, ""
    if s_role in TEXT_ROLES or t_role in TEXT_ROLES:
        return -1.0, ""
    return 0.0, ""


def _score_type_match(s_type: str, t_type: str) -> Tuple[float, str]:
    """Score type compatibility."""
    if s_type == t_type:
        return 0.15, f"字段类型一致：{s_type}"
    if (s_type in ("text", "categorical") and t_type in ("numeric", "text", "categorical")):
        return 0.10, f"字段类型可兼容：{s_type} <-> {t_type}"
    if (t_type in ("text", "categorical") and s_type in ("numeric", "text", "categorical")):
        return 0.10, f"字段类型可兼容：{s_type} <-> {t_type}"
    return 0.0, ""


def _score_uniqueness(
    s_unique_rate: float, t_unique_rate: float,
    s_row_count: int, t_row_count: int
) -> Tuple[float, str, List[str]]:
    """Score uniqueness/cardinality signal."""
    warnings: List[str] = []
    score = 0.0
    message = ""

    s_is_unique = s_unique_rate >= 0.9
    t_is_unique = t_unique_rate >= 0.9
    s_is_low = s_unique_rate < 0.5
    t_is_low = t_unique_rate < 0.5

    if s_is_unique and not t_is_unique:
        score = 0.15
        message = f"唯一性信号：source 接近唯一（{s_unique_rate:.0%}），target 存在重复（{t_unique_rate:.0%}）"
    elif t_is_unique and not s_is_unique:
        score = 0.15
        message = f"唯一性信号：target 接近唯一（{t_unique_rate:.0%}），source 存在重复（{s_unique_rate:.0%}）"
    elif s_is_unique and t_is_unique:
        score = 0.10
        message = f"唯一性信号：两侧均接近唯一（source {s_unique_rate:.0%}，target {t_unique_rate:.0%}）"
    elif s_is_low and t_is_low:
        score = 0.03
        message = f"唯一性信号：两侧唯一性均较低，可能是 many-to-many"
        warnings.append("两侧字段唯一性均较低，关系可能是 many-to-many，请谨慎确认")

    return score, message, warnings


def _score_table_type_signal(
    source_table_type: str, target_table_type: str,
    s_role: str, t_role: str
) -> Tuple[float, str]:
    """Score semantic table type signal."""
    # Strong semantic pairs
    semantic_pairs: Dict[Tuple[str, str, str, str], float] = {
        ("order", "user", "user_id", "user_id"): 0.15,
        ("order", "product", "product_id", "product_id"): 0.15,
        ("event_log", "user", "user_id", "user_id"): 0.12,
        ("campaign", "user", "user_id", "user_id"): 0.12,
        ("experiment", "user", "user_id", "user_id"): 0.12,
        ("review_text", "user", "user_id", "user_id"): 0.12,
        ("review_text", "product", "product_id", "product_id"): 0.15,
        ("transaction", "user", "user_id", "user_id"): 0.12,
    }

    key = (source_table_type, target_table_type, s_role, t_role)
    if key in semantic_pairs:
        return semantic_pairs[key], f"表类型信号：{source_table_type} 通常通过 {s_role} 关联 {target_table_type}"

    # Generic user_id -> user table
    if target_table_type == "user" and t_role == "user_id" and s_role == "user_id":
        return 0.10, f"表类型信号：目标表为用户表，关联键为 user_id"
    # Generic product_id -> product table
    if target_table_type == "product" and t_role == "product_id" and s_role == "product_id":
        return 0.10, f"表类型信号：目标表为产品表，关联键为 product_id"

    return 0.0, ""


# ---------------------------------------------------------------------------
# Cardinality inference
# ---------------------------------------------------------------------------

def _infer_cardinality(
    s_unique_count: int | None, t_unique_count: int | None,
    s_non_null_count: int, t_non_null_count: int,
) -> str:
    """Infer non-null key cardinality from exact counts, never rounded rates."""
    for unique_count, non_null_count in (
        (s_unique_count, s_non_null_count), (t_unique_count, t_non_null_count),
    ):
        if (
            unique_count is None or non_null_count <= 0
            or unique_count <= 0 or unique_count > non_null_count
        ):
            return "unknown"

    s_unique = s_unique_count == s_non_null_count
    t_unique = t_unique_count == t_non_null_count
    if s_unique and t_unique:
        return "one_to_one"
    if t_unique:
        return "many_to_one"
    if s_unique:
        return "one_to_many"
    return "many_to_many"


# ---------------------------------------------------------------------------
# Direction selection
# ---------------------------------------------------------------------------

def _choose_direction(
    dataset_a: str, dataset_b: str,
    profile_a: Dict[str, Any], profile_b: Dict[str, Any],
    col_a: str, col_b: str,
    role_a: str, role_b: str,
) -> Tuple[str, str, str, str]:
    """
    Choose source -> target direction.
    Returns (source_id, target_id, source_col, target_col).
    """
    type_a = profile_a.get("classification", {}).get("tableType", "unknown")
    type_b = profile_b.get("classification", {}).get("tableType", "unknown")

    # Prefer fact/transactional as source, dimension/entity as target
    a_source_prio = _table_type_priority(type_a, is_source=True)
    b_source_prio = _table_type_priority(type_b, is_source=True)
    a_target_prio = _table_type_priority(type_a, is_source=False)
    b_target_prio = _table_type_priority(type_b, is_source=False)

    # Strong preference: one is clearly a source type, other is clearly a target type
    if a_source_prio < b_source_prio and b_target_prio < a_target_prio:
        return dataset_a, dataset_b, col_a, col_b
    if b_source_prio < a_source_prio and a_target_prio < b_target_prio:
        return dataset_b, dataset_a, col_b, col_a

    # Tie-break by table type priority
    if a_source_prio != b_source_prio:
        if a_source_prio < b_source_prio:
            return dataset_a, dataset_b, col_a, col_b
        else:
            return dataset_b, dataset_a, col_b, col_a

    # Final fallback: alphabetical by dataset id
    if dataset_a < dataset_b:
        return dataset_a, dataset_b, col_a, col_b
    return dataset_b, dataset_a, col_b, col_a


# ---------------------------------------------------------------------------
# Main inference
# ---------------------------------------------------------------------------

def infer_relationships(
    profiles: Dict[str, Dict[str, Any]],
    include_value_overlap: bool = False,
    max_candidates: int = 200,
) -> Dict[str, Any]:
    """
    Infer relationships between datasets using metadata only.

    Args:
        profiles: dict mapping dataset_id -> DatasetProfile
        include_value_overlap: not implemented; if True, adds a warning
        max_candidates: maximum number of relationships to return

    Returns:
        dict with keys: relationships, generated_at, warnings
    """
    from datetime import datetime, timezone

    response_warnings: List[str] = []
    if include_value_overlap:
        response_warnings.append("值重叠校验尚未实现，当前仅基于元数据推断")

    if len(profiles) < 2:
        response_warnings.append("数据集数量不足，至少需要 2 个数据集才能推断关系")
        return {
            "relationships": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "warnings": response_warnings,
        }

    # Generate candidates
    raw_candidates = _generate_candidates(profiles, max_per_pair=20)

    # Score each candidate
    scored_relationships: List[Dict[str, Any]] = []
    seen_pairs: set = set()

    for dataset_a_id, dataset_b_id, col_a_name, col_b_name in raw_candidates:
        profile_a = profiles[dataset_a_id]
        profile_b = profiles[dataset_b_id]

        col_a = next((c for c in profile_a.get("columns", []) if c["name"] == col_a_name), None)
        col_b = next((c for c in profile_b.get("columns", []) if c["name"] == col_b_name), None)
        if not col_a or not col_b:
            continue

        # Choose direction
        source_id, target_id, source_col_name, target_col_name = _choose_direction(
            dataset_a_id, dataset_b_id,
            profile_a, profile_b,
            col_a_name, col_b_name,
            col_a.get("role", "unknown"), col_b.get("role", "unknown"),
        )

        # Re-fetch columns after direction swap
        source_profile = profiles[source_id]
        target_profile = profiles[target_id]
        source_col = next((c for c in source_profile.get("columns", []) if c["name"] == source_col_name), None)
        target_col = next((c for c in target_profile.get("columns", []) if c["name"] == target_col_name), None)
        if not source_col or not target_col:
            continue

        # Deduplicate
        pair_key = (source_id, target_id, source_col_name, target_col_name)
        reverse_key = (target_id, source_id, target_col_name, source_col_name)
        if pair_key in seen_pairs or reverse_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)
        seen_pairs.add(reverse_key)

        # Score
        evidence: List[Dict[str, Any]] = []
        rel_warnings: List[str] = []
        total_score = 0.0

        # 1. Name match
        name_score, name_msg = _score_column_name_match(source_col_name, target_col_name)
        if name_score > 0:
            total_score += name_score
            evidence.append({"type": "column_name_match", "score": name_score, "message": name_msg})

        # 2. Role match
        s_role = source_col.get("role", "unknown")
        t_role = target_col.get("role", "unknown")
        role_score, role_msg = _score_role_match(s_role, t_role)
        if role_score > 0:
            total_score += role_score
            evidence.append({"type": "role_match", "score": role_score, "message": role_msg})
        elif role_score < 0:
            continue  # Reject incompatible roles

        # 3. Type match
        s_type = source_col.get("semanticType", "unknown")
        t_type = target_col.get("semanticType", "unknown")
        type_score, type_msg = _score_type_match(s_type, t_type)
        if type_score > 0:
            total_score += type_score
            evidence.append({"type": "type_compatibility", "score": type_score, "message": type_msg})

        # 4. Uniqueness
        uniq_score, uniq_msg, uniq_warnings = _score_uniqueness(
            source_col.get("uniqueRate", 0),
            target_col.get("uniqueRate", 0),
            source_profile.get("rowCount", 0),
            target_profile.get("rowCount", 0),
        )
        if uniq_score > 0:
            total_score += uniq_score
            evidence.append({"type": "uniqueness_signal", "score": uniq_score, "message": uniq_msg})
        rel_warnings.extend(uniq_warnings)

        # 5. Table type signal
        s_table_type = source_profile.get("classification", {}).get("tableType", "unknown")
        t_table_type = target_profile.get("classification", {}).get("tableType", "unknown")
        tt_score, tt_msg = _score_table_type_signal(s_table_type, t_table_type, s_role, t_role)
        if tt_score > 0:
            total_score += tt_score
            evidence.append({"type": "table_type_signal", "score": tt_score, "message": tt_msg})

        # 6. Null rate warning
        s_null = source_col.get("nullRate", 0)
        t_null = target_col.get("nullRate", 0)
        if s_null > 0.15 or t_null > 0.15:
            rel_warnings.append(f"该关联键缺失率较高（source {s_null:.0%}，target {t_null:.0%}），join 时可能丢失数据")
            total_score = max(0, total_score - 0.05)

        # Always add metadata-only warning per relationship
        rel_warnings.append("未进行值重叠校验，仅基于元数据推断")

        # Confidence cap
        confidence = min(1.0, round(total_score, 4))

        # Skip very low confidence
        if confidence < 0.15:
            continue

        # Cardinality
        cardinality = _infer_cardinality(
            source_col.get("uniqueCount"),
            target_col.get("uniqueCount"),
            source_profile.get("rowCount", 0) - source_col.get("nullCount", 0),
            target_profile.get("rowCount", 0) - target_col.get("nullCount", 0),
        )

        rel_id = f"rel_{source_id}_{source_col_name}__{target_id}_{target_col_name}"

        scored_relationships.append({
            "id": rel_id,
            "source_dataset_id": source_id,
            "target_dataset_id": target_id,
            "source_dataset_name": source_profile.get("name", source_id),
            "target_dataset_name": target_profile.get("name", target_id),
            "source_column": source_col_name,
            "target_column": target_col_name,
            "relationship_type": cardinality,
            "confidence": confidence,
            "status": "suggested",
            "evidence": evidence,
            "warnings": rel_warnings,
        })

    # Sort by confidence desc, then evidence count desc
    scored_relationships.sort(
        key=lambda r: (r["confidence"], len(r["evidence"])),
        reverse=True
    )

    # Filter by confidence threshold (default >= 0.45)
    filtered = [r for r in scored_relationships if r["confidence"] >= 0.45]

    # Cap results
    result = filtered[:max_candidates]

    return {
        "relationships": result,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "warnings": response_warnings,
    }
