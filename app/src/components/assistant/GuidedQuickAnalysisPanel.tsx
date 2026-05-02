/**
 * GuidedQuickAnalysisPanel — 快速分析向导
 *
 * A 3-step guided flow inside AI Workbench for beginner users:
 *   Step 1: Select a dataset
 *   Step 2: View compact dataset understanding (via real profileDataset API)
 *   Step 3: Choose a goal / type a question → generate plan via AssistantRuntime
 *
 * Safety guarantees:
 *   - Only calls assistantApi.profileDataset() (read-only metadata)
 *   - Only calls getAssistantRuntime().generateAnalysisPlan() (rule-based, no execution)
 *   - No fake diagnosis numbers, no fake preprocessing, no fake analysis results
 *   - No automatic backend analysis execution
 *   - No join/SQL/dataset creation
 *   - No Hermes/LLM calls
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Database,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Fingerprint,
  Wand2,
  Info,
  ChevronRight,
} from 'lucide-react';
import { assistantApi } from '@/api/assistant';
import { getAssistantRuntime } from '@/lib/assistant/getAssistantRuntime';
import { AnalysisPlanCard } from '@/components/assistant/AnalysisPlanCard';
import type {
  DatasetProfile,
  TableRelationship,
  AssistantAnalysisPlan,
} from '@/types/assistant';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DatasetOption {
  id: string;
  filename?: string;
  name?: string;
  row_count?: number;
  col_count?: number;
  schema?: unknown[];
}

interface GuidedQuickAnalysisPanelProps {
  datasets: DatasetOption[];
  defaultDatasetId?: string;
  confirmedRelationships?: TableRelationship[];
  onNavigate?: (target: string, payload?: Record<string, unknown>) => void;
  onBack?: () => void;
}

type Step = 1 | 2 | 3;

/* ------------------------------------------------------------------ */
/*  Goal chips                                                         */
/* ------------------------------------------------------------------ */

