/**
 * RelationshipReviewPanel - relationship set management + candidate review.
 *
 * Inference results are temporary candidate edges. A saved relationship set is
 * a topic-scoped dataset graph: included dataset nodes plus confirmed edges.
 */

import { useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
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
  Link2,
  Unlink,
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
  RelationshipSetDatasetNode,
  TableRelationship,
} from '@/types/assistant';

interface DatasetOption {
  id: string;
  filename?: string;
  name?: string;
}

interface RelationshipReviewPanelProps {
  datasets: DatasetOption[];
  relationshipSets: RelationshipSet[];
  activeRelationshipSetId?: string;
  onCreateRelationshipSet: (input: {
    name: string;
    description?: string;
    relationships: TableRelationship[];
    dataset_nodes?: RelationshipSetDatasetNode[];
  }) => RelationshipSet;
  onUpdateRelationshipSet: (
    id: string,
    patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships' | 'dataset_nodes'>>
  ) => void;
  onDeleteRelationshipSet: (id: string) => void;
  onSetActiveRelationshipSet: (id?: string) => void;
  onClearActiveRelationshipSet: () => void;
}

const NO_ACTIVE_SET_VALUE = '__none__';
const OTHER_GROUP = '其他 / 需人工确认';

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
  return OTHER_GROUP;
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

function getRiskReasons(rel: TableRelationship): string[] {
  const sourceRoot = semanticRoot(rel.source_column);
  const targetRoot = semanticRoot(rel.target_column);
  const reasons: string[] = [];

  if (sourceRoot && targetRoot && sourceRoot !== targetRoot) {
    reasons.push('字段语义不一致');
  }
  if (rel.confidence < 0.65) {
    reasons.push('置信度低于 0.65');
  }
  if (rel.relationship_type === 'unknown') {
    reasons.push('关系类型未知');
  }
  if (rel.warnings.length > 0) {
    reasons.push('推断结果包含警告');
  }
  return reasons;
}

function classifyRelationshipRisk(rel: TableRelationship): RelationshipRiskLevel {
  const reasons = getRiskReasons(rel);
  if (reasons.length > 0) return 'high';
  if (rel.confidence < 0.8) return 'medium';
  return 'low';
}

