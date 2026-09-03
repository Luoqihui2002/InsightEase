import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { joinApi } from '@/api/join';
import { ANALYSIS_ROUTES, buildJoinPlan } from '@/lib/assistant/joinPlanBuilder';
import { saveAnalysisPrefill } from '@/lib/assistant/prefillNavigation';
import { cn } from '@/lib/utils';
import type { AssistantAnalysisPlan, RelationshipSet } from '@/types/assistant';
import type { ApiResponse, Dataset } from '@/types/api';
import type {
  DerivedDatasetMetadata,
  JoinPreview,
  JoinRiskLevel,
  JoinType,
} from '@/types/join';

interface JoinBuilderPanelProps {
  plan: AssistantAnalysisPlan;
  relationshipSet?: RelationshipSet;
  datasets: Dataset[];
  onClose: () => void;
  onContinue: (target: string) => void;
}

const RISK_LABELS: Record<JoinRiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  blocked: '已阻止',
};

const CARDINALITY_LABELS: Record<string, string> = {
  one_to_one: '1:1',
  one_to_many: '1:N',
  many_to_one: 'N:1',
  many_to_many: 'N:N',
  unknown: '未知',
};

function unwrap<T>(response: unknown): T {
  const payload = response as ApiResponse<T>;
  if (!payload || payload.code !== 200 || payload.data === undefined) {
    throw new Error(payload?.message || '服务返回了无效结果');
  }
  return payload.data;
}

