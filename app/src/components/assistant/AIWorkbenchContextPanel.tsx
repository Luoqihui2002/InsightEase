import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  History,
  Info,
  Loader2,
  ShieldAlert,
  Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTablePreview } from '@/components/data-display/DataTablePreview';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import { buildSafeResultSummary } from '@/lib/assistant/safeResultSummary';
import { cn } from '@/lib/utils';
import type {
  RelationshipSet,
  RelationshipSetDatasetNode,
  TableRelationship,
} from '@/types/assistant';
import type { Analysis, FieldSchema } from '@/types/api';
import type { SafeResultSummary } from '@/types/resultSummary';

const SECTION_STORAGE_KEY = 'insightease_ai_workbench_context_panel_sections';

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
  selectedAnalysisHistoryId?: string;
  attachedResultSummary?: SafeResultSummary;
  onSelectDataset?: (datasetId: string) => void;
  onSelectAnalysisHistory?: (analysisId?: string) => void;
  onClearAttachedResultSummary?: () => void;
}

interface ContextPanelSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  openStates: Record<string, boolean>;
  onToggle: (id: string, defaultOpen: boolean) => void;
  children: ReactNode;
}

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(SECTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'boolean')
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  try {
    sessionStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-critical UI preference only.
  }
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

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
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

function getAnalysisTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    descriptive: '描述统计',
    statistics: '统计分析',
    correlation: '相关分析',
    clustering: '聚类分析',
    forecast: '预测分析',
    attribution: '归因分析',
    time_series: '时间序列',
    funnel: '漏斗分析',
    rfm: 'RFM 分析',
    smart_process: '智能处理',
  };
  return type ? labels[type] || type : '-';
}

function getStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
  };
  return status ? labels[status] || status : '-';
}

function summarizeResult(result: unknown): string | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return `结果包含 ${result.length} 条记录。`;
  if (typeof result === 'object') {
    const keys = Object.keys(result as Record<string, unknown>).slice(0, 6);
    if (keys.length > 0) return `结果包含字段：${keys.join('、')}`;
  }
  return '该历史结果包含可查看的分析输出。';
}

export function AIWorkbenchContextPanel({
  selectedDatasetId,
  selectedDatasetName,
  activeRelationshipSet,
  datasets,
  layoutMode,
  selectedAnalysisHistoryId,
  attachedResultSummary,
  onSelectDataset,
  onSelectAnalysisHistory,
  onClearAttachedResultSummary,
}: AIWorkbenchContextPanelProps) {
  const [previewCache, setPreviewCache] = useState<Record<string, PreviewState>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [sectionOpenStates, setSectionOpenStates] = useState<Record<string, boolean>>(loadSectionState);
  const [historyItems, setHistoryItems] = useState<Analysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');

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
  const selectedHistory = historyItems.find((item) => item.id === selectedAnalysisHistoryId);

  const filteredHistoryItems = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return historyItems;
    return historyItems.filter((item) => {
      const datasetName = datasets.find((dataset) => dataset.id === item.dataset_id)?.filename ?? '';
      return (
        getAnalysisTypeLabel(item.type).toLowerCase().includes(query) ||
        datasetName.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
      );
    });
  }, [datasets, historyItems, historySearch]);

  useEffect(() => {
    saveSectionState(sectionOpenStates);
  }, [sectionOpenStates]);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await analysisApi.list(1, 20);
        const raw = response as unknown as {
          items?: Analysis[];
          data?: { items?: Analysis[] } | Analysis[];
        };
        const items = raw.items || (Array.isArray(raw.data) ? raw.data : raw.data?.items) || [];
        if (mounted) setHistoryItems(items);
      } catch (error) {
        if (mounted) {
          setHistoryError(error instanceof Error ? error.message : '分析历史加载失败');
        }
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSection = (id: string, defaultOpen: boolean) => {
    setSectionOpenStates((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? defaultOpen),
    }));
  };

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

  const ensurePreview = (datasetId: string) => {
    void loadPreview(datasetId);
  };

  const togglePreview = (datasetId: string) => {
    setExpandedPreviews((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) next.delete(datasetId);
      else next.add(datasetId);
      return next;
    });
    void loadPreview(datasetId);
  };

  const hasContext = Boolean(selectedDatasetId || activeRelationshipSet || selectedAnalysisHistoryId || attachedResultSummary);

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
            上下文面板只展示样例数据和元信息，不会运行分析或修改数据。
          </p>
        </div>
        <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {!hasContext && <EmptyContext />}

        {selectedDatasetId && (
          <DatasetContext
            dataset={selectedDataset}
            fallbackName={selectedDatasetName}
            preview={previewCache[selectedDatasetId]}
            expandedPreview={expandedPreviews.has(selectedDatasetId)}
            sectionOpenStates={sectionOpenStates}
            onToggleSection={toggleSection}
            onTogglePreview={() => togglePreview(selectedDatasetId)}
            onEnsurePreview={() => ensurePreview(selectedDatasetId)}
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
            sectionOpenStates={sectionOpenStates}
            onToggleSection={toggleSection}
            onTogglePreview={togglePreview}
            onSelectDataset={onSelectDataset}
          />
        )}

        <AnalysisHistoryContextWithPreview
          historyItems={filteredHistoryItems}
          allHistoryCount={historyItems.length}
          selectedHistory={selectedHistory}
          attachedResultSummary={attachedResultSummary}
          datasets={datasets}
          loading={historyLoading}
          error={historyError}
          search={historySearch}
          onSearchChange={setHistorySearch}
          onSelect={onSelectAnalysisHistory}
          onClearAttachedResultSummary={onClearAttachedResultSummary}
          sectionOpenStates={sectionOpenStates}
          onToggleSection={toggleSection}
        />
      </div>
    </aside>
  );
}