const GOAL_CHIPS = [
  { label: '我想了解整体数据情况', question: '帮我整体了解这份数据' },
  { label: '我想分析转化路径', question: '分析用户的转化路径和流失情况' },
  { label: '我想预测未来趋势', question: '预测未来的趋势变化' },
  { label: '我想分析渠道贡献', question: '分析各个渠道的贡献和归因' },
  { label: '我想处理缺失和异常', question: '检查并处理缺失值和异常值' },
  { label: '我想分析评论文本', question: '分析评论或文本内容的语义' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TABLE_TYPE_NAMES: Record<string, string> = {
  user: '用户维度表',
  order: '订单事实表',
  event_log: '事件日志表',
  product: '商品维度表',
  campaign: '营销 campaign 表',
  experiment: '实验表',
  transaction: '交易表',
  dimension: '维度表',
  metric_summary: '指标汇总表',
  review_text: '评论/文本表',
  unknown: '未知类型',
};

const ROLE_PRIORITY = [
  'timestamp',
  'date',
  'user_id',
  'order_id',
  'product_id',
  'event_name',
  'amount_revenue',
  'metric',
  'text_field',
  'dimension',
  'category',
];

function getKeyFields(profile: DatasetProfile): string[] {
  const cols = profile.columns || [];
  const picked = new Set<string>();
  for (const role of ROLE_PRIORITY) {
    const found = cols.find((c) => c.role === role);
    if (found && !picked.has(found.name)) {
      picked.add(found.name);
      if (picked.size >= 5) break;
    }
  }
  return Array.from(picked);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GuidedQuickAnalysisPanel({
  datasets,
  defaultDatasetId,
  confirmedRelationships = [],
  onNavigate,
  onBack,
}: GuidedQuickAnalysisPanelProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    defaultDatasetId || null
  );
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [planQuestion, setPlanQuestion] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState<AssistantAnalysisPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  /* Load profile when entering step 2 */
  const loadProfile = useCallback(async () => {
    if (!selectedDatasetId) return;
    setProfileLoading(true);
    setProfileError('');
    setProfile(null);
    try {
      const res = (await assistantApi.profileDataset(selectedDatasetId)) as any;
      if (res.code === 200 && res.data) {
        setProfile(res.data as DatasetProfile);
      } else {
        setProfileError(res.message || '获取数据集画像失败');
      }
    } catch (err: any) {
      setProfileError(err.message || '请求失败');
    } finally {
      setProfileLoading(false);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    if (step === 2 && selectedDatasetId) {
      loadProfile();
    }
  }, [step, selectedDatasetId, loadProfile]);

  /* Reset plan when question changes */
  const handleSelectGoal = (question: string) => {
    setPlanQuestion(question);
    setGeneratedPlan(null);
  };

  /* Generate plan via AssistantRuntime */
  const handleGeneratePlan = async () => {
    if (!planQuestion.trim() || !selectedDataset) return;
    setIsPlanning(true);
    setGeneratedPlan(null);

    try {
      const runtime = getAssistantRuntime();
      const response = await runtime.generateAnalysisPlan({
        question: planQuestion.trim(),
        context: {
          selected_dataset_ids: [selectedDataset.id],
          selected_dataset_id: selectedDataset.id,
          confirmed_relationships: confirmedRelationships,
          datasets: [
            {
              id: selectedDataset.id,
              filename: selectedDataset.filename,
              name: selectedDataset.filename,
              schema: (selectedDataset.schema || []).map((col: any) => ({
                name: col?.name || '',
                semantic_type: col?.semantic_type || col?.type || '',
              })),
            },
          ],
          dataset_profiles: profile ? [profile] : undefined,
        },
      });

      setGeneratedPlan(response.plan);
    } catch (error) {
      console.error('生成计划失败:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleNavigate = (target: string) => {
    onNavigate?.(target);
  };

  /* -------------------- Step 1: Select Dataset -------------------- */
  const renderStep1 = () => (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          第 1 步：选择数据集
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          选择一个数据集，我会先理解字段结构，再帮你生成适合的分析路径。
        </p>
      </div>

      {datasets.length === 0 ? (
        <div className="rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-6 text-center">
          <Database className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">暂无可用数据集</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            请先上传数据集，再使用快速分析向导。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {datasets.map((ds) => {
            const isSelected = selectedDatasetId === ds.id;
            return (
              <button
                key={ds.id}
                onClick={() => setSelectedDatasetId(ds.id)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  isSelected
                    ? 'bg-[var(--neon-cyan)]/5 border-[var(--neon-cyan)]/40'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      isSelected
                        ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    )}
                  >
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {ds.filename || ds.name || ds.id}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {ds.row_count?.toLocaleString() ?? '-'} 行 · {ds.col_count ?? '-'} 列
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-[var(--neon-cyan)] flex-shrink-0 ml-auto" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <button
          onClick={() => selectedDatasetId && setStep(2)}
          disabled={!selectedDatasetId}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            selectedDatasetId
              ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
          )}
        >
          下一步：理解数据
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  /* -------------------- Step 2: Understand Dataset -------------------- */
  const renderStep2 = () => (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          第 2 步：理解数据结构
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          基于数据集元数据自动推断表类型、字段角色和推荐分析。
        </p>
      </div>

      <AnimatePresence mode="wait">
        {profileLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-6 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
          >
            <Loader2 className="w-5 h-5 animate-spin text-[var(--neon-cyan)]" />
            <span className="text-sm text-[var(--text-muted)]">正在理解数据结构...</span>
          </motion.div>
        )}

        {profileError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-red-500/5 border border-red-500/20"
          >
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">分析失败</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{profileError}</p>
          </motion.div>
        )}

        {!profileLoading && !profileError && profile && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Compact summary card */}
            <div className="rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-4 space-y-4">
              {/* Header: table type + row/col count */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[var(--neon-cyan)]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {profile.name || selectedDataset?.filename || '数据集'}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20">
                  {TABLE_TYPE_NAMES[profile.classification?.table_type] || '未知类型'}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                <span>
                  <span className="text-[var(--text-muted)]">行数：</span>
                  {profile.row_count.toLocaleString()}
                </span>
                <span>
                  <span className="text-[var(--text-muted)]">列数：</span>
                  {profile.column_count}
                </span>
                <span>
                  <span className="text-[var(--text-muted)]">置信度：</span>
                  {(profile.classification?.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Key fields */}
              {(() => {
                const keyFields = getKeyFields(profile);
                return keyFields.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      <Fingerprint className="w-3 h-3" />
                      关键字段
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {keyFields.map((f) => (
                        <span
                          key={f}
                          className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Recommended analyses */}
              {profile.classification?.recommended_analyses?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                    <BarChart3 className="w-3 h-3" />
                    适合的分析
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.classification.recommended_analyses.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality warnings */}
              {profile.quality_warnings?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                    <AlertTriangle className="w-3 h-3" />
                    注意事项
                  </div>
                  <div className="space-y-1">
                    {profile.quality_warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {profile.quality_warnings?.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--neon-green)]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  暂无明显数据质量风险
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={profileLoading || !profile}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            profile && !profileLoading
              ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
          )}
        >
          下一步：生成分析计划
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  /* -------------------- Step 3: Generate Plan -------------------- */
  const renderStep3 = () => (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          第 3 步：选择分析目标
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          选择一个常见目标，或直接输入你的业务问题。
        </p>
      </div>

      {/* Goal chips */}
      <div className="flex flex-wrap gap-2">
        {GOAL_CHIPS.map((chip) => {
          const active = planQuestion === chip.question;
          return (
            <button
              key={chip.label}
              onClick={() => handleSelectGoal(chip.question)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs transition-all border',
                active
                  ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/30'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/20'
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Custom question input */}
      <div className="rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={planQuestion}
            onChange={(e) => {
              setPlanQuestion(e.target.value);
              setGeneratedPlan(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && planQuestion.trim() && !isPlanning) {
                handleGeneratePlan();
              }
            }}
            placeholder="例如：未来销售额会怎么变化？"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
          />
          <button
            onClick={handleGeneratePlan}
            disabled={!planQuestion.trim() || isPlanning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              planQuestion.trim() && !isPlanning
                ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'
            )}
          >
            {isPlanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            生成计划
          </button>
        </div>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-2 text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--neon-cyan)]" />
        <p>
          当前向导只生成分析路径建议，不会自动运行分析、不会修改数据，也不会创建新数据集。
          当前为规则型分析向导，未来可接入 Hermes/LLM 提供更强的自然语言理解。
        </p>
      </div>

      {/* Generated plan */}
      {generatedPlan && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AnalysisPlanCard plan={generatedPlan} onNavigate={handleNavigate} />
        </motion.div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>
        <button
          onClick={() => {
            setStep(1);
            setSelectedDatasetId(defaultDatasetId || null);
            setProfile(null);
            setPlanQuestion('');
            setGeneratedPlan(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          重新开始
        </button>
      </div>
    </div>
  );

  /* -------------------- Main render -------------------- */
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-[var(--text-primary)]">快速分析向导</span>
        <div className="ml-auto flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                s === step ? 'bg-[var(--neon-cyan)]' : s < step ? 'bg-[var(--neon-cyan)]/40' : 'bg-[var(--border-subtle)]'
              )}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep1()}
          </motion.div>
        )}
        {step === 2 && (
          <motion.div
            key="step2"
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep2()}
          </motion.div>
        )}
        {step === 3 && (
          <motion.div
            key="step3"
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep3()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GuidedQuickAnalysisPanel;
