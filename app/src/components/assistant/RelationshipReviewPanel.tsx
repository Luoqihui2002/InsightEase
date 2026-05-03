/**
 * RelationshipReviewPanel — Relationship Set management + candidate review.
 *
 * Relationship candidates are temporary inference results. Relationship sets are
 * saved, user-managed analysis contexts persisted by useAssistantContext.
 */

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Info,
  Table2,
  Trash2,
  Pencil,
  Save,
  ShieldAlert,
  Layers3,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { assistantApi } from '@/api/assistant';
import { cn } from '@/lib/utils';
import type {
  InferRelationshipsResponse,
  RelationshipRiskLevel,
  RelationshipSet,
  TableRelationship,
} from '@/types/assistant';

interface RelationshipReviewPanelProps {
  datasets: Array<{ id: string; filename?: string; name?: string }>;
  relationshipSets: RelationshipSet[];
  activeRelationshipSetId?: string;
  onCreateRelationshipSet: (input: {
    name: string;
    description?: string;
    relationships: TableRelationship[];
  }) => RelationshipSet;
  onUpdateRelationshipSet: (
    id: string,
    patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships'>>
  ) => void;
  onDeleteRelationshipSet: (id: string) => void;
  onSetActiveRelationshipSet: (id?: string) => void;
}

const NO_ACTIVE_SET_VALUE = '__none__';