function ContextPanelSection({
  id,
  title,
  subtitle,
  icon,
  defaultOpen = false,
  badge,
  openStates,
  onToggle,
  children,
}: ContextPanelSectionProps) {
  const open = openStates[id] ?? defaultOpen;

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/45 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id, defaultOpen)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-tertiary)]/45 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-[var(--neon-cyan)] shrink-0">{icon}</span>}
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{title}</p>
            {subtitle && <p className="text-[10px] text-[var(--text-muted)] truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge !== undefined && (
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {badge}
            </span>
          )}
          {open ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </div>
      </button>
      <div className={cn('px-3 pb-3', !open && 'hidden')}>{children}</div>
    </section>
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
        <p>- 选择分析历史：为后续解释和追问准备上下文</p>
      </div>
    </section>
  );
}

function DatasetContext({
  dataset,
  fallbackName,
  preview,
  expandedPreview,
  sectionOpenStates,
  onToggleSection,
  onTogglePreview,
  onEnsurePreview,
}: {
  dataset?: ContextDataset;
  fallbackName?: string;
  preview?: PreviewState;
  expandedPreview: boolean;
  sectionOpenStates: Record<string, boolean>;
  onToggleSection: (id: string, defaultOpen: boolean) => void;
  onTogglePreview: () => void;
  onEnsurePreview: () => void;
}) {
  const schema = dataset?.schema ?? [];

  return (
    <>
      <ContextPanelSection
        id="dataset-summary"
        title="当前主数据集"
        subtitle={getDatasetLabel(dataset) || fallbackName}
        icon={<Table2 className="w-4 h-4" />}
        defaultOpen
        openStates={sectionOpenStates}
        onToggle={onToggleSection}
      >
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Metric label="行数" value={formatNumber(dataset?.row_count)} />
          <Metric label="列数" value={formatNumber(dataset?.col_count)} />
          <Metric
            label="质量"
            value={typeof dataset?.quality_score === 'number' ? `${Math.round(dataset.quality_score)}%` : '-'}
          />
        </div>
      </ContextPanelSection>

      <ContextPanelSection
        id="dataset-preview"
        title="样例数据"
        subtitle="前 5 行，不会运行分析"
        icon={<Database className="w-4 h-4" />}
        defaultOpen={false}
        openStates={sectionOpenStates}
        onToggle={(id, defaultOpen) => {
          onToggleSection(id, defaultOpen);
          onEnsurePreview();
        }}
      >
        {!expandedPreview && (
          <button
            onClick={onTogglePreview}
            className="mb-2 flex items-center gap-1.5 text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            查看前 5 行
          </button>
        )}
        {expandedPreview ? (
          <>
            <button
              onClick={onTogglePreview}
              className="mb-2 flex items-center gap-1.5 text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              收起样例数据
            </button>
            <PreviewBlock preview={preview} />
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">展开后只加载当前数据集的前 5 行。</p>
        )}
      </ContextPanelSection>

      {schema.length > 0 && (
        <ContextPanelSection
          id="dataset-fields"
          title="字段摘要"
          subtitle={`${schema.length} 个字段`}
          icon={<Info className="w-4 h-4" />}
          defaultOpen={schema.length <= 8}
          badge={schema.length}
          openStates={sectionOpenStates}
          onToggle={onToggleSection}
        >
          <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
            {schema.slice(0, 30).map((field) => (
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
        </ContextPanelSection>
      )}
    </>
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
  sectionOpenStates,
  onToggleSection,
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
  sectionOpenStates: Record<string, boolean>;
  onToggleSection: (id: string, defaultOpen: boolean) => void;
  onTogglePreview: (datasetId: string) => void;
  onSelectDataset?: (datasetId: string) => void;
}) {
  const nodeCount = relationshipSet.dataset_nodes.filter((node) => node.included_in_context).length;

  return (
    <>
      <ContextPanelSection
        id="relationship-set-summary"
        title="当前关系组"
        subtitle={relationshipSet.name}
        icon={<GitBranch className="w-4 h-4" />}
        defaultOpen
        openStates={sectionOpenStates}
        onToggle={onToggleSection}
      >
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Metric label="表" value={formatNumber(nodeCount)} />
          <Metric label="关系" value={formatNumber(relationships.length)} />
          <Metric label="参考表" value={formatNumber(isolatedNodes.length)} />
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)] leading-relaxed">
          关系组用于提供可参考的表关系上下文，不会自动 join。
        </p>
      </ContextPanelSection>

      <NodeSection
        id="relationship-connected"
        title="已连接表"
        nodes={connectedNodes}
        datasets={datasets}
        previewCache={previewCache}
        expandedPreviews={expandedPreviews}
        defaultOpen={connectedNodes.length <= 4}
        sectionOpenStates={sectionOpenStates}
        onToggleSection={onToggleSection}
        onTogglePreview={onTogglePreview}
        onSelectDataset={onSelectDataset}
      />

      <NodeSection
        id="relationship-isolated"
        title="孤立/参考表"
        nodes={isolatedNodes}
        datasets={datasets}
        previewCache={previewCache}
        expandedPreviews={expandedPreviews}
        defaultOpen={false}
        sectionOpenStates={sectionOpenStates}
        onToggleSection={onToggleSection}
        onTogglePreview={onTogglePreview}
        onSelectDataset={onSelectDataset}
        isolated
      />

      <RelationshipSection
        id="relationship-edges"
        title="已确认关系"
        relationships={relationships}
        defaultOpen={relationships.length <= 3}
        sectionOpenStates={sectionOpenStates}
        onToggleSection={onToggleSection}
      />

      <RelationshipSection
        id="relationship-high-risk"
        title="高风险关系"
        relationships={highRiskRelationships}
        defaultOpen={highRiskRelationships.length > 0}
        sectionOpenStates={sectionOpenStates}
        onToggleSection={onToggleSection}
        highRisk
      />
    </>
  );
}

function NodeSection({
  id,
  title,
  nodes,
  datasets,
  previewCache,
  expandedPreviews,
  defaultOpen,
  sectionOpenStates,
  onToggleSection,
  onTogglePreview,
  onSelectDataset,
  isolated,
}: {
  id: string;
  title: string;
  nodes: RelationshipSetDatasetNode[];
  datasets: ContextDataset[];
  previewCache: Record<string, PreviewState>;
  expandedPreviews: Set<string>;
  defaultOpen: boolean;
  sectionOpenStates: Record<string, boolean>;
  onToggleSection: (id: string, defaultOpen: boolean) => void;
  onTogglePreview: (datasetId: string) => void;
  onSelectDataset?: (datasetId: string) => void;
  isolated?: boolean;
}) {
  return (
    <ContextPanelSection
      id={id}
      title={title}
      subtitle={isolated ? '不会自动参与 join' : undefined}
      icon={<Table2 className="w-4 h-4" />}
      defaultOpen={defaultOpen}
      badge={nodes.length}
      openStates={sectionOpenStates}
      onToggle={onToggleSection}
    >
      {isolated && nodes.length > 0 && (
        <p className="mb-2 text-xs text-[var(--text-muted)] leading-relaxed">
          这些表被保留为当前主题的参考上下文，但未发现可确认关系，不会自动参与 join。
        </p>
      )}
      {nodes.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">暂无</p>
      ) : (
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
                        孤立参考表：不会自动参与 join。
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
      )}
    </ContextPanelSection>
  );
}

