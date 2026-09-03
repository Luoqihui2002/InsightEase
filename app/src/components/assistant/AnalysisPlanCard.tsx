/**
 * AnalysisPlanCard — 结构化分析计划展示卡片
 *
 * 展示 runtime 返回的分析计划草案，包含：
 *   来源、执行就绪状态、推断目标、数据集、字段、指标、关系和确认操作
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  ExternalLink,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveAnalysisPrefill } from '@/lib/assistant/prefillNavigation';
import type { AssistantAnalysisPlan, RecommendedAnalysisType } from '@/types/assistant';

interface AnalysisPlanCardProps {
  plan: AssistantAnalysisPlan;
  onNavigate?: (target: string) => void;
}

const CANDIDATE_CONFIDENCE_LABELS: Record<'low' | 'medium' | 'high', string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const ANALYSIS_TYPE_LABELS: Record<RecommendedAnalysisType, string> = {
  descriptive: '描述统计',
  data_overview: '数据概览',
  attribution: '归因分析',
  forecast: '时序预测',
  path_analysis: '路径/漏斗分析',
  ab_test: 'A/B 实验分析',
  regression: '回归/价值预测',
  smart_process: '数据预处理',
  visualization: '数据可视化',
};

const ANALYSIS_TYPE_COLORS: Record<RecommendedAnalysisType, string> = {
  descriptive: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  data_overview: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
  attribution: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  forecast: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  path_analysis: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  ab_test: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
  regression: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  smart_process: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  visualization: 'bg-teal-400/10 text-teal-400 border-teal-400/20',
};

const READINESS_LABELS = {
  ready_single_table: '单表计划可确认',
  needs_join: '需要多表分析数据集',
  needs_clarification: '需要补充信息',
  unsupported: '当前不支持',
} as const;

const FIELD_ROLE_LABELS: Record<string, string> = {
  target_metric: '目标指标',
  time_column: '时间列',
  user_id: '用户标识',
  group_column: '分组列',
  event_name: '事件名称',
  dimension: '维度列',
  feature: '特征列',
  join_key: '关联键',
};

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export function AnalysisPlanCard({ plan, onNavigate }: AnalysisPlanCardProps) {
  const navigate = useNavigate();
  const datasetIds = plan.required_dataset_ids;
  const canNavigate =
    plan.execution_readiness === 'ready_single_table' && datasetIds.length === 1;

  const handleNavigate = (target?: string) => {
    if (target && canNavigate) {
      const prefillKey = saveAnalysisPrefill({
        source: 'ai_workbench',
        plan_id: plan.id,
        analysis_type: plan.recommended_analysis_type,
        dataset_ids: datasetIds,
        primary_dataset_id: datasetIds[0],
        relationship_set_id: plan.relationship_set_id,
        relationship_set_name: plan.relationship_set_name,
        suggested_fields: plan.required_fields,
        user_question: plan.user_question,
        created_at: new Date().toISOString(),
      });
      const separator = target.includes('?') ? '&' : '?';
      const targetWithPrefill = `${target}${separator}prefill=${encodeURIComponent(prefillKey)}`;

      onNavigate?.(targetWithPrefill);
      navigate(targetWithPrefill);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 overflow-hidden"
    >
      {/* 头部 */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-medium border',
              plan.source === 'hermes_live'
                ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/25'
                : 'bg-slate-400/10 text-slate-300 border-slate-400/20'
            )}
          >
            {plan.source === 'hermes_live' ? 'AI Plan · Hermes Live' : 'Local Plan · Fallback'}
          </span>
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-medium border',
              ANALYSIS_TYPE_COLORS[plan.recommended_analysis_type]
            )}
          >
            {ANALYSIS_TYPE_LABELS[plan.recommended_analysis_type]}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] border border-[var(--border-subtle)] text-[var(--text-muted)]">
            {READINESS_LABELS[plan.execution_readiness]}
          </span>
        </div>
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          {plan.interpreted_goal}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          原始问题：「{plan.user_question}」
        </p>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* 所需数据集 */}
        {plan.required_datasets.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <ListChecks className="w-3 h-3" />
              所需数据集
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-2">
              本次计划所需数据集是建议优先使用的输入，不会自动运行分析。
            </p>
            <div className="flex flex-wrap gap-2">
              {plan.required_datasets.map((name) => (
                <span
                  key={name}
                  className="px-2 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 所需字段 */}
        {plan.required_datasets.length === 0 && (
          <div className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              尚未确认所需数据集
            </div>
            <p className="text-[11px] text-amber-400/80 mt-1">
              请先从候选数据集或当前数据集选择一个明确输入，再进入分析页配置字段。
            </p>
          </div>
        )}

        {plan.candidate_datasets.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Info className="w-3 h-3" />
              候选数据集
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-2">
              候选数据集由目录分类推荐，仍需用户确认；不会自动作为必需输入。
            </p>
            <div className="space-y-1.5">
              {plan.candidate_datasets.map((candidate) => (
                <div
                  key={candidate.dataset_id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {candidate.dataset_name || candidate.dataset_id}
                    </p>
                    <span className="ml-auto shrink-0 rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {CANDIDATE_CONFIDENCE_LABELS[candidate.confidence]}
                    </span>
                  </div>
                  {candidate.reasons.length > 0 && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">
                      {candidate.reasons.slice(0, 2).join('；')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.relationship_set_name && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Info className="w-3 h-3" />
              当前使用的关系组
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 px-3 py-2">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                {plan.relationship_set_name}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                关系组提供可参考的数据集图谱；本次计划只使用上方列出的所需数据集，不会自动 join。
              </p>
            </div>
          </div>
        )}

        {plan.reference_dataset_ids.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Info className="w-3 h-3" />
              关系组中的参考表 / 孤立表
            </div>
            <div className="space-y-1.5">
              {plan.reference_dataset_ids.map((datasetId) => (
                <div
                  key={datasetId}
                  className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2"
                >
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    {datasetId}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    该表保留在当前关系组中，但未发现可确认关系，不会自动参与 join。
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.required_fields.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3" />
              所需字段
            </div>
            <div className="space-y-2">
              {plan.required_fields.map((field) => (
                <div
                  key={`${field.dataset_id}:${field.role}`}
                  className={cn(
                    'flex items-start gap-2 p-2.5 rounded-lg border',
                    field.required && field.candidate_columns.length === 0
                      ? 'bg-red-400/5 border-red-400/15'
                      : 'bg-[var(--bg-secondary)]/50 border-[var(--border-subtle)]'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {FIELD_ROLE_LABELS[field.role] || field.role}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {field.dataset_id}
                      </span>
                      {field.required && (
                        <span className="text-[10px] text-red-400">必需</span>
                      )}
                      {!field.required && (
                        <span className="text-[10px] text-[var(--text-muted)]">可选</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{field.reason}</p>
                    {field.candidate_columns.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {field.candidate_columns.map((col) => (
                          <span
                            key={col}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--neon-cyan)]/5 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/15"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-red-400/80 mt-1">未找到候选字段</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 已确认关系 */}
        {plan.required_relationships.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3" />
              本计划使用的已确认表关系
            </div>
            <div className="space-y-1.5">
              {plan.required_relationships.map((rel) => (
                <div
                  key={rel.relationship_id || `${rel.source_dataset_id}:${rel.source_column}:${rel.target_dataset_id}:${rel.target_column}`}
                  className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2"
                >
                  <span>{rel.source_dataset_id}.{rel.source_column}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>{rel.target_dataset_id}.{rel.target_column}</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-emerald-400/10 text-emerald-400">
                    {rel.status === 'confirmed' ? '已确认' : '待确认'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.metrics.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <BarChart3 className="w-3 h-3" />
              指标与分析目标
            </div>
            <div className="space-y-1.5">
              {plan.metrics.map((metric) => (
                <div
                  key={`${metric.dataset_id}:${metric.field ?? metric.name}:${metric.aggregation ?? 'none'}`}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                    <span className="font-medium">{metric.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{metric.dataset_id}</span>
                    {metric.aggregation ? (
                      <span className="ml-auto text-[10px] text-[var(--neon-cyan)]">{metric.aggregation}</span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.clarifying_questions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2">
              <Info className="w-3 h-3" />
              需要补充的信息
            </div>
            <div className="space-y-1.5">
              {plan.clarifying_questions.map((question) => (
                <p key={question} className="text-xs text-amber-300/90 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2">
                  {question}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 假设 */}
        {plan.assumptions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <Lightbulb className="w-3 h-3" />
              推断假设
            </div>
            <div className="space-y-1">
              {plan.assumptions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="text-[var(--neon-cyan)] mt-0.5">+</span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 警告 */}
        {plan.warnings.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2">
              <AlertTriangle className="w-3 h-3" />
              注意事项
            </div>
            <div className="space-y-1">
              {plan.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          {plan.execution_readiness === 'ready_single_table'
            ? '点击确认后仅打开目标页面并带入建议配置，不会自动运行分析。'
            : plan.execution_readiness === 'needs_join'
              ? '该计划需要多表分析数据集；P0B 不执行 join，后续由 P0C Join Builder 承接。'
              : '请先补充计划所需信息；当前不会创建或执行任何分析。'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {plan.next_actions.map((action) => {
            const actionKey = `${action.type}:${action.target ?? ''}:${action.label}`;
            if (action.type === 'navigate' && action.target) {
              return (
                <button
                  key={actionKey}
                  type="button"
                  onClick={() => handleNavigate(action.target)}
                  disabled={!canNavigate}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    canNavigate
                      ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/25 hover:bg-[var(--neon-cyan)]/20'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-70'
                  )}
                  title={canNavigate ? undefined : '只有就绪的单表计划可以确认后进入分析页'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              );
            }
            if (action.type === 'warning') {
              return (
                <span
                  key={actionKey}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-amber-400 bg-amber-400/5 border border-amber-400/15"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {action.label}
                </span>
              );
            }
            return (
              <span
                key={actionKey}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
              >
                <Info className="w-3.5 h-3.5" />
                {action.label}
              </span>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default AnalysisPlanCard;
