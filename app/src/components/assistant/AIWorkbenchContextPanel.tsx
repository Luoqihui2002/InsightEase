import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  Info,
  Loader2,
  ShieldAlert,
  Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTablePreview } from '@/components/data-display/DataTablePreview';
import { datasetApi } from '@/api/datasets';
import { cn } from '@/lib/utils';
import type {
  RelationshipSet,
  RelationshipSetDatasetNode,
  TableRelationship,
} from '@/types/assistant';
import type { FieldSchema } from '@/types/api';

interface ContextDataset {
  id: string;
  name?: string;
  filename?: string;
  row_count?: number;
  col_count?: number;
  quality_score?: number;
  schema?: FieldSchema[];
}

interface PreviewState {
  loading: boolean;
  error?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows?: number;
}

interface AIWorkbenchContextPanelProps {
  selectedDatasetId?: string;
  selectedDatasetName?: string;
  activeRelationshipSet?: RelationshipSet;
  datasets: ContextDataset[];
  layoutMode: 'horizontal' | 'vertical';
  onSelectDataset?: (datasetId: string) => void;
}

function getDatasetLabel(dataset?: ContextDataset | RelationshipSetDatasetNode): string {
  if (!dataset) return 'Unknown dataset';
  if ('dataset_id' in dataset) {
    return dataset.filename || dataset.dataset_name || dataset.dataset_id;
  }
  return dataset.filename || dataset.name || dataset.id;
}

function formatNumber(value?: number): string {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString();
}

function getNodeDataset(node: RelationshipSetDatasetNode, datasets: ContextDataset[]) {
  return datasets.find((dataset) => dataset.id === node.dataset_id);
}

function getRelationshipLabel(rel: TableRelationship): string {
  return `${rel.source_dataset_name}.${rel.source_column} -> ${rel.target_dataset_name}.${rel.target_column}`;
}

function getRiskLabel(rel: TableRelationship): string {
  if (rel.risk_level === 'high') return '高';
  if (rel.risk_level === 'medium') return '中';
  return '低';
}

export function AIWorkbenchContextPanel({
  selectedDatasetId,
  selectedDatasetName,
  activeRelationshipSet,
  datasets,
  layoutMode,
  onSelectDataset,
}: AIWorkbenchContextPanelProps) {
  const [previewCache, setPreviewCache] = useState<Record<string, PreviewState>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );
  const includedNodes = activeRelationshipSet?.dataset_nodes.filter((node) => node.included_in_context) ?? [];
  const connectedNodes = includedNodes.filter((node) => node.role === 'connected');
  const isolatedNodes = includedNodes.filter(
    (node) => node.role === 'isolated' || node.role === 'reference_only'
  );
  const relationships = activeRelationshipSet?.relationships ?? [];
  const highRiskRelationships = relationships.filter((rel) => rel.risk_level === 'high');

  const loadPreview = async (datasetId: string) => {
    const existing = previewCache[datasetId];
    if (existing?.columns.length || existing?.loading) return;

    setPreviewCache((prev) => ({
      ...prev,
      [datasetId]: { loading: true, columns: [], rows: [] },
    }));

    try {
      const res = await datasetApi.preview(datasetId, 5);
      const response = res as unknown as {
        code?: number;
        data?: { columns?: string[]; data?: Record<string, unknown>[]; total_rows?: number };
      };
      const preview = response.data;
      setPreviewCache((prev) => ({
        ...prev,
        [datasetId]: {
          loading: false,
          columns: preview?.columns ?? [],
          rows: preview?.data ?? [],
          totalRows: preview?.total_rows,
        },
      }));
    } catch (error) {
      setPreviewCache((prev) => ({
        ...prev,
        [datasetId]: {
          loading: false,
          columns: [],
          rows: [],
          error: error instanceof Error ? error.message : '预览加载失败',
        },
      }));
    }
  };

  useEffect(() => {
    if (!selectedDatasetId) return;

    setExpandedPreviews((prev) => {
      if (prev.has(selectedDatasetId)) return prev;
      const next = new Set(prev);
      next.add(selectedDatasetId);
      return next;
    });
    void loadPreview(selectedDatasetId);
  }, [selectedDatasetId]);

  const togglePreview = (datasetId: string) => {
    setExpandedPreviews((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) next.delete(datasetId);
      else next.add(datasetId);
      return next;
    });
    void loadPreview(datasetId);
  };

  const hasContext = Boolean(selectedDatasetId || activeRelationshipSet);

  return (
    <aside
      className={cn(
        'h-full min-h-0 overflow-hidden flex flex-col bg-[var(--bg-tertiary)]/30',
        layoutMode === 'horizontal'
          ? 'w-[38%] border-l border-[var(--border-subtle)]'
          : 'border-b border-[var(--border-subtle)] max-h-[280px]'
      )}
      aria-label="AI Workbench context panel"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">上下文面板</h3>
          <p className="text-[10px] text-[var(--text-muted)]">
            这里只展示样例数据，不会运行分析或修改数据。
          </p>
        </div>
        <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {!hasContext && <EmptyContext />}

        {selectedDatasetId && (
          <DatasetContext
            dataset={selectedDataset}
            fallbackName={selectedDatasetName}
            preview={previewCache[selectedDatasetId]}
            expanded={expandedPreviews.has(selectedDatasetId)}
            onTogglePreview={() => togglePreview(selectedDatasetId)}
          />
        )}

        {activeRelationshipSet && (
          <RelationshipSetContext
            relationshipSet={activeRelationshipSet}
            connectedNodes={connectedNodes}
            isolatedNodes={isolatedNodes}
            relationships={relationships}
            highRiskRelationships={highRiskRelationships}
            datasets={datasets}
            previewCache={previewCache}
            expandedPreviews={expandedPreviews}
            onTogglePreview={togglePreview}
            onSelectDataset={onSelectDataset}
          />
        )}

        <section className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/35 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <Info className="w-3.5 h-3.5" />
            分析历史上下文
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
            后续将支持选择历史分析结果，并让 AI 基于结果继续解释或生成下一步分析。
          </p>
        </section>
      </div>
    </aside>
  );
}

