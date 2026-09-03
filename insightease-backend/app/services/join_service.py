"""Deterministic multi-table join preview, risk checks, and dataset creation."""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import storage
from app.core.transform_executor import serialize_dataframe
from app.models.models import Dataset
from app.schemas.join import DerivedDatasetMetadata, JoinPlan, JoinPreview, JoinRiskSummary, JoinStep
from app.services.dataset_io_service import check_dataset_file_size, load_dataset_dataframe


logger = logging.getLogger(__name__)

MAX_SOURCE_DATASETS = 3
MAX_SOURCE_ROWS = 250_000
MAX_OUTPUT_ROWS = 1_000_000
MAX_OUTPUT_COLUMNS = 200
MAX_PREVIEW_ROWS = 50
RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "blocked": 3}


async def preview_join_plan(
    plan: JoinPlan,
    datasets: Dict[str, Dataset],
    max_preview_rows: int = 20,
) -> tuple[JoinPreview, pd.DataFrame]:
    """Validate, execute, and return a bounded preview without persistence."""
    _validate_dataset_inventory(plan, datasets)
    frames_list = await asyncio.gather(
        *(load_dataset_dataframe(datasets[dataset_id]) for dataset_id in plan.included_dataset_ids)
    )
    frames = dict(zip(plan.included_dataset_ids, frames_list))
    return build_join_preview(plan, datasets, frames, max_preview_rows)


