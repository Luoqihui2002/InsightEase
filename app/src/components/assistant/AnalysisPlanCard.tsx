/**
 * AnalysisPlanCard — 结构化分析计划展示卡片
 *
 * 展示规则生成的分析计划草案，包含：
 *   推断目标、建议分析类型、所需字段、假设、警告、下一步操作
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  ExternalLink,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssistantAnalysisPlan, RecommendedAnalysisType } from '@/types/assistant';

interface AnalysisPlanCardProps {
  plan: AssistantAnalysisPlan;
  onNavigate?: (target: string) => void;
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const ANALYSIS_TYPE_LABELS: Record<RecommendedAnalysisType, string> = {
  descriptive: '描述统计',
  semantic: '语义分析',
  attribution: '归因分析',
  forecast: '时序预测',
  path_analysis: '路径/漏斗分析',
  ab_test: 'A/B 实验分析',
  regression: '回归/价值预测',
  smart_process: '数据预处理',
  custom_query: '自定义查询',
};

const ANALYSIS_TYPE_COLORS: Record<RecommendedAnalysisType, string> = {
  descriptive: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  semantic: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
  attribution: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  forecast: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  path_analysis: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  ab_test: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
  regression: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  smart_process: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  custom_query: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
};

const FIELD_ROLE_LABELS: Record<string, string> = {
  target_metric: '目标指标',
  time_column: '时间列',
  user_id: '用户标识',
  group_column: '分组列',
  event_name: '事件名称',
  dimension: '维度列',
  feature: '特征列',
  text_column: '文本列',
  join_key: '关联键',
};

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export function AnalysisPlanCard({ plan, onNavigate }: AnalysisPlanCardProps) {
  const navigate = useNavigate();

  const handleNavigate = (target?: string) => {
    if (target) {
      onNavigate?.(target);
      navigate(target);
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
              ANALYSIS_TYPE_COLORS[plan.recommended_analysis_type]
            )}
          >
            {ANALYSIS_TYPE_LABELS[plan.recommended_analysis_type]}
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
        {plan.required_fields.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3" />
              所需字段
            </div>
            <div className="space-y-2">
              {plan.required_fields.map((field, i) => (
                <div
                  key={i}
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
        {plan.required_relationships && plan.required_relationships.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3" />
              已确认的表关系
            </div>
            <div className="space-y-1.5">
              {plan.required_relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2"
                >
                  <span>{rel.source_dataset_name}.{rel.source_column}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>{rel.target_dataset_name}.{rel.target_column}</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-emerald-400/10 text-emerald-400">
                    {rel.relationship_type}
                  </span>
                </div>
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
        <div className="flex items-center gap-2 flex-wrap">
          {plan.next_actions.map((action, i) => {
            if (action.type === 'navigate' && action.target) {
              return (
                <button
                  key={i}
                  onClick={() => handleNavigate(action.target)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/25',
                    'hover:bg-[var(--neon-cyan)]/20'
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              );
            }
            if (action.type === 'warning') {
              return (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-amber-400 bg-amber-400/5 border border-amber-400/15"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {action.label}
                </span>
              );
            }
            return (
              <span
                key={i}
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