function defaultFilename(plan: AssistantAnalysisPlan): string {
  const stem = plan.interpreted_goal
    .replace(/[^A-Za-z0-9_\-\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${stem || 'analysis_dataset'}_joined.csv`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function JoinBuilderPanel({
  plan,
  relationshipSet,
  datasets,
  onClose,
  onContinue,
}: JoinBuilderPanelProps) {
  const [joinTypes, setJoinTypes] = useState<Record<string, JoinType>>({});
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [created, setCreated] = useState<DerivedDatasetMetadata | null>(null);
  const [filename, setFilename] = useState(() => defaultFilename(plan));
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmHighRisk, setConfirmHighRisk] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buildResult = useMemo(
    () => buildJoinPlan(plan, relationshipSet, datasets, joinTypes),
    [datasets, joinTypes, plan, relationshipSet],
  );
  const joinPlan = buildResult.joinPlan;
  const datasetNames = useMemo(
    () => new Map(datasets.map((dataset) => [dataset.id, dataset.filename])),
    [datasets],
  );

  const updateJoinType = (relationshipId: string, joinType: JoinType) => {
    setJoinTypes((current) => ({ ...current, [relationshipId]: joinType }));
    setPreview(null);
    setCreated(null);
    setConfirmCreate(false);
    setConfirmHighRisk(false);
  };

  const handlePreview = async () => {
    if (!joinPlan) return;
    setIsPreviewing(true);
    setError(null);
    setCreated(null);
    try {
      const response = await joinApi.preview(joinPlan, 20);
      setPreview(unwrap<JoinPreview>(response));
      setConfirmCreate(false);
      setConfirmHighRisk(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Join 预览失败');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreate = async () => {
    if (!joinPlan || !preview || !confirmCreate) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await joinApi.createDataset(joinPlan, filename, confirmHighRisk);
      setCreated(unwrap<DerivedDatasetMetadata>(response));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '分析数据集创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinue = () => {
    if (!created || !preview) return;
    const outputColumns = new Set(preview.output_columns);
    const suggestedFields = plan.required_fields
      .map((field) => ({
        ...field,
        dataset_id: created.dataset_id,
        candidate_columns: field.candidate_columns.filter((column) => outputColumns.has(column)),
      }))
      .filter((field) => !field.required || field.candidate_columns.length > 0);
    const prefillKey = saveAnalysisPrefill({
      source: 'ai_workbench',
      plan_id: plan.id,
      analysis_type: plan.recommended_analysis_type,
      dataset_ids: [created.dataset_id],
      primary_dataset_id: created.dataset_id,
      relationship_set_id: plan.relationship_set_id,
      relationship_set_name: plan.relationship_set_name,
      suggested_fields: suggestedFields,
      user_question: plan.user_question,
      created_at: new Date().toISOString(),
    });
    const route = ANALYSIS_ROUTES[plan.recommended_analysis_type];
    onContinue(`${route}?prefill=${encodeURIComponent(prefillKey)}`);
  };

  const riskLevel = preview?.risk_summary.risk_level;
  const canCreate = Boolean(
    joinPlan &&
    preview &&
    filename.trim() &&
    confirmCreate &&
    riskLevel !== 'blocked' &&
    (riskLevel !== 'high' || confirmHighRisk),
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-[var(--border-subtle)]">
          <DialogTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
            创建多表分析数据集
          </DialogTitle>
          <DialogDescription>
            先预览 Join 结果和风险；只有明确确认后才会创建新的 Dataset，源数据不会被修改。
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">分析目标</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{plan.interpreted_goal}</p>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">源数据集</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {plan.required_dataset_ids.map((datasetId) => (
                <span key={datasetId} className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                  {datasetNames.get(datasetId) ?? datasetId}
                </span>
              ))}
            </div>
          </section>

          {buildResult.error ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{buildResult.error}</span>
              </div>
            </div>
          ) : null}

          {joinPlan ? (
            <>
              <section>
                <h4 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Join 步骤
                </h4>
                <div className="space-y-2">
                  {joinPlan.join_steps.map((step, index) => (
                    <div
                      key={step.relationship_id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="text-[var(--text-muted)]">步骤 {index + 1}</span>
                        <span>{datasetNames.get(step.left_dataset_id) ?? step.left_dataset_id}.{step.left_field}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
                        <span>{datasetNames.get(step.right_dataset_id) ?? step.right_dataset_id}.{step.right_field}</span>
                        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px]">
                          {CARDINALITY_LABELS[step.expected_cardinality]}
                        </span>
                        <label className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-muted)]">连接方式</span>
                          <select
                            aria-label={`步骤 ${index + 1} 连接方式`}
                            value={step.join_type}
                            onChange={(event) => updateJoinType(step.relationship_id, event.target.value as JoinType)}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs"
                          >
                            <option value="left">LEFT</option>
                            <option value="inner">INNER</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  将保留的字段
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(joinPlan.selected_fields).map(([datasetId, fields]) => (
                    <div key={datasetId} className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {datasetNames.get(datasetId) ?? datasetId}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {fields.length > 0 ? fields.join('、') : '仅保留关联键'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end">
                <Button type="button" onClick={handlePreview} disabled={isPreviewing || isCreating}>
                  {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  预览 Join 与风险
                </Button>
              </div>
            </>
          ) : null}

          {preview ? (
            <section className="space-y-4">
              <div className={cn(
                'rounded-xl border p-4',
                riskLevel === 'blocked' || riskLevel === 'high'
                  ? 'border-red-400/25 bg-red-400/5'
                  : riskLevel === 'medium'
                    ? 'border-amber-400/25 bg-amber-400/5'
                    : 'border-emerald-400/25 bg-emerald-400/5',
              )}>
                <div className="flex items-center gap-2">
                  {riskLevel === 'low' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {riskLevel ? RISK_LABELS[riskLevel] : '风险未知'}
                  </span>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    预计 {preview.output_row_count.toLocaleString()} 行 × {preview.output_column_count} 列
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  相对基础表行数倍率：{preview.risk_summary.row_multiplier.toFixed(2)}×；结果粒度：
                  {preview.risk_summary.result_grain === 'likely_detail' ? '可能下沉至明细粒度' : preview.risk_summary.result_grain}
                </p>
                {[...preview.risk_summary.warnings, ...preview.risk_summary.blocked_reasons].map((warning) => (
                  <p key={warning} className="mt-1 text-xs text-amber-300">• {warning}</p>
                ))}
              </div>

              <div className="grid gap-2 lg:grid-cols-2">
                {preview.step_metrics.map((metrics) => (
                  <div key={metrics.step_index} className="rounded-xl border border-[var(--border-subtle)] p-3 text-xs">
                    <div className="flex items-center justify-between text-[var(--text-primary)]">
                      <span>步骤 {metrics.step_index} · {CARDINALITY_LABELS[metrics.cardinality]}</span>
                      <span>{RISK_LABELS[metrics.risk_level]}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[var(--text-muted)]">
                      <span>匹配率 {percent(metrics.match_rate)}</span>
                      <span>行数倍率 {metrics.row_multiplier.toFixed(2)}×</span>
                      <span>左键缺失 {metrics.left_null_key_count}（{percent(metrics.left_null_key_rate)}）</span>
                      <span>右键缺失 {metrics.right_null_key_count}（{percent(metrics.right_null_key_rate)}）</span>
                      <span>左键重复 {metrics.left_duplicate_key_count}（{percent(metrics.left_duplicate_key_rate)}）</span>
                      <span>右键重复 {metrics.right_duplicate_key_count}（{percent(metrics.right_duplicate_key_rate)}）</span>
                    </div>
                  </div>
                ))}
              </div>

              {preview.preview_rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      <tr>
                        {preview.output_columns.map((column) => (
                          <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview_rows.map((row, rowIndex) => (
                        <tr key={`preview-row-${rowIndex}`} className="border-t border-[var(--border-subtle)]">
                          {preview.output_columns.map((column) => (
                            <td key={column} className="max-w-48 truncate whitespace-nowrap px-3 py-2 text-[var(--text-muted)]">
                              {row[column] === null || row[column] === undefined ? '—' : String(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!created && riskLevel !== 'blocked' ? (
                <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
                  <label className="block text-xs text-[var(--text-secondary)]">
                    新数据集名称
                    <Input
                      value={filename}
                      onChange={(event) => setFilename(event.target.value)}
                      className="mt-1"
                      maxLength={255}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <Checkbox
                      checked={confirmCreate}
                      onCheckedChange={(checked) => setConfirmCreate(checked === true)}
                    />
                    <span>我已检查 Join 步骤、字段和风险，并确认创建一个新的分析数据集。</span>
                  </label>
                  {riskLevel === 'high' ? (
                    <label className="flex items-start gap-2 text-xs text-amber-300">
                      <Checkbox
                        checked={confirmHighRisk}
                        onCheckedChange={(checked) => setConfirmHighRisk(checked === true)}
                      />
                      <span>我理解该 Join 为高风险，仍确认继续创建。</span>
                    </label>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleCreate} disabled={!canCreate || isCreating}>
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      确认并创建 Dataset
                    </Button>
                  </div>
                </div>
              ) : null}

              {created ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    已创建 {created.filename}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {created.row_count.toLocaleString()} 行 × {created.col_count} 列，来源链路已记录。
                  </p>
                  <Button type="button" className="mt-3" onClick={handleContinue}>
                    继续到建议分析页
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default JoinBuilderPanel;