def build_join_preview(
    plan: JoinPlan,
    datasets: Dict[str, Dataset],
    frames: Dict[str, pd.DataFrame],
    max_preview_rows: int = 20,
) -> tuple[JoinPreview, pd.DataFrame]:
    """Pure dataframe join engine used by endpoints and unit tests."""
    _validate_dataset_inventory(plan, datasets)
    _validate_frames(plan, frames)
    selected_fields = _selected_fields_with_join_keys(plan)
    base_id = plan.base_dataset_id
    base_columns = selected_fields[base_id]
    result = frames[base_id][base_columns].copy()
    column_map: dict[tuple[str, str], str] = {(base_id, field): field for field in base_columns}
    joined_dataset_ids = {base_id}
    step_metrics = []

    if len(result.columns) > MAX_OUTPUT_COLUMNS:
        raise HTTPException(413, detail=f"Join 输出列数超过 {MAX_OUTPUT_COLUMNS} 列限制")

    for index, step in enumerate(plan.join_steps, start=1):
        _validate_step(step, plan, joined_dataset_ids)
        relationship = _matching_relationship(step, plan)
        if relationship is None:
            raise HTTPException(422, detail="Join 关系未在当前已确认关系快照中")
        if step.expected_cardinality != _oriented_expected_cardinality(step, relationship):
            raise HTTPException(422, detail="Join 步骤与已确认关系的预期基数不一致")

        left_key = column_map.get((step.left_dataset_id, step.left_field))
        if not left_key or left_key not in result.columns:
            raise HTTPException(422, detail="Join 左侧字段不存在于当前中间结果")

        right_source = frames[step.right_dataset_id]
        right_columns = selected_fields[step.right_dataset_id]
        right = right_source[right_columns].copy()
        rename_map = _right_column_names(
            right_columns,
            set(str(column) for column in result.columns),
            datasets[step.right_dataset_id].filename,
        )
        right = right.rename(columns=rename_map)
        right_key = rename_map[step.right_field]
        for source_field, output_field in rename_map.items():
            column_map[(step.right_dataset_id, source_field)] = output_field

        metrics_seed = _join_metrics_seed(result[left_key], right[right_key], step)
        estimated_rows = _estimate_output_rows(
            result[left_key], right[right_key], step.join_type
        )
        base_rows = max(len(result), 1)
        estimated_multiplier = estimated_rows / base_rows
        if estimated_rows > MAX_OUTPUT_ROWS or estimated_multiplier > 5:
            reason = (
                f"Join 预计产生 {estimated_rows:,} 行，超过安全限制"
                if estimated_rows > MAX_OUTPUT_ROWS
                else f"Join 预计使行数扩大 {estimated_multiplier:.2f} 倍"
            )
            blocked_step = {
                "step_index": index,
                "left_dataset_id": step.left_dataset_id,
                "right_dataset_id": step.right_dataset_id,
                "left_row_count": metrics_seed["left_rows"],
                "right_row_count": metrics_seed["right_rows"],
                "output_row_count": estimated_rows,
                "matched_left_rows": metrics_seed["matched_left_rows"],
                "unmatched_left_rows": metrics_seed["unmatched_left_rows"],
                "unmatched_right_rows": metrics_seed["unmatched_right_rows"],
                "match_rate": metrics_seed["match_rate"],
                "left_null_key_count": metrics_seed["left_null_key_count"],
                "right_null_key_count": metrics_seed["right_null_key_count"],
                "left_null_key_rate": metrics_seed["left_null_key_rate"],
                "right_null_key_rate": metrics_seed["right_null_key_rate"],
                "left_duplicate_key_count": metrics_seed["left_duplicate_key_count"],
                "right_duplicate_key_count": metrics_seed["right_duplicate_key_count"],
                "left_duplicate_key_rate": metrics_seed["left_duplicate_key_rate"],
                "right_duplicate_key_rate": metrics_seed["right_duplicate_key_rate"],
                "left_unique_key_count": metrics_seed["left_unique_key_count"],
                "right_unique_key_count": metrics_seed["right_unique_key_count"],
                "cardinality": metrics_seed["cardinality"],
                "row_multiplier": estimated_multiplier,
                "risk_level": "blocked",
                "warnings": [reason],
            }
            all_steps = [*step_metrics, blocked_step]
            output_columns = [
                *[str(column) for column in result.columns],
                *[output for source, output in rename_map.items() if source != step.right_field],
            ]
            return JoinPreview(
                input_dataset_ids=plan.included_dataset_ids,
                input_row_counts={dataset_id: len(frames[dataset_id]) for dataset_id in plan.included_dataset_ids},
                output_row_count=estimated_rows,
                output_column_count=len(output_columns),
                output_columns=output_columns,
                preview_rows=[],
                preview_limit=min(max_preview_rows, MAX_PREVIEW_ROWS),
                step_metrics=all_steps,
                risk_summary=JoinRiskSummary(
                    risk_level="blocked",
                    row_multiplier=estimated_rows / max(len(frames[base_id]), 1),
                    cardinalities=[item["cardinality"] for item in all_steps],
                    base_grain=Path(datasets[base_id].filename).stem,
                    result_grain="unknown",
                    warnings=list(dict.fromkeys(
                        [warning for item in all_steps for warning in item["warnings"]]
                    )),
                    blocked_reasons=[reason],
                ),
            ), result

        result = _merge_without_null_matching(
            result,
            right,
            left_key,
            right_key,
            step.join_type,
            index,
        )
        # The right join key is intentionally removed from the output. Keep its
        # lineage mapped to the surviving left key so a third table can join
        # through the dataset that was added in this step.
        column_map[(step.right_dataset_id, step.right_field)] = left_key
        if len(result.columns) > MAX_OUTPUT_COLUMNS:
            raise HTTPException(413, detail=f"Join 输出列数超过 {MAX_OUTPUT_COLUMNS} 列限制")

        risk_level, warnings = _step_risk(
            metrics_seed,
            len(result) / base_rows,
            step.expected_cardinality,
            relationship.risk_level,
        )
        step_metrics.append(
            {
                "step_index": index,
                "left_dataset_id": step.left_dataset_id,
                "right_dataset_id": step.right_dataset_id,
                "left_row_count": metrics_seed["left_rows"],
                "right_row_count": metrics_seed["right_rows"],
                "output_row_count": len(result),
                "matched_left_rows": metrics_seed["matched_left_rows"],
                "unmatched_left_rows": metrics_seed["unmatched_left_rows"],
                "unmatched_right_rows": metrics_seed["unmatched_right_rows"],
                "match_rate": metrics_seed["match_rate"],
                "left_null_key_count": metrics_seed["left_null_key_count"],
                "right_null_key_count": metrics_seed["right_null_key_count"],
                "left_null_key_rate": metrics_seed["left_null_key_rate"],
                "right_null_key_rate": metrics_seed["right_null_key_rate"],
                "left_duplicate_key_count": metrics_seed["left_duplicate_key_count"],
                "right_duplicate_key_count": metrics_seed["right_duplicate_key_count"],
                "left_duplicate_key_rate": metrics_seed["left_duplicate_key_rate"],
                "right_duplicate_key_rate": metrics_seed["right_duplicate_key_rate"],
                "left_unique_key_count": metrics_seed["left_unique_key_count"],
                "right_unique_key_count": metrics_seed["right_unique_key_count"],
                "cardinality": metrics_seed["cardinality"],
                "row_multiplier": len(result) / base_rows,
                "risk_level": risk_level,
                "warnings": warnings,
            }
        )
        joined_dataset_ids.add(step.right_dataset_id)

    if joined_dataset_ids != set(plan.included_dataset_ids):
        raise HTTPException(422, detail="Join 计划未连接全部源数据集")

    columns, preview_rows, total_rows = serialize_dataframe(
        result,
        limit=min(max_preview_rows, MAX_PREVIEW_ROWS),
    )
    overall_risk = max(
        (item["risk_level"] for item in step_metrics),
        key=lambda value: RISK_ORDER[value],
        default="low",
    )
    all_warnings = list(dict.fromkeys(
        [warning for item in step_metrics for warning in item["warnings"]]
    ))
    cardinalities = [item["cardinality"] for item in step_metrics]
    grain_shift = any(value in {"one_to_many", "many_to_many"} for value in cardinalities)
    if grain_shift:
        all_warnings.append("Join 后结果粒度可能变细；基础表级指标可能重复，请在分析前确认聚合口径。")
    risk_summary = JoinRiskSummary(
        risk_level=overall_risk,
        row_multiplier=total_rows / max(len(frames[base_id]), 1),
        cardinalities=cardinalities,
        base_grain=Path(datasets[base_id].filename).stem,
        result_grain="likely_detail" if grain_shift else Path(datasets[base_id].filename).stem,
        warnings=all_warnings,
        blocked_reasons=[],
    )
    preview = JoinPreview(
        input_dataset_ids=plan.included_dataset_ids,
        input_row_counts={dataset_id: len(frames[dataset_id]) for dataset_id in plan.included_dataset_ids},
        output_row_count=total_rows,
        output_column_count=len(columns),
        output_columns=columns,
        preview_rows=preview_rows,
        preview_limit=min(max_preview_rows, MAX_PREVIEW_ROWS),
        step_metrics=step_metrics,
        risk_summary=risk_summary,
    )
    return preview, result


