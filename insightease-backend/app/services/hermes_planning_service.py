"""Deterministic, advisory fallback for Hermes analysis planning."""

from __future__ import annotations

from uuid import uuid4

from app.schemas.assistant import (
    AnalysisFieldRequirement,
    AnalysisMetricTarget,
    AnalysisRelationshipRequirement,
    AssistantAnalysisPlan,
    AssistantCandidateDataset,
    AssistantNextAction,
    BoundedPlanningContext,
    PlanningDatasetMetadata,
    RecommendedAnalysisType,
)
from app.schemas.hermes import HermesPlanAnalysisRequest


FALLBACK_WARNING = "Live planner unavailable; local deterministic planning was used."

ANALYSIS_RULES: list[tuple[RecommendedAnalysisType, tuple[str, ...]]] = [
    ("data_overview", ("数据概览", "字段概览", "字段类型", "schema", "data overview")),
    ("forecast", ("预测", "趋势", "未来", "forecast", "time series", "sales")),
    ("path_analysis", ("路径", "漏斗", "行为", "点击", "访问", "journey", "funnel", "path")),
    ("attribution", ("归因", "渠道", "触点", "转化率", "attribution", "channel", "campaign")),
    ("ab_test", ("a/b", "ab test", "实验", "treatment", "control", "variant")),
    ("smart_process", ("缺失", "异常", "清洗", "quality", "missing", "outlier", "clean")),
    ("regression", ("回归", "影响因素", "驱动因素", "regression", "drivers", "ltv")),
    ("visualization", ("可视化", "图表", "画图", "visualization", "chart")),
]

ANALYSIS_LABELS: dict[RecommendedAnalysisType, str] = {
    "descriptive": "描述性统计分析",
    "data_overview": "数据概览与字段统计",
    "attribution": "渠道转化归因分析",
    "forecast": "预测趋势分析",
    "path_analysis": "用户行为路径分析",
    "ab_test": "A/B 实验分析",
    "regression": "回归与驱动因素分析",
    "smart_process": "数据质量检查",
    "visualization": "数据可视化",
}

ANALYSIS_TARGETS: dict[RecommendedAnalysisType, str] = {
    "descriptive": "/app/statistics",
    "data_overview": "/app/data-overview",
    "attribution": "/app/attribution",
    "forecast": "/app/forecast",
    "path_analysis": "/app/path",
    "ab_test": "/app/statistics",
    "regression": "/app/statistics",
    "smart_process": "/app/data-workshop",
    "visualization": "/app/visualization",
}

FIELD_REQUIREMENTS = {
    "descriptive": [
        ("target_metric", False, "可选择数值指标做汇总或分布分析。"),
        ("dimension", False, "可选择分类字段做分组比较。"),
    ],
    "data_overview": [],
    "forecast": [
        ("time_column", True, "预测分析需要时间字段。"),
        ("target_metric", True, "预测分析需要目标指标。"),
    ],
    "path_analysis": [
        ("user_id", True, "路径分析需要用户或会话标识。"),
        ("event_name", True, "路径分析需要事件名称。"),
        ("time_column", False, "时间字段用于排序事件序列。"),
    ],
    "attribution": [
        ("user_id", True, "归因分析通常需要用户标识。"),
        ("dimension", True, "归因分析需要渠道或活动维度。"),
        ("target_metric", False, "可选择转化、订单或收入指标。"),
        ("time_column", False, "时间字段可用于触点排序。"),
    ],
    "ab_test": [
        ("group_column", True, "实验分析需要实验组字段。"),
        ("target_metric", True, "实验分析需要评估指标。"),
    ],
    "regression": [
        ("target_metric", True, "回归分析需要目标指标。"),
        ("feature", False, "可选择解释变量。"),
    ],
    "smart_process": [],
    "visualization": [
        ("dimension", False, "可选择图表维度。"),
        ("target_metric", False, "可选择图表指标。"),
    ],
}

FIELD_PATTERNS = {
    "time_column": ("date", "time", "timestamp", "day", "month", "created_at", "event_time"),
    "user_id": ("user_id", "uid", "customer_id", "member_id", "visitor_id", "session_id"),
    "event_name": ("event", "event_name", "action", "page", "screen"),
    "group_column": ("group", "variant", "treatment", "control", "arm", "bucket"),
    "target_metric": ("sales", "revenue", "gmv", "amount", "value", "price", "orders", "conversion", "rate", "metric"),
    "dimension": ("channel", "campaign", "source", "category", "region", "city", "platform", "status", "type"),
    "feature": ("age", "gender", "region", "channel", "device", "platform", "score"),
    "join_key": ("_id", "id", "key"),
}

MULTI_TABLE_TYPES = {"attribution", "path_analysis", "regression"}