function riskLabel(risk: RelationshipRiskLevel): string {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

function prepareRelationshipForSet(rel: TableRelationship): TableRelationship {
  const risk = classifyRelationshipRisk(rel);
  const reasons = getRiskReasons(rel);
  return {
    ...rel,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    risk_level: risk,
    risk_reasons: reasons,
    is_custom: risk === 'high' ? true : rel.is_custom,
    source: risk === 'high' ? 'manual' : rel.source ?? 'inferred',
    warnings:
      risk === 'high' && !rel.warnings.includes('高风险关系：已由用户显式确认')
        ? [...rel.warnings, '高风险关系：已由用户显式确认']
        : rel.warnings,
  };
}

function getDatasetLabel(ds: DatasetOption): string {
  return ds.filename || ds.name || ds.id;
}

function getNodeLabel(node: RelationshipSetDatasetNode): string {
  return node.filename || node.dataset_name || node.dataset_id;
}

function nodeFromDataset(
  ds: DatasetOption,
  role: RelationshipSetDatasetNode['role'],
  reason: string,
  joinable: boolean
): RelationshipSetDatasetNode {
  return {
    dataset_id: ds.id,
    dataset_name: ds.name || ds.filename,
    filename: ds.filename,
    role,
    reason,
    selected_by_user: true,
    joinable,
    included_in_context: role !== 'excluded',
  };
}

function endpointIds(relationships: TableRelationship[]): Set<string> {
  const ids = new Set<string>();
  for (const rel of relationships) {
    ids.add(rel.source_dataset_id);
    ids.add(rel.target_dataset_id);
  }
  return ids;
}

export function RelationshipReviewPanel({
  datasets,
  relationshipSets,
  activeRelationshipSetId,
  onCreateRelationshipSet,
  onUpdateRelationshipSet,
  onDeleteRelationshipSet,
  onSetActiveRelationshipSet,
  onClearActiveRelationshipSet,
}: RelationshipReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InferRelationshipsResponse | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [keptIsolatedIds, setKeptIsolatedIds] = useState<Set<string>>(new Set());
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
  const selectedDatasetList = useMemo(
    () => datasets.filter((ds) => selectedIds.has(ds.id)),
    [datasets, selectedIds]
  );

  const selectedRelationships = useMemo(
    () =>
      resultRelationships
        .filter((rel) => selectedCandidateIds.has(rel.id))
        .map(prepareRelationshipForSet),
    [resultRelationships, selectedCandidateIds]
  );

  const connectedIds = useMemo(() => endpointIds(selectedRelationships), [selectedRelationships]);
  const isolatedDatasets = useMemo(
    () => selectedDatasetList.filter((ds) => !connectedIds.has(ds.id)),
    [connectedIds, selectedDatasetList]
  );
  const keptIsolatedDatasets = useMemo(
    () => isolatedDatasets.filter((ds) => keptIsolatedIds.has(ds.id)),
    [isolatedDatasets, keptIsolatedIds]
  );

  const selectedGraphNodeCount = connectedIds.size + keptIsolatedDatasets.length;
  const canSaveRelationshipSet = selectedGraphNodeCount > 0;

  const groupedRelationships = useMemo(() => {
    const groups = new Map<string, TableRelationship[]>();
    for (const rel of resultRelationships) {
      const key = getRelationshipGroupKey(rel);
      groups.set(key, [...(groups.get(key) ?? []), rel]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === OTHER_GROUP) return 1;
      if (b === OTHER_GROUP) return -1;
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
    setKeptIsolatedIds(new Set());
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
        setError(response?.message || '推断关系失败');
      }
    } catch (e: any) {
      setError(e?.message || '推断关系失败');
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

  const handleKeepIsolated = (datasetId: string, keep: boolean) => {
    setKeptIsolatedIds((prev) => {
      const next = new Set(prev);
      if (keep) next.add(datasetId);
      else next.delete(datasetId);
      return next;
    });
  };

  const buildDatasetNodesForSave = (): RelationshipSetDatasetNode[] => {
    const connectedNodes = Array.from(connectedIds)
      .map((id) => datasets.find((ds) => ds.id === id))
      .filter((ds): ds is DatasetOption => Boolean(ds))
      .map((ds) => nodeFromDataset(ds, 'connected', '由已确认关系连接', true));

    const isolatedNodes = keptIsolatedDatasets.map((ds) =>
      nodeFromDataset(ds, 'isolated', '用户选择保留，但未发现可确认关系', false)
    );

    return [...connectedNodes, ...isolatedNodes];
  };

  const handleOpenSaveDialog = () => {
    setSetName(formatDefaultSetName());
    setSetDescription('');
    setSaveDialogOpen(true);
  };

  const handleSaveRelationshipSet = () => {
    if (!canSaveRelationshipSet) return;
    const created = onCreateRelationshipSet({
      name: setName,
      description: setDescription,
      relationships: selectedRelationships,
      dataset_nodes: buildDatasetNodesForSave(),
    });
    setSaveDialogOpen(false);
    setSelectedCandidateIds(new Set());
    setKeptIsolatedIds(new Set());
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
        <RelationshipSetManagement
          relationshipSets={relationshipSets}
          activeRelationshipSetId={activeRelationshipSetId}
          activeSet={activeSet}
          onSetActiveRelationshipSet={onSetActiveRelationshipSet}
          onOpenRename={handleOpenRename}
          onOpenDelete={() => setDeleteDialogOpen(true)}
          onClearActiveRelationshipSet={onClearActiveRelationshipSet}
        />

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-[var(--neon-cyan)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              选择数据集 + 推断表关系
            </h3>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 p-4 space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              请选择与你当前分析主题相关的一组表。我会推断这些表之间可能的关系；无法关联的表也可以作为孤立参考表保留。
            </p>
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
                    推断中...
                  </>
                ) : (
                  '推断表关系'
                )}
              </Button>
              <span className="text-xs text-[var(--text-muted)]">
                已选择 {selectedIds.size} 张表
              </span>
            </div>

            {selectedIds.size < 2 && (
              <p className="text-xs text-[var(--text-muted)]">请至少选择 2 张数据表。</p>
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
          <>
            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">候选关系分组</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    发现 {result.relationships.length} 条候选关系，已选择 {selectedCandidateIds.size}{' '}
                    条。
                  </p>
                </div>
              </div>

              {result.relationships.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-[var(--border-subtle)]">
                  <p className="text-sm text-[var(--text-muted)]">
                    未发现可确认关系。你仍可以在下方保留相关表作为孤立参考表。
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

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Unlink className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  未发现关系的表 / 孤立表
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                孤立表是你选择保留的相关表，但系统未发现它和其他表的可确认关系。它可以作为参考上下文，但不会自动参与 join。
              </p>
              {isolatedDatasets.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 px-4 py-3 text-xs text-[var(--text-muted)]">
                  当前选中的关系已覆盖所有已选表。
                </div>
              ) : (
                <div className="space-y-2">
                  {isolatedDatasets.map((ds) => {
                    const kept = keptIsolatedIds.has(ds.id);
                    return (
                      <div
                        key={ds.id}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 px-4 py-3 space-y-2"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {getDatasetLabel(ds)}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              未发现它与当前候选关系图中的其他表存在可确认关系。
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={kept ? 'default' : 'outline'}
                              onClick={() => handleKeepIsolated(ds.id, true)}
                              className={cn(
                                kept &&
                                  'bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80'
                              )}
                            >
                              保留为孤立相关表
                            </Button>
                            <Button
                              size="sm"
                              variant={!kept ? 'default' : 'outline'}
                              onClick={() => handleKeepIsolated(ds.id, false)}
                              className={cn(
                                !kept &&
                                  'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                              )}
                            >
                              不加入关系组
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/45 p-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--text-primary)]">保存为关系组</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  将保存 {connectedIds.size} 张已连接表、{selectedRelationships.length}{' '}
                  条关系、{keptIsolatedDatasets.length} 张孤立参考表。
                </p>
              </div>
              <Button
                onClick={handleOpenSaveDialog}
                disabled={!canSaveRelationshipSet}
                className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存为关系组
              </Button>
            </section>
          </>
        )}
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
          <DialogHeader>
            <DialogTitle>保存为关系组</DialogTitle>
            <DialogDescription>
              关系组会保存当前分析主题下的相关表和已确认表关系；不会自动 join，也不代表每次分析都要使用全部表。
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
              将保存 {connectedIds.size} 张已连接表、{selectedRelationships.length}{' '}
              条关系、{keptIsolatedDatasets.length} 张孤立参考表；其中{' '}
              {selectedRelationships.filter((rel) => rel.risk_level === 'high').length}{' '}
              条为高风险关系。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveRelationshipSet}
              disabled={!canSaveRelationshipSet || !setName.trim()}
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
            <DialogDescription>更新当前关系组的名称和描述。</DialogDescription>
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
            <AlertDialogTitle>删除关系组</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，但不会影响原始数据集或任何分析结果。
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
  const reasons = getRiskReasons(rel);

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

          {reasons.length > 0 && (
            <div className="space-y-1">
              {reasons.slice(0, 3).map((reason) => (
                <p key={reason} className="flex items-start gap-1.5 text-xs text-amber-400/85">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {reason}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RelationshipSetManagement({
  relationshipSets,
  activeRelationshipSetId,
  activeSet,
  onSetActiveRelationshipSet,
  onOpenRename,
  onOpenDelete,
  onClearActiveRelationshipSet,
}: {
  relationshipSets: RelationshipSet[];
  activeRelationshipSetId?: string;
  activeSet?: RelationshipSet;
  onSetActiveRelationshipSet: (id?: string) => void;
  onOpenRename: () => void;
  onOpenDelete: () => void;
  onClearActiveRelationshipSet: () => void;
}) {
  const includedNodes = activeSet?.dataset_nodes.filter((node) => node.included_in_context) ?? [];
  const connectedNodes = includedNodes.filter((node) => node.role === 'connected');
  const isolatedNodes = includedNodes.filter(
    (node) => node.role === 'isolated' || node.role === 'reference_only'
  );
  const highRiskRelationships =
    activeSet?.relationships.filter((rel) => rel.risk_level === 'high') ?? [];

  return (
    <section
      className="space-y-3"
      aria-label="关系组管理"
      data-testid="relationship-set-management"
    >
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
                  包含 {includedNodes.length} 张表，{activeSet.relationships.length} 条关系
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  暂无当前关系组
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  暂无已保存关系组。你可以选择 2 个以上数据集并推断关系，然后保存为关系组。
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
                <SelectValue placeholder="切换关系组" />
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
              onClick={onOpenRename}
              className="border-[var(--border-subtle)]"
            >
              <Pencil className="w-3.5 h-3.5" />
              重命名
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeSet}
              onClick={onOpenDelete}
              className="border-red-400/25 text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeSet}
              onClick={onClearActiveRelationshipSet}
              className="border-[var(--border-subtle)]"
            >
              清空当前关系组
            </Button>
          </div>
        </div>

        {relationshipSets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {relationshipSets.map((set) => {
              const nodeCount =
                set.dataset_nodes?.filter((node) => node.included_in_context).length ??
                set.dataset_ids.length;
              return (
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
                    {nodeCount} 张表 / {set.relationships.length} 条关系
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {activeSet && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SetSection
              icon={<Link2 className="w-3.5 h-3.5" />}
              title="已连接表"
              empty="暂无已连接表"
              items={connectedNodes.map(getNodeLabel)}
            />
            <SetSection
              icon={<Unlink className="w-3.5 h-3.5" />}
              title="孤立表 / 参考表"
              empty="暂无孤立表"
              items={isolatedNodes.map((node) => `${getNodeLabel(node)}（不可自动 join）`)}
            />
            <SetSection
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              title="已确认关系"
              empty="暂无已确认关系"
              items={activeSet.relationships.map(
                (rel) =>
                  `${rel.source_dataset_name}.${rel.source_column} -> ${rel.target_dataset_name}.${rel.target_column}`
              )}
            />
            <SetSection
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
              title="高风险关系"
              empty="暂无高风险关系"
              items={highRiskRelationships.map(
                (rel) =>
                  `${rel.source_dataset_name}.${rel.source_column} -> ${rel.target_dataset_name}.${rel.target_column}`
              )}
              danger
            />
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
          <Info className="w-3.5 h-3.5 mt-0.5 text-[var(--neon-cyan)] shrink-0" />
          <p>
            关系组用于保存某个分析主题下的一组相关表和已确认表关系；不会自动 join，也不代表每次分析都要使用全部表。本次计划会从当前关系组中筛选和问题相关的数据集。
          </p>
        </div>
      </div>
    </section>
  );
}

function SetSection({
  icon,
  title,
  empty,
  items,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  items: string[];
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 px-3 py-2">
      <div
        className={cn(
          'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider mb-2',
          danger ? 'text-red-400' : 'text-[var(--text-secondary)]'
        )}
      >
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)]">{empty}</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((item) => (
            <p key={item} className="text-[11px] text-[var(--text-secondary)] truncate">
              {item}
            </p>
          ))}
          {items.length > 5 && (
            <p className="text-[10px] text-[var(--text-muted)]">还有 {items.length - 5} 项</p>
          )}
        </div>
      )}
    </div>
  );
}

export default RelationshipReviewPanel;