async def create_joined_dataset(
    *,
    plan: JoinPlan,
    datasets: Dict[str, Dataset],
    filename: str,
    confirm_high_risk: bool,
    db: AsyncSession,
    current_user_id: str,
) -> DerivedDatasetMetadata:
    preview, result = await preview_join_plan(plan, datasets, MAX_PREVIEW_ROWS)
    risk = preview.risk_summary
    if risk.risk_level == "blocked":
        raise HTTPException(422, detail="该 Join 已被安全规则阻止，不能创建数据集")
    if risk.risk_level == "high" and not confirm_high_risk:
        raise HTTPException(409, detail="该 Join 风险较高，需要再次明确确认")

    safe_filename = _sanitize_filename(filename)
    dataset_id = str(uuid.uuid4())
    file_content = result.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
    storage_path = None
    try:
        storage_path = await storage.save(dataset_id, safe_filename, file_content)
        from app.api.v1.endpoints.datasets import calculate_quality_score

        schema = [
            {
                "name": str(column),
                "dtype": str(result[column].dtype),
                "sample_values": _json_safe_sample_values(result, column),
            }
            for column in result.columns
        ]
        created_at = datetime.now(timezone.utc)
        dataset = Dataset(
            id=dataset_id,
            user_id=current_user_id,
            filename=safe_filename,
            storage_path=storage_path,
            file_size=len(file_content),
            row_count=len(result),
            col_count=len(result.columns),
            schema=schema,
            quality_score=calculate_quality_score(result),
            status="ready",
            parent_dataset_id=plan.base_dataset_id,
            source_dataset_ids=plan.included_dataset_ids,
            derivation_type="join",
            derivation_plan=plan.model_dump(),
            derivation_risk_summary=risk.model_dump(),
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)
        return DerivedDatasetMetadata(
            dataset_id=dataset_id,
            filename=safe_filename,
            source_dataset_ids=plan.included_dataset_ids,
            source_analysis_plan_id=plan.source_analysis_plan_id,
            derivation_type="join",
            row_count=len(result),
            col_count=len(result.columns),
            risk_summary=risk,
            created_at=(dataset.created_at or created_at).isoformat(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        if storage_path:
            try:
                await storage.delete(storage_path)
            except Exception:
                logger.exception("Failed to clean up joined dataset storage")
        logger.exception("Joined dataset creation failed")
        raise HTTPException(500, detail="分析数据集创建失败") from exc


def _validate_dataset_inventory(plan: JoinPlan, datasets: Dict[str, Dataset]) -> None:
    if len(plan.included_dataset_ids) > MAX_SOURCE_DATASETS:
        raise HTTPException(422, detail=f"最多支持 {MAX_SOURCE_DATASETS} 个源数据集")
    if set(datasets) != set(plan.included_dataset_ids):
        raise HTTPException(404, detail="一个或多个源数据集不存在")
    for dataset in datasets.values():
        check_dataset_file_size(dataset)
        if (dataset.row_count or 0) > MAX_SOURCE_ROWS:
            raise HTTPException(413, detail=f"单个源数据集不能超过 {MAX_SOURCE_ROWS:,} 行")


def _validate_frames(plan: JoinPlan, frames: Dict[str, pd.DataFrame]) -> None:
    if set(frames) != set(plan.included_dataset_ids):
        raise HTTPException(422, detail="Join 输入数据集不完整")
    selected = _selected_fields_with_join_keys(plan)
    for dataset_id, fields in selected.items():
        frame = frames[dataset_id]
        if len(frame) > MAX_SOURCE_ROWS:
            raise HTTPException(413, detail=f"单个源数据集不能超过 {MAX_SOURCE_ROWS:,} 行")
        frame.columns = [str(column) for column in frame.columns]
        missing = set(fields) - set(frame.columns)
        if missing:
            raise HTTPException(422, detail="Join 所需字段不存在")


def _selected_fields_with_join_keys(plan: JoinPlan) -> dict[str, list[str]]:
    selected = {
        dataset_id: list(dict.fromkeys(plan.selected_fields.get(dataset_id, [])))
        for dataset_id in plan.included_dataset_ids
    }
    for step in plan.join_steps:
        selected[step.left_dataset_id] = list(dict.fromkeys([*selected[step.left_dataset_id], step.left_field]))
        selected[step.right_dataset_id] = list(dict.fromkeys([*selected[step.right_dataset_id], step.right_field]))
    return selected


def _validate_step(step: JoinStep, plan: JoinPlan, joined_ids: set[str]) -> None:
    if step.left_dataset_id not in joined_ids:
        raise HTTPException(422, detail="Join 步骤顺序无效：左表尚未加入中间结果")
    if step.right_dataset_id in joined_ids or step.right_dataset_id not in plan.included_dataset_ids:
        raise HTTPException(422, detail="Join 步骤顺序无效：右表必须是尚未加入的源数据集")


def _matching_relationship(step: JoinStep, plan: JoinPlan):
    for relationship in plan.confirmed_relationships:
        direct = (
            relationship.id == step.relationship_id
            and relationship.source_dataset_id == step.left_dataset_id
            and relationship.source_field == step.left_field
            and relationship.target_dataset_id == step.right_dataset_id
            and relationship.target_field == step.right_field
        )
        reverse = (
            relationship.id == step.relationship_id
            and relationship.target_dataset_id == step.left_dataset_id
            and relationship.target_field == step.left_field
            and relationship.source_dataset_id == step.right_dataset_id
            and relationship.source_field == step.right_field
        )
        if direct or reverse:
            return relationship
    return None


def _oriented_expected_cardinality(step: JoinStep, relationship) -> str:
    direct = (
        relationship.source_dataset_id == step.left_dataset_id
        and relationship.target_dataset_id == step.right_dataset_id
    )
    if direct:
        return relationship.expected_cardinality
    return {
        "one_to_many": "many_to_one",
        "many_to_one": "one_to_many",
    }.get(relationship.expected_cardinality, relationship.expected_cardinality)


def _right_column_names(fields: list[str], existing: set[str], filename: str) -> dict[str, str]:
    prefix = re.sub(r"[^A-Za-z0-9_]+", "_", Path(filename).stem).strip("_") or "joined"
    renamed = {}
    occupied = set(existing)
    for field in fields:
        candidate = field if field not in occupied else f"{prefix}__{field}"
        suffix = 2
        while candidate in occupied:
            candidate = f"{prefix}__{field}_{suffix}"
            suffix += 1
        renamed[field] = candidate
        occupied.add(candidate)
    return renamed


def _merge_without_null_matching(
    left: pd.DataFrame,
    right: pd.DataFrame,
    left_key: str,
    right_key: str,
    join_type: str,
    step_index: int,
) -> pd.DataFrame:
    left_copy = left.copy()
    right_copy = right.copy()
    temp_key = f"__insightease_join_key_{step_index}__"
    left_copy[temp_key] = left_copy[left_key].astype("object")
    right_copy[temp_key] = right_copy[right_key].astype("object")
    left_null = left_copy[temp_key].isna()
    right_null = right_copy[temp_key].isna()
    # Identity-only sentinels cannot collide with real user key values and each
    # null receives a different object, so nulls never match one another.
    left_copy.loc[left_null, temp_key] = [object() for _ in range(left_null.sum())]
    right_copy.loc[right_null, temp_key] = [object() for _ in range(right_null.sum())]
    right_copy = right_copy.drop(columns=[right_key])
    return left_copy.merge(right_copy, on=temp_key, how=join_type, sort=False).drop(columns=[temp_key])


def _join_metrics_seed(left: pd.Series, right: pd.Series, step: JoinStep) -> dict:
    left_non_null = left.dropna()
    right_non_null = right.dropna()
    left_rows = len(left)
    right_rows = len(right)
    right_values = set(right_non_null.tolist())
    left_values = set(left_non_null.tolist())
    matched_left_rows = int(left_non_null.isin(right_values).sum())
    left_unique = not left_non_null.duplicated().any()
    right_unique = not right_non_null.duplicated().any()
    cardinality = (
        "one_to_one" if left_unique and right_unique
        else "one_to_many" if left_unique
        else "many_to_one" if right_unique
        else "many_to_many"
    )
    return {
        "left_rows": left_rows,
        "right_rows": right_rows,
        "matched_left_rows": matched_left_rows,
        "unmatched_left_rows": left_rows - matched_left_rows,
        "unmatched_right_rows": int((~right_non_null.isin(left_values)).sum()) + int(right.isna().sum()),
        "match_rate": matched_left_rows / max(left_rows, 1),
        "left_null_key_count": int(left.isna().sum()),
        "right_null_key_count": int(right.isna().sum()),
        "left_null_key_rate": float(left.isna().mean()) if left_rows else 0.0,
        "right_null_key_rate": float(right.isna().mean()) if right_rows else 0.0,
        "left_duplicate_key_count": int(left_non_null.duplicated(keep=False).sum()),
        "right_duplicate_key_count": int(right_non_null.duplicated(keep=False).sum()),
        "left_duplicate_key_rate": float(left_non_null.duplicated(keep=False).mean()) if len(left_non_null) else 0.0,
        "right_duplicate_key_rate": float(right_non_null.duplicated(keep=False).mean()) if len(right_non_null) else 0.0,
        "left_unique_key_count": int(left_non_null.nunique()),
        "right_unique_key_count": int(right_non_null.nunique()),
        "cardinality": cardinality,
    }


def _estimate_output_rows(left: pd.Series, right: pd.Series, join_type: str) -> int:
    left_counts = left.dropna().value_counts(dropna=True)
    right_counts = right.dropna().value_counts(dropna=True)
    matched = sum(int(count) * int(right_counts.get(key, 0)) for key, count in left_counts.items())
    if join_type == "inner":
        return matched
    unmatched = int(left.isna().sum()) + sum(
        int(count) for key, count in left_counts.items() if key not in right_counts
    )
    return matched + unmatched


def _step_risk(
    metrics: dict,
    row_multiplier: float,
    expected: str,
    relationship_risk: str,
) -> tuple[str, list[str]]:
    risk = "low"
    warnings = []
    cardinality = metrics["cardinality"]
    if relationship_risk == "high":
        risk = "high"
        warnings.append("当前已确认关系被标记为高风险。")
    elif relationship_risk == "medium":
        risk = "medium"
        warnings.append("当前已确认关系需要关注匹配质量。")
    if cardinality == "many_to_many":
        risk = "high"
        warnings.append("检测到多对多 Join，指标可能因重复匹配而被放大。")
    if expected != "unknown" and cardinality != expected:
        risk = "high"
        warnings.append(f"实际基数 {cardinality} 与计划预期 {expected} 不一致。")
    if row_multiplier > 2:
        risk = "high"
        warnings.append(f"Join 使当前结果行数扩大 {row_multiplier:.2f} 倍。")
    elif row_multiplier > 1.2 and RISK_ORDER[risk] < RISK_ORDER["medium"]:
        risk = "medium"
        warnings.append(f"Join 使当前结果行数扩大 {row_multiplier:.2f} 倍。")
    if metrics["match_rate"] < 0.5:
        risk = "high"
        warnings.append("左侧 Join key 匹配率低于 50%。")
    elif metrics["match_rate"] < 0.8 and RISK_ORDER[risk] < RISK_ORDER["medium"]:
        risk = "medium"
        warnings.append("左侧 Join key 存在较多未匹配记录。")
    if max(metrics["left_null_key_rate"], metrics["right_null_key_rate"]) > 0.1:
        if RISK_ORDER[risk] < RISK_ORDER["medium"]:
            risk = "medium"
        warnings.append("Join key 缺失率超过 10%。")
    return risk, warnings


def _sanitize_filename(filename: str) -> str:
    basename = Path(filename).name
    stem = re.sub(r"[^A-Za-z0-9_\-\u4e00-\u9fff]+", "_", Path(basename).stem).strip("_")
    if not stem:
        stem = f"analysis_dataset_{datetime.now().strftime('%Y%m%d_%H%M')}"
    return f"{stem[:180]}.csv"


def _json_safe_sample_values(frame: pd.DataFrame, column) -> list:
    column_name = str(column)
    _, rows, _ = serialize_dataframe(frame[[column]].dropna().head(3), limit=3)
    return [row[column_name] for row in rows]