def build_deterministic_fallback_plan(
    request: HermesPlanAnalysisRequest,
    warning: str = FALLBACK_WARNING,
) -> AssistantAnalysisPlan:
    """Build a conservative plan without provider calls or side effects."""
    context = request.assistant_context
    analysis_type = _detect_analysis_type(request.user_question)
    ranked = _rank_datasets(request.user_question, analysis_type, context)
    required_ids = _select_required_dataset_ids(analysis_type, context, ranked)
    required_id_set = set(required_ids)
    candidate_ids = [dataset.id for _, dataset in ranked if dataset.id not in required_id_set][:3]
    dataset_by_id = {dataset.id: dataset for dataset in context.datasets}

    required_fields = _build_field_requirements(analysis_type, required_ids, dataset_by_id)
    required_relationships = _confirmed_relationships(context, required_id_set)
    clarifying_questions: list[str] = []

    if not required_ids:
        clarifying_questions.append("请确认本次分析要使用的目标数据集。")
    for field in required_fields:
        if field.required and not field.candidate_columns:
            clarifying_questions.append(f"请确认 {field.role} 对应哪个字段。")
    if len(required_ids) > 1 and not _relationships_connect(required_ids, required_relationships):
        clarifying_questions.append("请先在 Relationship Set 中确认这些数据集之间的关键关系。")

    if clarifying_questions:
        readiness = "needs_clarification"
        next_action = "clarify"
        next_actions = [AssistantNextAction(type="confirm", label="补充信息后重新生成计划")]
    elif len(required_ids) > 1:
        readiness = "needs_join"
        next_action = "create_analysis_dataset"
        next_actions = [
            AssistantNextAction(type="warning", label="需要创建多表分析数据集（P0C）")
        ]
    else:
        readiness = "ready_single_table"
        next_action = "review_plan"
        next_actions = [
            AssistantNextAction(
                type="navigate",
                label="确认计划并进入分析页",
                target=ANALYSIS_TARGETS[analysis_type],
            )
        ]

    warnings = [warning]
    if len(required_ids) > 1:
        warnings.append("Multiple source datasets require a future analysis-dataset step; no join has been executed.")

    return AssistantAnalysisPlan(
        id=f"fallback-{uuid4()}",
        user_question=request.user_question,
        interpreted_goal=ANALYSIS_LABELS[analysis_type],
        recommended_analysis_type=analysis_type,
        required_datasets=[_dataset_name(dataset_by_id[item]) for item in required_ids],
        required_dataset_ids=required_ids,
        candidate_dataset_ids=candidate_ids,
        candidate_datasets=[
            AssistantCandidateDataset(
                dataset_id=item,
                dataset_name=_dataset_name(dataset_by_id[item]),
                reasons=["Local metadata ranking identified this as optional context."],
                confidence="medium",
            )
            for item in candidate_ids
        ],
        required_fields=required_fields,
        required_relationships=required_relationships,
        metrics=_build_metrics(required_fields),
        relationship_set_id=context.relationship_set.id if context.relationship_set else None,
        relationship_set_name=context.relationship_set.name if context.relationship_set else None,
        reference_dataset_ids=_reference_dataset_ids(context),
        assumptions=[
            f"Local keyword matching classified the request as {analysis_type}.",
            "The plan is advisory and requires user confirmation before navigation.",
        ],
        warnings=warnings,
        clarifying_questions=list(dict.fromkeys(clarifying_questions))[:8],
        execution_readiness=readiness,
        next_action=next_action,
        next_actions=next_actions,
        source="deterministic_fallback",
        confidence="medium" if required_ids else "low",
        fallback_used=True,
    )


def _detect_analysis_type(question: str) -> RecommendedAnalysisType:
    normalized = question.lower()
    for analysis_type, keywords in ANALYSIS_RULES:
        if any(keyword in normalized for keyword in keywords):
            return analysis_type
    return "descriptive"


def _rank_datasets(
    question: str,
    analysis_type: RecommendedAnalysisType,
    context: BoundedPlanningContext,
) -> list[tuple[int, PlanningDatasetMetadata]]:
    normalized = question.lower()
    ranked = []
    for dataset in context.datasets:
        searchable = " ".join(
            filter(
                None,
                [
                    dataset.id,
                    dataset.name,
                    dataset.filename,
                    dataset.table_type,
                    dataset.business_category,
                    dataset.data_type,
                    *dataset.analysis_tags,
                    *(column.name for column in dataset.columns),
                ],
            )
        ).lower()
        score = 0
        if context.selected_dataset_id == dataset.id:
            score += 100
        if analysis_type in dataset.analysis_tags:
            score += 20
        label_tokens = [token for token in searchable.replace("_", " ").split() if len(token) >= 3]
        score += min(20, sum(4 for token in label_tokens if token in normalized))
        if analysis_type in MULTI_TABLE_TYPES:
            intent_terms = {
                "attribution": ("channel", "campaign", "marketing", "order", "user", "conversion", "渠道", "订单", "用户"),
                "path_analysis": ("event", "session", "user", "path", "事件", "路径", "用户"),
                "regression": ("user", "order", "metric", "feature", "用户", "订单", "指标"),
            }[analysis_type]
            score += min(18, sum(3 for term in intent_terms if term in searchable and term in normalized))
        ranked.append((score, dataset))
    return sorted(ranked, key=lambda item: (-item[0], item[1].id))