function RelationshipSection({
  id,
  title,
  relationships,
  defaultOpen,
  sectionOpenStates,
  onToggleSection,
  highRisk,
}: {
  id: string;
  title: string;
  relationships: TableRelationship[];
  defaultOpen: boolean;
  sectionOpenStates: Record<string, boolean>;
  onToggleSection: (id: string, defaultOpen: boolean) => void;
  highRisk?: boolean;
}) {
  return (
    <ContextPanelSection
      id={id}
      title={title}
      icon={highRisk ? <ShieldAlert className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
      defaultOpen={defaultOpen}
      badge={relationships.length}
      openStates={sectionOpenStates}
      onToggle={onToggleSection}
    >
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
    </ContextPanelSection>
  );
}

function AnalysisHistoryContextWithPreview({
  historyItems,
  allHistoryCount,
  selectedHistory,
  attachedResultSummary,
  datasets,
  loading,
  error,
  search,
  onSearchChange,
  onSelect,
  onClearAttachedResultSummary,
  sectionOpenStates,
  onToggleSection,
}: {
  historyItems: Analysis[];
  allHistoryCount: number;
  selectedHistory?: Analysis;
  attachedResultSummary?: SafeResultSummary;
  datasets: ContextDataset[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect?: (analysisId?: string) => void;
  onClearAttachedResultSummary?: () => void;
  sectionOpenStates: Record<string, boolean>;
  onToggleSection: (id: string, defaultOpen: boolean) => void;
}) {
  const [inlinePreviewOpen, setInlinePreviewOpen] = useState(false);
  const [inlinePreviewLoading, setInlinePreviewLoading] = useState(false);
  const [inlinePreviewError, setInlinePreviewError] = useState<string | null>(null);
  const [inlinePreviewAnalysis, setInlinePreviewAnalysis] = useState<Analysis | undefined>(selectedHistory);

  const datasetName = selectedHistory
    ? getDatasetLabel(datasets.find((dataset) => dataset.id === selectedHistory.dataset_id))
    : attachedResultSummary?.dataset_name || attachedResultSummary?.dataset_id;
  const hasResultContext = Boolean(selectedHistory || attachedResultSummary);
  const selectedContextId = selectedHistory?.id || attachedResultSummary?.analysis_id;
  const contextTitle = selectedHistory
    ? getAnalysisTypeLabel(selectedHistory.type)
    : attachedResultSummary?.title || attachedResultSummary?.analysis_type || '分析结果';
  const contextStatus = selectedHistory
    ? getStatusLabel(selectedHistory.status)
    : attachedResultSummary?.status || '-';
  const contextCreatedAt = selectedHistory?.created_at || attachedResultSummary?.created_at;
  const contextRecommendationCount = selectedHistory?.ai_recommendations?.length ?? 0;
  const directSummaryAnalysis: Analysis | undefined = useMemo(
    () =>
      attachedResultSummary
        ? {
            id: attachedResultSummary.analysis_id,
            dataset_id: attachedResultSummary.dataset_id || '',
            type: attachedResultSummary.analysis_type as Analysis['type'],
            status: attachedResultSummary.status as Analysis['status'],
            params: {},
            result_data: undefined,
            ai_interpretation: attachedResultSummary.ai_interpretation || attachedResultSummary.ai_summary,
            created_at: attachedResultSummary.created_at || new Date().toISOString(),
            completed_at: attachedResultSummary.completed_at,
          }
        : undefined,
    [attachedResultSummary]
  );
  const previewAnalysis =
    inlinePreviewAnalysis?.id === selectedContextId
      ? inlinePreviewAnalysis
      : selectedHistory || directSummaryAnalysis;
  const safePreview = useMemo(
    () =>
      attachedResultSummary && !selectedHistory
        ? attachedResultSummary
        : previewAnalysis
        ? buildSafeResultSummary(previewAnalysis, { dataset_name: datasetName })
        : undefined,
    [attachedResultSummary, datasetName, previewAnalysis, selectedHistory]
  );
  const resultSummary =
    selectedHistory?.ai_interpretation ||
    attachedResultSummary?.ai_summary ||
    attachedResultSummary?.ai_interpretation ||
    summarizeResult(selectedHistory?.result_data) ||
    (hasResultContext ? '该历史结果暂无摘要。后续可接入 AI Result Explainer。' : undefined);

  useEffect(() => {
    setInlinePreviewOpen(false);
    setInlinePreviewError(null);
    setInlinePreviewAnalysis(selectedHistory || directSummaryAnalysis);
  }, [selectedContextId, selectedHistory, directSummaryAnalysis]);

  const handleToggleInlinePreview = async () => {
    if (!selectedHistory && !attachedResultSummary) return;

    if (inlinePreviewOpen) {
      setInlinePreviewOpen(false);
      return;
    }

    setInlinePreviewOpen(true);
    setInlinePreviewError(null);

    if (!selectedHistory || selectedHistory.result_data || selectedHistory.status !== 'completed') return;

    setInlinePreviewLoading(true);
    try {
      const resultRes = await analysisApi.getResult(selectedHistory.id) as unknown as {
        data?: Partial<Analysis>;
      } & Partial<Analysis>;
      const fullData = resultRes?.data || resultRes;
      setInlinePreviewAnalysis({ ...selectedHistory, ...fullData });
    } catch (fetchError) {
      setInlinePreviewError(fetchError instanceof Error ? fetchError.message : '历史结果预览加载失败');
    } finally {
      setInlinePreviewLoading(false);
    }
  };

  const navigateToHistory = () => {
    const targetId = selectedHistory?.id || attachedResultSummary?.analysis_id;
    if (!targetId) return;
    window.dispatchEvent(
      new CustomEvent('companion-navigate', {
        detail: { path: `/app/history?analysis_id=${encodeURIComponent(targetId)}` },
      })
    );
  };

  return (
    <ContextPanelSection
      id="analysis-history"
      title="分析历史上下文"
      subtitle="用于后续解释和追问，不会自动重新运行分析"
      icon={<History className="w-4 h-4" />}
      defaultOpen={hasResultContext}
      badge={allHistoryCount}
      openStates={sectionOpenStates}
      onToggle={onToggleSection}
    >
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        分析历史上下文用于后续解释和追问，不会自动重新运行分析。
      </p>

      <div className="mt-3 space-y-2">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索历史分析"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
        />
        <select
          value={selectedHistory?.id ?? ''}
          onChange={(event) => {
            onClearAttachedResultSummary?.();
            onSelect?.(event.target.value || undefined);
          }}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-primary)]"
          disabled={loading || !onSelect}
        >
          <option value="">选择分析历史...</option>
          {historyItems.map((item) => {
            const itemDataset = datasets.find((dataset) => dataset.id === item.dataset_id);
            return (
              <option key={item.id} value={item.id}>
                {getAnalysisTypeLabel(item.type)} / {getDatasetLabel(itemDataset)} / {formatDate(item.created_at)}
              </option>
            );
          })}
        </select>
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          正在加载分析历史...
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      {!loading && !error && allHistoryCount === 0 && (
        <p className="mt-3 text-xs text-[var(--text-muted)] leading-relaxed">
          暂无分析历史上下文。后续你可以选择一次历史分析结果，让 AI 基于结果继续解释或生成下一步分析。
        </p>
      )}
      {!loading && !error && allHistoryCount > 0 && historyItems.length === 0 && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">未找到匹配的分析历史。</p>
      )}

      {hasResultContext && (
        <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 p-3">
          <div className="flex items-start gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)] mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-primary)]">当前分析历史</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                {contextTitle} / {datasetName || '未知数据集'} / {contextStatus}
              </p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                创建时间：{formatDate(contextCreatedAt)}
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                {resultSummary}
              </p>
              {contextRecommendationCount > 0 && (
                <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                  包含 {contextRecommendationCount} 条行动建议。
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleInlinePreview}
                  className="h-7 px-2 text-[10px]"
                >
                  {inlinePreviewOpen ? '收起原结果' : '查看原结果'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelect?.(undefined);
                    onClearAttachedResultSummary?.();
                  }}
                  className="h-7 px-2 text-[10px]"
                >
                  清除历史上下文
                </Button>
              </div>

              {inlinePreviewOpen && (
                <OriginalResultPreview
                  summary={safePreview}
                  loading={inlinePreviewLoading}
                  error={inlinePreviewError}
                  onOpenFullResult={navigateToHistory}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </ContextPanelSection>
  );
}

function OriginalResultPreview({
  summary,
  loading,
  error,
  onOpenFullResult,
}: {
  summary?: SafeResultSummary;
  loading: boolean;
  error: string | null;
  onOpenFullResult: () => void;
}) {
  const hasContent =
    Boolean(summary?.ai_summary || summary?.ai_interpretation) ||
    Boolean(summary?.result_keys.length) ||
    Boolean(summary?.metrics.length) ||
    Boolean(summary?.tables.length) ||
    Boolean(summary?.charts.length);

  return (
    <div className="mt-3 rounded-lg border border-[var(--neon-cyan)]/25 bg-[var(--bg-secondary)]/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)]">原结果预览</p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            这里只展示历史结果摘要，不会重新运行分析。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenFullResult} className="h-7 px-2 text-[10px]">
          去历史页查看完整结果
        </Button>
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          正在加载原结果摘要...
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {!loading && !error && !hasContent && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">该历史结果暂无可预览摘要。</p>
      )}

      {!loading && !error && hasContent && (
        <div className="mt-3 space-y-3">
          {(summary?.ai_summary || summary?.ai_interpretation) && (
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)]">摘要</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-5">
                {summary.ai_summary || summary.ai_interpretation}
              </p>
            </div>
          )}

          {summary?.result_keys.length ? (
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)]">结果字段</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {summary.result_keys.map((key) => (
                  <span
                    key={key}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {summary?.metrics.length ? (
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)]">关键指标</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {summary.metrics.map((metric) => (
                  <Metric key={metric.label} label={metric.label} value={String(metric.value)} />
                ))}
              </div>
            </div>
          ) : null}

          {summary?.tables[0] && (
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                表格预览：{summary.tables[0].title}（最多 5 行 / 共 {summary.tables[0].total_rows ?? summary.tables[0].rows.length} 行）
              </p>
              <div className="mt-1">
                <DataTablePreview
                  columns={summary.tables[0].columns}
                  data={summary.tables[0].rows}
                  maxRows={5}
                  maxHeight="160px"
                  emptyMessage="暂无可预览表格数据"
                />
              </div>
            </div>
          )}

          {summary?.charts.length ? (
            <div>
              <p className="text-[10px] font-medium text-[var(--text-muted)]">图表 / 配置摘要</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {summary.charts.map((chart) => (
                  <Metric
                    key={chart.title}
                    label={chart.title}
                    value={chart.chart_type || chart.description || 'chart'}
                  />
                ))}
              </div>
            </div>
          ) : null}
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