function EmptyContext() {
  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Database className="w-4 h-4 text-[var(--neon-cyan)]" />
        暂无上下文
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
        请选择一个数据集，或选择一个关系组，我会在这里展示当前分析上下文。
      </p>
      <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
        <p>- 选择单个数据集：查看字段和样例数据</p>
        <p>- 选择关系组：查看相关表、关系边和参考表</p>
        <p>- 后续可选择分析历史：让 AI 继续解释历史结果</p>
      </div>
    </section>
  );
}

function DatasetContext({
  dataset,
  fallbackName,
  preview,
  expanded,
  onTogglePreview,
}: {
  dataset?: ContextDataset;
  fallbackName?: string;
  preview?: PreviewState;
  expanded: boolean;
  onTogglePreview: () => void;
}) {
  const schema = dataset?.schema ?? [];

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">当前主数据集</p>
          <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {getDatasetLabel(dataset) || fallbackName}
          </h4>
        </div>
        <Table2 className="w-4 h-4 text-[var(--neon-cyan)] shrink-0" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="行数" value={formatNumber(dataset?.row_count)} />
        <Metric label="列数" value={formatNumber(dataset?.col_count)} />
        <Metric
          label="质量"
          value={typeof dataset?.quality_score === 'number' ? `${Math.round(dataset.quality_score)}%` : '-'}
        />
      </div>

      <button
        onClick={onTogglePreview}
        className="flex items-center gap-1.5 text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {expanded ? '收起样例数据' : '查看前 5 行'}
      </button>

      {expanded && <PreviewBlock preview={preview} />}

      {schema.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">字段摘要</p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
            {schema.slice(0, 18).map((field) => (
              <div
                key={field.name}
                className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)]/60 px-2 py-1.5 last:border-b-0"
              >
                <span className="truncate text-xs text-[var(--text-primary)]">{field.name}</span>
                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                  {field.semantic_type || field.dtype || 'unknown'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RelationshipSetContext({
  relationshipSet,
  connectedNodes,
  isolatedNodes,
  relationships,
  highRiskRelationships,
  datasets,
  previewCache,
  expandedPreviews,
  onTogglePreview,
  onSelectDataset,
}: {
  relationshipSet: RelationshipSet;
  connectedNodes: RelationshipSetDatasetNode[];
  isolatedNodes: RelationshipSetDatasetNode[];
  relationships: TableRelationship[];
  highRiskRelationships: TableRelationship[];
  datasets: ContextDataset[];
  previewCache: Record<string, PreviewState>;
  expandedPreviews: Set<string>;
  onTogglePreview: (datasetId: string) => void;
  onSelectDataset?: (datasetId: string) => void;
}) {
  const nodeCount = relationshipSet.dataset_nodes.filter((node) => node.included_in_context).length;

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[var(--neon-cyan)]" />
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">当前关系组</p>
        </div>
        <h4 className="mt-1 text-sm font-medium text-[var(--text-primary)]">{relationshipSet.name}</h4>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          包含 {nodeCount} 张表，{relationships.length} 条关系
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
          关系组用于告诉助手哪些表和关系可以作为分析上下文，不会自动 join。
        </p>
      </div>

      <NodeSection
        title="已连接表"
        nodes={connectedNodes}
        datasets={datasets}
        previewCache={previewCache}
        expandedPreviews={expandedPreviews}
        onTogglePreview={onTogglePreview}
        onSelectDataset={onSelectDataset}
      />

      <NodeSection
        title="孤立/参考表"
        nodes={isolatedNodes}
        datasets={datasets}
        previewCache={previewCache}
        expandedPreviews={expandedPreviews}
        onTogglePreview={onTogglePreview}
        onSelectDataset={onSelectDataset}
        isolated
      />

      <RelationshipSection title="已确认关系" relationships={relationships} />
      <RelationshipSection title="高风险关系" relationships={highRiskRelationships} highRisk />
    </section>
  );
}

function NodeSection({
  title,
  nodes,
  datasets,
  previewCache,
  expandedPreviews,
  onTogglePreview,
  onSelectDataset,
  isolated,
}: {
  title: string;
  nodes: RelationshipSetDatasetNode[];
  datasets: ContextDataset[];
  previewCache: Record<string, PreviewState>;
  expandedPreviews: Set<string>;
  onTogglePreview: (datasetId: string) => void;
  onSelectDataset?: (datasetId: string) => void;
  isolated?: boolean;
}) {
  if (nodes.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-[var(--text-secondary)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">暂无</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{title}</p>
      <div className="space-y-2">
        {nodes.map((node) => {
          const dataset = getNodeDataset(node, datasets);
          const expanded = expandedPreviews.has(node.dataset_id);
          return (
            <div
              key={node.dataset_id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {getDatasetLabel(dataset ?? node)}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    角色：{node.role} · {formatNumber(dataset?.row_count)} 行 / {formatNumber(dataset?.col_count)} 列
                  </p>
                  {isolated && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      孤立参考表：未发现可确认关系，不会自动参与 join。
                    </p>
                  )}
                </div>
                {onSelectDataset && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectDataset(node.dataset_id)}
                    className="h-7 px-2 text-[10px]"
                  >
                    设为主表
                  </Button>
                )}
              </div>
              <button
                onClick={() => onTogglePreview(node.dataset_id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {expanded ? '收起前 5 行' : '查看前 5 行'}
              </button>
              {expanded && <div className="mt-2"><PreviewBlock preview={previewCache[node.dataset_id]} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelationshipSection({
  title,
  relationships,
  highRisk,
}: {
  title: string;
  relationships: TableRelationship[];
  highRisk?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{title}</p>
      {relationships.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">暂无</p>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className={cn(
                'rounded-lg border p-2 text-xs',
                highRisk
                  ? 'border-red-400/25 bg-red-400/8'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50'
              )}
            >
              <div className="flex items-start gap-2">
                {highRisk ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                ) : (
                  <GitBranch className="w-3.5 h-3.5 text-[var(--neon-cyan)] mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="break-all text-[var(--text-primary)]">{getRelationshipLabel(rel)}</p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    关系类型：{rel.relationship_type || 'unknown'} · 风险：{getRiskLabel(rel)}
                  </p>
                  {highRisk && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-red-300">
                      <AlertTriangle className="w-3 h-3" />
                      不会自动 join，请谨慎使用。
                    </p>
                  )}
                  {rel.risk_reasons && rel.risk_reasons.length > 0 && (
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {rel.risk_reasons.join('；')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewBlock({ preview }: { preview?: PreviewState }) {
  if (!preview || preview.loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-muted)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        正在加载前 5 行...
      </div>
    );
  }

  if (preview.error) {
    return (
      <div className="rounded-lg border border-red-400/25 bg-red-400/8 p-3 text-xs text-red-300">
        {preview.error}
      </div>
    );
  }

  return (
    <DataTablePreview
      columns={preview.columns}
      data={preview.rows}
      maxRows={5}
      maxHeight="180px"
      emptyMessage="暂无样例数据"
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/55 px-2 py-1.5">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export default AIWorkbenchContextPanel;