function formatDefaultSetName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `关系组 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function relationshipTypeLabel(type: string): string {
  const map: Record<string, string> = {
    one_to_one: '一对一',
    one_to_many: '一对多',
    many_to_one: '多对一',
    many_to_many: '多对多',
    unknown: '未知',
  };
  return map[type] || type;
}

function getRelationshipGroupKey(rel: TableRelationship): string {
  const source = rel.source_column.toLowerCase();
  const target = rel.target_column.toLowerCase();

  if (source === target) return source;
  if (source.includes('user') && target.includes('user')) return 'user_id';
  if (source.includes('product') && target.includes('product')) return 'product_id';
  if (source.includes('order') && target.includes('order')) return 'order_id';
  if (source.includes('campaign') && target.includes('campaign')) return 'campaign_id';
  return '其他 / 需人工确认';
}

function semanticRoot(column: string): string | undefined {
  const name = column.toLowerCase();
  if (name.includes('user') || name.includes('customer') || name.includes('uid')) return 'user';
  if (name.includes('product') || name.includes('sku') || name.includes('item')) return 'product';
  if (name.includes('order')) return 'order';
  if (name.includes('campaign')) return 'campaign';
  if (name.includes('session')) return 'session';
  return undefined;
}

function classifyRelationshipRisk(rel: TableRelationship): RelationshipRiskLevel {
  const sourceRoot = semanticRoot(rel.source_column);
  const targetRoot = semanticRoot(rel.target_column);
  const semanticMismatch = Boolean(sourceRoot && targetRoot && sourceRoot !== targetRoot);
  const warningMismatch = rel.warnings.some((w) => {
    const lower = w.toLowerCase();
    return lower.includes('semantic') || lower.includes('语义') || lower.includes('mismatch');
  });

  if (
    semanticMismatch ||
    rel.confidence < 0.65 ||
    rel.relationship_type === 'unknown' ||
    warningMismatch
  ) {
    return 'high';
  }
  if (rel.confidence < 0.8 || rel.warnings.length > 0) return 'medium';
  return 'low';
}

function riskLabel(risk: RelationshipRiskLevel): string {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '需留意';
  return '低风险';
}

function prepareRelationshipForSet(rel: TableRelationship): TableRelationship {
  const risk = classifyRelationshipRisk(rel);
  return {
    ...rel,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    risk_level: risk,
    is_custom: risk === 'high' ? true : rel.is_custom,
    warnings:
      risk === 'high' && !rel.warnings.includes('高风险关系：字段语义或置信度需要人工确认。')
        ? [...rel.warnings, '高风险关系：字段语义或置信度需要人工确认。']
        : rel.warnings,
  };
}

function getDatasetLabel(ds: { id: string; filename?: string; name?: string }): string {
  return ds.filename || ds.name || ds.id;
}

export function RelationshipReviewPanel({
  datasets,
  relationshipSets,
  activeRelationshipSetId,
  onCreateRelationshipSet,
  onUpdateRelationshipSet,
  onDeleteRelationshipSet,
  onSetActiveRelationshipSet,
}: RelationshipReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InferRelationshipsResponse | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [setName, setSetName] = useState(formatDefaultSetName());
  const [setDescription, setSetDescription] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameDescription, setRenameDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingHighRiskRel, setPendingHighRiskRel] = useState<TableRelationship | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const activeSet = relationshipSets.find((set) => set.id === activeRelationshipSetId);
  const resultRelationships = result?.relationships ?? [];

  const selectedRelationships = useMemo(
    () =>
      resultRelationships
        .filter((rel) => selectedCandidateIds.has(rel.id))
        .map(prepareRelationshipForSet),
    [resultRelationships, selectedCandidateIds]
  );

  const groupedRelationships = useMemo(() => {
    const groups = new Map<string, TableRelationship[]>();
    for (const rel of resultRelationships) {
      const key = getRelationshipGroupKey(rel);
      groups.set(key, [...(groups.get(key) ?? []), rel]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === '其他 / 需人工确认') return 1;
      if (b === '其他 / 需人工确认') return -1;
      return a.localeCompare(b);
    });
  }, [resultRelationships]);

  const toggleDataset = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleInfer = useCallback(async () => {
    if (selectedIds.size < 2) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedCandidateIds(new Set());
    setSuccessMessage('');

    try {
      const res = await assistantApi.inferRelationships({
        dataset_ids: Array.from(selectedIds),
        include_value_overlap: false,
        max_candidates: 200,
      });
      const response = res as unknown as {
        code?: number;
        data?: InferRelationshipsResponse;
        message?: string;
      };
      if (response?.code === 200 && response.data) {
        setResult(response.data);
      } else {
        setError(response?.message || '推断失败');
      }
    } catch (e: any) {
      setError(e?.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds]);

  const addCandidate = (rel: TableRelationship) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      next.add(rel.id);
      return next;
    });
  };

  const removeCandidate = (rel: TableRelationship) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      next.delete(rel.id);
      return next;
    });
  };

  const handleToggleCandidate = (rel: TableRelationship, checked: boolean) => {
    if (!checked) {
      removeCandidate(rel);
      return;
    }
    if (classifyRelationshipRisk(rel) === 'high') {
      setPendingHighRiskRel(rel);
      return;
    }
    addCandidate(rel);
  };

  const handleOpenSaveDialog = () => {
    setSetName(formatDefaultSetName());
    setSetDescription('');
    setSaveDialogOpen(true);
  };

  const handleSaveRelationshipSet = () => {
    if (selectedRelationships.length === 0) return;
    const created = onCreateRelationshipSet({
      name: setName,
      description: setDescription,
      relationships: selectedRelationships,
    });
    setSaveDialogOpen(false);
    setSelectedCandidateIds(new Set());
    setSuccessMessage(`已保存关系组「${created.name}」，并设为当前关系组。`);
  };

  const handleOpenRename = () => {
    if (!activeSet) return;
    setRenameName(activeSet.name);
    setRenameDescription(activeSet.description ?? '');
    setRenameDialogOpen(true);
  };

  const handleRename = () => {
    if (!activeSet) return;
    onUpdateRelationshipSet(activeSet.id, {
      name: renameName,
      description: renameDescription,
    });
    setRenameDialogOpen(false);
  };

  const handleDeleteActive = () => {
    if (!activeSet) return;
    onDeleteRelationshipSet(activeSet.id);
    setDeleteDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-[var(--neon-cyan)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">关系组管理</h3>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                {activeSet ? (
                  <>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      当前关系组：{activeSet.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      包含 {activeSet.dataset_ids.length} 张表，{activeSet.relationships.length} 条关系
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      暂无当前关系组
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      你可以先在理清表关系中保存一个关系组。
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={activeRelationshipSetId ?? NO_ACTIVE_SET_VALUE}
                  onValueChange={(value) =>
                    onSetActiveRelationshipSet(value === NO_ACTIVE_SET_VALUE ? undefined : value)
                  }
                >
                  <SelectTrigger className="w-[220px] bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue placeholder="选择关系组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACTIVE_SET_VALUE}>不使用关系组</SelectItem>
                    {relationshipSets.map((set) => (
                      <SelectItem key={set.id} value={set.id}>
                        {set.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeSet}
                  onClick={handleOpenRename}
                  className="border-[var(--border-subtle)]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  重命名
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeSet}
                  onClick={() => setDeleteDialogOpen(true)}
                  className="border-red-400/25 text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeSet}
                  onClick={() => onSetActiveRelationshipSet(undefined)}
                  className="border-[var(--border-subtle)]"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  清除当前
                </Button>
              </div>
            </div>

            {relationshipSets.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-3">
                暂无已保存关系组。你可以选择 2 个以上数据集并推断关系，然后保存为关系组。
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {relationshipSets.map((set) => (
                  <button
                    key={set.id}
                    onClick={() => onSetActiveRelationshipSet(set.id)}
                    className={cn(
                      'text-left rounded-lg border px-3 py-2 transition-colors',
                      set.id === activeRelationshipSetId
                        ? 'border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/8'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--neon-cyan)]/25'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {set.name}
                      </span>
                      {set.id === activeRelationshipSetId && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--neon-cyan)] shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {set.dataset_ids.length} 张表 · {set.relationships.length} 条关系
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <Info className="w-3.5 h-3.5 mt-0.5 text-[var(--neon-cyan)] shrink-0" />
              <p>关系组用于告诉助手哪些表关系可以作为分析上下文；不会自动 join。</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[var(--neon-cyan)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              选择数据集 + 推断表关系
            </h3>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 p-4 space-y-3">
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
              {datasets.map((ds) => {
                const selected = selectedIds.has(ds.id);
                return (
                  <button
                    key={ds.id}
                    onClick={() => toggleDataset(ds.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border',
                      selected
                        ? 'bg-[var(--neon-cyan)]/10 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--neon-cyan)]/20'
                    )}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    <span className="max-w-[170px] truncate">{getDatasetLabel(ds)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleInfer}
                disabled={selectedIds.size < 2 || isLoading}
                className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在分析表结构...
                  </>
                ) : (
                  '推断表关系'
                )}
              </Button>
              <span className="text-xs text-[var(--text-muted)]">
                已选 {selectedIds.size} 个数据集
              </span>
            </div>

            {selectedIds.size < 2 && (
              <p className="text-xs text-[var(--text-muted)]">请至少选择 2 个数据集。</p>
            )}
          </div>
        </section>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-sm">
            {successMessage}
          </div>
        )}

        {result?.warnings && result.warnings.length > 0 && (
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}

        {result && (
          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-[var(--text-primary)]">候选关系</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  共 {result.relationships.length} 条关系建议，已选择 {selectedCandidateIds.size} 条。
                </p>
              </div>
              <Button
                onClick={handleOpenSaveDialog}
                disabled={selectedCandidateIds.size === 0}
                className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存为关系组
              </Button>
            </div>

            {result.relationships.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-muted)]">
                  暂未发现高置信度表关系。你可以尝试选择更多相关数据集，或检查字段命名是否一致。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedRelationships.map(([group, relationships]) => (
                  <div key={group} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {group} 关系组
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {relationships.length} 条
                      </span>
                    </div>
                    <div className="space-y-2">
                      {relationships.map((rel) => (
                        <CandidateRelationshipRow
                          key={rel.id}
                          rel={rel}
                          checked={selectedCandidateIds.has(rel.id)}
                          onCheckedChange={(checked) => handleToggleCandidate(rel, checked)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
          <DialogHeader>
            <DialogTitle>保存为关系组</DialogTitle>
            <DialogDescription>
              将本次选择的候选关系保存为可复用的分析上下文，并设为当前关系组。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--text-secondary)]">关系组名称</span>
              <input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--text-secondary)]">关系组描述（可选）</span>
              <textarea
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
              />
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              将保存 {selectedRelationships.length} 条关系，其中{' '}
              {selectedRelationships.filter((rel) => rel.risk_level === 'high').length} 条为高风险人工确认关系。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveRelationshipSet}
              disabled={selectedRelationships.length === 0 || !setName.trim()}
              className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
          <DialogHeader>
            <DialogTitle>重命名关系组</DialogTitle>
            <DialogDescription>更新当前关系组名称和描述。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
            />
            <textarea
              value={renameDescription}
              onChange={(e) => setRenameDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim()}
              className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除关系组？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该关系组不会再作为分析上下文使用。这个操作只影响浏览器本地保存的关系组。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActive}
              className="bg-red-500 text-white hover:bg-red-500/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingHighRiskRel)}
        onOpenChange={(open) => {
          if (!open) setPendingHighRiskRel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              高风险关系确认
            </AlertDialogTitle>
            <AlertDialogDescription>
              这个关系的字段语义不一致，可能不是合理 join key。确认后可能导致错误分析结果。是否仍要加入关系组？
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingHighRiskRel && (
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-[var(--text-secondary)]">
              {pendingHighRiskRel.source_dataset_name}.{pendingHighRiskRel.source_column}
              <ArrowRight className="inline w-3 h-3 mx-1 text-[var(--text-muted)]" />
              {pendingHighRiskRel.target_dataset_name}.{pendingHighRiskRel.target_column}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingHighRiskRel) addCandidate(pendingHighRiskRel);
                setPendingHighRiskRel(null);
              }}
              className="bg-red-500 text-white hover:bg-red-500/90"
            >
              仍要加入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CandidateRelationshipRow({
  rel,
  checked,
  onCheckedChange,
}: {
  rel: TableRelationship;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const risk = classifyRelationshipRisk(rel);

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border px-3 py-3 transition-colors',
        risk === 'high'
          ? 'bg-red-400/5 border-red-400/25'
          : risk === 'medium'
          ? 'bg-amber-400/5 border-amber-400/20'
          : 'bg-[var(--bg-tertiary)]/60 border-[var(--border-subtle)]'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label="加入本次关系组"
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {rel.source_dataset_name}
            </span>
            <span className="text-xs text-[var(--text-muted)]">.{rel.source_column}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {rel.target_dataset_name}
            </span>
            <span className="text-xs text-[var(--text-muted)]">.{rel.target_column}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              置信度 {rel.confidence.toFixed(2)}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {relationshipTypeLabel(rel.relationship_type)}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border',
                risk === 'high'
                  ? 'bg-red-400/10 text-red-400 border-red-400/25'
                  : risk === 'medium'
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/25'
                  : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
              )}
            >
              {risk !== 'low' && <AlertTriangle className="w-3 h-3" />}
              {riskLabel(risk)}
            </span>
            {checked && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20">
                <CheckCircle2 className="w-3 h-3" />
                加入本次关系组
              </span>
            )}
          </div>

          {rel.warnings.length > 0 && (
            <div className="space-y-1">
              {rel.warnings.slice(0, 2).map((warning, index) => (
                <p key={index} className="flex items-start gap-1.5 text-xs text-amber-400/85">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default RelationshipReviewPanel;