def _select_required_dataset_ids(
    analysis_type: RecommendedAnalysisType,
    context: BoundedPlanningContext,
    ranked: list[tuple[int, PlanningDatasetMetadata]],
) -> list[str]:
    if context.selected_dataset_id:
        return [context.selected_dataset_id]
    selected = [item for item in context.selected_dataset_ids if any(ds.id == item for ds in context.datasets)]
    if selected:
        return selected[:3]
    if analysis_type in MULTI_TABLE_TYPES:
        matched = [dataset.id for score, dataset in ranked if score >= 3]
        return matched[:3]
    return []


def _build_field_requirements(
    analysis_type: RecommendedAnalysisType,
    required_ids: list[str],
    dataset_by_id: dict[str, PlanningDatasetMetadata],
) -> list[AnalysisFieldRequirement]:
    if not required_ids:
        return []
    requirements = []
    for role, required, reason in FIELD_REQUIREMENTS[analysis_type]:
        chosen_dataset_id = required_ids[0]
        chosen_columns: list[str] = []
        for dataset_id in required_ids:
            dataset = dataset_by_id[dataset_id]
            candidates = _candidate_columns(dataset, role)
            if candidates:
                chosen_dataset_id = dataset_id
                chosen_columns = candidates
                break
        requirements.append(
            AnalysisFieldRequirement(
                dataset_id=chosen_dataset_id,
                role=role,
                required=required,
                candidate_columns=chosen_columns[:20],
                reason=reason,
            )
        )
    return requirements


def _candidate_columns(dataset: PlanningDatasetMetadata, role: str) -> list[str]:
    patterns = FIELD_PATTERNS[role]
    matches = []
    for column in dataset.columns:
        name = column.name.lower()
        if column.role == role or any(pattern in name for pattern in patterns):
            matches.append(column.name)
    return matches


def _confirmed_relationships(
    context: BoundedPlanningContext,
    required_ids: set[str],
) -> list[AnalysisRelationshipRequirement]:
    if not context.relationship_set or len(required_ids) < 2:
        return []
    return [
        AnalysisRelationshipRequirement(
            relationship_id=relationship.id,
            source_dataset_id=relationship.source_dataset_id,
            source_column=relationship.source_column,
            target_dataset_id=relationship.target_dataset_id,
            target_column=relationship.target_column,
            status="confirmed",
            relationship_type=relationship.relationship_type,
            risk_level=relationship.risk_level,
            reason="Confirmed in the active Relationship Set.",
        )
        for relationship in context.relationship_set.relationships
        if {
            relationship.source_dataset_id,
            relationship.target_dataset_id,
        }.issubset(required_ids)
    ]


def _build_metrics(fields: list[AnalysisFieldRequirement]) -> list[AnalysisMetricTarget]:
    return [
        AnalysisMetricTarget(
            name=column,
            dataset_id=field.dataset_id,
            field=column,
            description=f"Candidate metric for {field.role}.",
        )
        for field in fields
        if field.role == "target_metric"
        for column in field.candidate_columns[:4]
    ]


def _reference_dataset_ids(context: BoundedPlanningContext) -> list[str]:
    if not context.relationship_set:
        return []
    return [
        node.dataset_id
        for node in context.relationship_set.dataset_nodes
        if node.role in {"isolated", "reference_only"}
    ][:20]


def _relationships_connect(
    required_ids: list[str],
    relationships: list[AnalysisRelationshipRequirement],
) -> bool:
    if len(required_ids) < 2:
        return True
    adjacency = {dataset_id: set() for dataset_id in required_ids}
    for relationship in relationships:
        adjacency[relationship.source_dataset_id].add(relationship.target_dataset_id)
        adjacency[relationship.target_dataset_id].add(relationship.source_dataset_id)
    visited = set()
    pending = [required_ids[0]]
    while pending:
        dataset_id = pending.pop()
        if dataset_id in visited:
            continue
        visited.add(dataset_id)
        pending.extend(adjacency[dataset_id] - visited)
    return visited == set(required_ids)


def _dataset_name(dataset: PlanningDatasetMetadata) -> str:
    return dataset.filename or dataset.name or dataset.id
