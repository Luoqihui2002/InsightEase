/**
 * RelationshipReviewPanel — 多表关系推断与审阅面板
 *
 * 功能：
 *   选择 2+ 数据集 → 调用后端推断 API → 展示关系建议 → 本地确认/忽略
 *   已确认关系管理（取消确认、清空全部）
 *
 * 约束：
 *   仅基于元数据推断
 *   不自动 join
 *   不读取完整原始数据
 *   确认状态仅保存在组件内存中（controlled 模式下由父级持久化）
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  Table2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assistantApi } from '@/api/assistant';
import { cn } from '@/lib/utils';
import type {
  TableRelationship,
  RelationshipStatus,
  InferRelationshipsResponse,
} from '@/types/assistant';

interface RelationshipReviewPanelProps {
  datasets: Array<{ id: string; filename?: string; name?: string }>;
  confirmedRelationships?: TableRelationship[];
  confirmedRelationshipIds?: string[];
  rejectedRelationshipIds?: string[];
  onConfirmRelationship?: (relationship: TableRelationship) => void;
  onRejectRelationship?: (relationship: TableRelationship) => void;
  onResetRelationship?: (relationship: TableRelationship) => void;
  onClearAllConfirmed?: () => void;
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function getConfidenceLabel(confidence: number): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  if (confidence >= 0.85) {
    return { label: '高置信度', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-400/10' };
  }
  if (confidence >= 0.65) {
    return { label: '中置信度', colorClass: 'text-amber-400', bgClass: 'bg-amber-400/10' };
  }
  return { label: '低置信度', colorClass: 'text-[var(--text-muted)]', bgClass: 'bg-[var(--bg-tertiary)]' };
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

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export function RelationshipReviewPanel({
  datasets,
  confirmedRelationships = [],
  confirmedRelationshipIds = [],
  rejectedRelationshipIds = [],
  onConfirmRelationship,
  onRejectRelationship,
  onResetRelationship,
  onClearAllConfirmed,
}: RelationshipReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InferRelationshipsResponse | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, RelationshipStatus>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfirmedList, setShowConfirmedList] = useState(false);

  // Determine effective status: controlled props take precedence, then local state
  const getStatus = useCallback(
    (relId: string): RelationshipStatus => {
      if (confirmedRelationshipIds.includes(relId)) return 'confirmed';
      if (rejectedRelationshipIds.includes(relId)) return 'rejected';
      return localStatus[relId] || 'suggested';
    },
    [confirmedRelationshipIds, rejectedRelationshipIds, localStatus]
  );

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
    setLocalStatus({});
    setExpandedId(null);

    try {
      const res = await assistantApi.inferRelationships({
        dataset_ids: Array.from(selectedIds),
        include_value_overlap: false,
        max_candidates: 200,
      });
      // Interceptor returns response.data = { code, message, data }
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

  const handleConfirm = useCallback(
    (rel: TableRelationship) => {
      if (onConfirmRelationship) {
        onConfirmRelationship(rel);
      } else {
        setLocalStatus((prev) => ({ ...prev, [rel.id]: 'confirmed' }));
      }
    },
    [onConfirmRelationship]
  );

  const handleReject = useCallback(
    (rel: TableRelationship) => {
      if (onRejectRelationship) {
        onRejectRelationship(rel);
      } else {
        setLocalStatus((prev) => ({ ...prev, [rel.id]: 'rejected' }));
      }
    },
    [onRejectRelationship]
  );

  const handleReset = useCallback(
    (rel: TableRelationship) => {
      if (onResetRelationship) {
        onResetRelationship(rel);
      } else {
        setLocalStatus((prev) => {
          const next = { ...prev };
          delete next[rel.id];
          return next;
        });
      }
    },
    [onResetRelationship]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Filter confirmed relationships relevant to currently selected datasets
  const relevantConfirmed = confirmedRelationships.filter((rel) => {
    if (selectedIds.size === 0) return true;
    return selectedIds.has(rel.source_dataset_id) || selectedIds.has(rel.target_dataset_id);
  });

  const totalControlledConfirmed = confirmedRelationshipIds.length;
  const totalLocalConfirmed = Object.values(localStatus).filter((s) => s === 'confirmed').length;
  const totalConfirmed = onConfirmRelationship ? totalControlledConfirmed : totalLocalConfirmed;
  const totalRejected = onRejectRelationship
    ? rejectedRelationshipIds.length
    : Object.values(localStatus).filter((s) => s === 'rejected').length;

  /* ---------------------------- render ---------------------------- */

  return (
    <div className="h-full flex flex-col">
      {/* 头部说明 */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-start gap-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] p-3.5">
          <Info className="w-4 h-4 text-[var(--neon-cyan)] mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-[var(--text-primary)]">
              选择至少 2 个数据集，我会基于字段名、字段角色、类型和唯一性推断可能的表关系。
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              当前仅基于元数据推断，不会读取完整原始数据，也不会自动 join。请在使用前确认关系是否符合业务含义。
            </p>
          </div>
        </div>
      </div>

      {/* 数据集选择 */}
      <div className="px-6 pb-3">
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          选择数据集（已选 {selectedIds.size} 个）
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
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                )}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">{ds.filename || ds.name || ds.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 触发按钮 */}
      <div className="px-6 pb-4">
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
        {selectedIds.size < 2 && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">请至少选择 2 个数据集</p>
        )}
      </div>

      {/* 错误 */}
      {error && (
        <div className="px-6 pb-4">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* 结果 + 已确认关系 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {/* 已确认关系管理区 */}
        {confirmedRelationships.length > 0 && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 overflow-hidden">
            <button
              onClick={() => setShowConfirmedList((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  已确认关系（{confirmedRelationships.length} 条）
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onClearAllConfirmed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAllConfirmed();
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空全部
                  </button>
                )}
                {showConfirmedList ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {showConfirmedList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      已确认关系会作为后续分析计划的上下文保存在本地。你可以随时取消确认。
                    </p>
                    {relevantConfirmed.length === 0 && selectedIds.size > 0 && (
                      <p className="text-xs text-[var(--text-muted)]">
                        当前所选数据集中暂无已确认关系。
                      </p>
                    )}
                    {relevantConfirmed.map((rel) => (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] min-w-0">
                          <span className="truncate">{rel.source_dataset_name}.{rel.source_column}</span>
                          <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                          <span className="truncate">{rel.target_dataset_name}.{rel.target_column}</span>
                        </div>
                        <button
                          onClick={() => handleReset(rel)}
                          className="shrink-0 px-2 py-1 rounded-md text-[10px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          取消确认
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* API 级警告 */}
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

        {/* 关系列表 */}
        {result && (
          <>
            {result.relationships.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-[var(--text-muted)]">
                  暂未发现高置信度表关系。你可以尝试选择更多相关数据集，或检查字段命名是否一致。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 统计 */}
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>共 {result.relationships.length} 条关系建议</span>
                  <span className="text-[var(--border-subtle)]">|</span>
                  <span>已确认 {totalConfirmed} 条</span>
                  <span className="text-[var(--border-subtle)]">|</span>
                  <span>已忽略 {totalRejected} 条</span>
                </div>

                {result.relationships.map((rel) => (
                  <RelationshipCard
                    key={rel.id}
                    rel={rel}
                    status={getStatus(rel.id)}
                    isExpanded={expandedId === rel.id}
                    onToggleExpand={() => toggleExpand(rel.id)}
                    onConfirm={() => handleConfirm(rel)}
                    onReject={() => handleReject(rel)}
                    onReset={() => handleReset(rel)}
                  />
                ))}

                <p className="text-xs text-[var(--text-muted)] pt-2">
                  确认状态已保存在本地浏览器中，刷新页面后仍然保留。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RelationshipCard                                                   */
/* ------------------------------------------------------------------ */

function RelationshipCard({
  rel,
  status,
  isExpanded,
  onToggleExpand,
  onConfirm,
  onReject,
  onReset,
}: {
  rel: TableRelationship;
  status: RelationshipStatus;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const conf = getConfidenceLabel(rel.confidence);

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border transition-colors',
        status === 'confirmed'
          ? 'bg-emerald-400/5 border-emerald-400/20'
          : status === 'rejected'
          ? 'bg-[var(--bg-tertiary)]/40 border-[var(--border-subtle)]/50 opacity-60'
          : 'bg-[var(--bg-tertiary)]/60 border-[var(--border-subtle)]'
      )}
    >
      {/* 主行 */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* 左侧：关系描述 */}
          <div className="flex-1 min-w-0">
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

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  conf.bgClass,
                  conf.colorClass
                )}
              >
                {conf.label} {rel.confidence.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                {relationshipTypeLabel(rel.relationship_type)}
              </span>
              {status === 'confirmed' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                  <CheckCircle2 className="w-3 h-3" />
                  已确认
                </span>
              )}
              {status === 'rejected' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-400/10 text-red-400 border border-red-400/20">
                  <XCircle className="w-3 h-3" />
                  已忽略
                </span>
              )}
              {rel.warnings.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {rel.warnings.length} 条警告
                </span>
              )}
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            {status === 'suggested' && (
              <>
                <button
                  onClick={onConfirm}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
                >
                  确认关系
                </button>
                <button
                  onClick={onReject}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-red-400 hover:border-red-400/20 transition-colors"
                >
                  忽略
                </button>
              </>
            )}
            {status !== 'suggested' && (
              <button
                onClick={onReset}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
              >
                重置
              </button>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* 证据 */}
              {rel.evidence.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    推断依据
                  </p>
                  <div className="space-y-1">
                    {rel.evidence.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-[var(--neon-cyan)] mt-0.5">+</span>
                        <span className="text-[var(--text-secondary)]">{ev.message}</span>
                        <span className="text-[var(--text-muted)] ml-auto shrink-0">
                          +{ev.score.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 警告 */}
              {rel.warnings.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-1.5">
                    注意事项
                  </p>
                  <div className="space-y-1">
                    {rel.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default RelationshipReviewPanel;
