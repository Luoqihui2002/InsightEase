import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Hash,
  Users,
  FlaskConical,
  Fingerprint,
  Clock,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assistantApi } from '@/api/assistant';
import type {
  DatasetProfile,
  ColumnProfile,
  ColumnRole,
  SemanticType,
  TableType,
} from '@/types/assistant';

interface DatasetUnderstandingCardProps {
  datasetId: string;
  datasetName?: string;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<ColumnRole, string> = {
  user_id: '用户ID',
  device_id: '设备ID',
  session_id: '会话ID',
  order_id: '订单ID',
  product_id: '商品ID',
  event_name: '事件名',
  timestamp: '时间戳',
  date: '日期',
  metric: '指标',
  dimension: '维度',
  category: '类别',
  treatment_group: '实验分组',
  label_target: '目标/标签',
  amount_revenue: '金额/收入',
  status: '状态',
  text_field: '文本',
  unknown: '未识别',
};

const SEMANTIC_LABELS: Record<SemanticType, string> = {
  numeric: '数值',
  categorical: '分类',
  datetime: '日期时间',
  boolean: '布尔',
  text: '文本',
  identifier: '标识',
  unknown: '未知',
};

const TABLE_TYPE_LABELS: Record<TableType, string> = {
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

function getConfidenceLabel(c: number): { label: string; color: string } {
  if (!Number.isFinite(c)) return { label: '未知置信度', color: 'text-[var(--text-muted)]' };
  if (c >= 0.8) return { label: '高置信度', color: 'text-[var(--neon-green)]' };
  if (c >= 0.5) return { label: '中置信度', color: 'text-[var(--neon-orange)]' };
  return { label: '低置信度', color: 'text-[var(--neon-pink)]' };
}

function formatNumber(value: unknown, fallback = '--'): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  return fallback;
}

function formatPercent(value: unknown, digits = 1, fallback = '--'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function getSafeColumns(profile: DatasetProfile): ColumnProfile[] {
  return Array.isArray(profile.columns) ? profile.columns : [];
}

function getSafeClassification(profile: DatasetProfile) {
  return profile.classification ?? {
    table_type: 'unknown' as TableType,
    confidence: 0,
    evidence: [],
    recommended_analyses: [],
    warnings: [],
  };
}

function getErrorMessage(error: unknown, fallback = '请求失败'): string {
  return error instanceof Error ? error.message : fallback;
}

function getRoleIcon(role: ColumnRole) {
  switch (role) {
    case 'user_id': return <Users className="w-3.5 h-3.5" />;
    case 'session_id': return <Fingerprint className="w-3.5 h-3.5" />;
    case 'timestamp':
    case 'date': return <Clock className="w-3.5 h-3.5" />;
    case 'metric':
    case 'amount_revenue': return <BarChart3 className="w-3.5 h-3.5" />;
    case 'category':
    case 'dimension':
    case 'status': return <Tag className="w-3.5 h-3.5" />;
    case 'text_field': return <FileText className="w-3.5 h-3.5" />;
    case 'treatment_group': return <FlaskConical className="w-3.5 h-3.5" />;
    default: return <Hash className="w-3.5 h-3.5" />;
  }
}

function getSemanticBadgeColor(st: SemanticType): string {
  switch (st) {
    case 'numeric': return 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]';
    case 'categorical': return 'bg-[var(--neon-purple)]/10 text-[var(--neon-purple)]';
    case 'datetime': return 'bg-[var(--neon-orange)]/10 text-[var(--neon-orange)]';
    case 'boolean': return 'bg-[var(--neon-green)]/10 text-[var(--neon-green)]';
    case 'text': return 'bg-[var(--neon-pink)]/10 text-[var(--neon-pink)]';
    case 'identifier': return 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]';
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
  }
}

function getRoleBadgeColor(role: ColumnRole): string {
  switch (role) {
    case 'user_id':
    case 'session_id':
    case 'device_id': return 'bg-blue-500/10 text-blue-400';
    case 'timestamp':
    case 'date': return 'bg-amber-500/10 text-amber-400';
    case 'metric':
    case 'amount_revenue': return 'bg-emerald-500/10 text-emerald-400';
    case 'text_field': return 'bg-pink-500/10 text-pink-400';
    case 'treatment_group': return 'bg-violet-500/10 text-violet-400';
    case 'event_name': return 'bg-cyan-500/10 text-cyan-400';
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatasetUnderstandingCard({ datasetId, datasetName }: DatasetUnderstandingCardProps) {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await assistantApi.profileDataset(datasetId);
      const payload = response.data;
      if (payload.code === 200 && payload.data) {
        setProfile(payload.data);
      } else {
        setError(payload.message || '获取数据集画像失败');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--neon-cyan)]" />
          <span className="text-sm text-[var(--text-muted)]">正在分析数据集结构...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-[var(--neon-pink)] mb-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">分析失败</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchProfile}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-muted)]">暂无数据集画像</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={fetchProfile}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重新分析
        </Button>
      </div>
    );
  }

  const columns = getSafeColumns(profile);
  const cls = getSafeClassification(profile);
  const conf = getConfidenceLabel(cls.confidence);

  // Role summary
  const roleCounts: Record<string, number> = {};
  columns.forEach((c) => {
    roleCounts[c.role] = (roleCounts[c.role] || 0) + 1;
  });

  // Field type summary
  const semanticCounts: Record<string, number> = {};
  columns.forEach((c) => {
    semanticCounts[c.semantic_type] = (semanticCounts[c.semantic_type] || 0) + 1;
  });

  // Group columns by role category
  const idColumns = columns.filter((c) => c.role.endsWith('_id'));
  const timeColumns = columns.filter((c) => c.role === 'timestamp' || c.role === 'date');
  const metricColumns = columns.filter((c) => c.role === 'metric' || c.role === 'amount_revenue');
  const textColumns = columns.filter((c) => c.role === 'text_field');
  const treatmentColumns = columns.filter((c) => c.role === 'treatment_group');
  const warningColumns = columns.filter((c) => (c.warnings?.length || 0) > 0);

  const displayColumns = showAllColumns ? columns : columns.slice(0, 20);

  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-[var(--neon-cyan)]" />
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">AI 数据理解</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {datasetName || profile.name || '未知数据集'} · {formatNumber(profile.row_count)} 行 · {formatNumber(profile.column_count)} 列
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${conf.color} bg-opacity-10`}>
            {TABLE_TYPE_LABELS[cls.table_type]} · {conf.label}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchProfile} title="重新分析">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Classification */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">表类型推断</h4>
          <div className="flex flex-wrap gap-2">
            {(cls.evidence ?? []).map((e, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
              >
                {e}
              </span>
            ))}
          </div>
          {cls.warnings && cls.warnings.length > 0 && (
            <div className="space-y-1">
              {cls.warnings.map((w, i) => (
                <p key={i} className="text-xs text-[var(--neon-orange)] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Recommended analyses */}
        {(cls.recommended_analyses ?? []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">推荐分析</h4>
            <div className="flex flex-wrap gap-2">
              {(cls.recommended_analyses ?? []).map((analysis) => (
                <span
                  key={analysis}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20"
                >
                  {analysis}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quality warnings */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">数据质量</h4>
          {(profile.quality_warnings ?? []).length > 0 ? (
            <div className="space-y-1.5">
              {(profile.quality_warnings ?? []).map((w, i) => (
                <p key={i} className="text-xs text-[var(--neon-orange)] flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--neon-green)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              暂无明显数据质量风险
            </p>
          )}
        </div>

        {/* Role & semantic summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">字段角色分布</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(roleCounts).map(([role, count]) => (
                <span
                  key={role}
                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getRoleBadgeColor(role as ColumnRole)}`}
                >
                  {getRoleIcon(role as ColumnRole)}
                  {ROLE_LABELS[role as ColumnRole]} {count}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">语义类型分布</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(semanticCounts).map(([st, count]) => (
                <span
                  key={st}
                  className={`text-xs px-2 py-0.5 rounded-full ${getSemanticBadgeColor(st as SemanticType)}`}
                >
                  {SEMANTIC_LABELS[st as SemanticType]} {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Key columns */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">关键字段</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {idColumns.length > 0 && (
              <KeyColumnGroup title="标识列" icon={<Fingerprint className="w-3.5 h-3.5" />} columns={idColumns} />
            )}
            {timeColumns.length > 0 && (
              <KeyColumnGroup title="时间列" icon={<Calendar className="w-3.5 h-3.5" />} columns={timeColumns} />
            )}
            {metricColumns.length > 0 && (
              <KeyColumnGroup title="指标列" icon={<BarChart3 className="w-3.5 h-3.5" />} columns={metricColumns} />
            )}
            {textColumns.length > 0 && (
              <KeyColumnGroup title="文本列" icon={<FileText className="w-3.5 h-3.5" />} columns={textColumns} />
            )}
            {treatmentColumns.length > 0 && (
              <KeyColumnGroup title="实验分组" icon={<FlaskConical className="w-3.5 h-3.5" />} columns={treatmentColumns} />
            )}
            {warningColumns.length > 0 && (
              <KeyColumnGroup title="警告列" icon={<AlertTriangle className="w-3.5 h-3.5" />} columns={warningColumns} warning />
            )}
          </div>
        </div>

        {/* Column profile table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">字段详情</h4>
            {columns.length > 20 && (
              <button
                onClick={() => setShowAllColumns((s) => !s)}
                className="text-xs text-[var(--neon-cyan)] flex items-center gap-1 hover:underline"
              >
                {showAllColumns ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> 收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> 展开全部 ({columns.length} 个)
                  </>
                )}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-2 text-xs text-[var(--text-muted)] font-medium">字段名</th>
                  <th className="text-left py-2 px-2 text-xs text-[var(--text-muted)] font-medium">角色</th>
                  <th className="text-left py-2 px-2 text-xs text-[var(--text-muted)] font-medium">类型</th>
                  <th className="text-right py-2 px-2 text-xs text-[var(--text-muted)] font-medium">缺失率</th>
                  <th className="text-right py-2 px-2 text-xs text-[var(--text-muted)] font-medium">唯一值</th>
                  <th className="text-left py-2 px-2 text-xs text-[var(--text-muted)] font-medium">示例</th>
                  <th className="text-left py-2 px-2 text-xs text-[var(--text-muted)] font-medium">警告</th>
                </tr>
              </thead>
              <tbody>
                {displayColumns.map((col) => (
                  <tr
                    key={col.name}
                    className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="py-2 px-2 text-[var(--text-primary)] font-medium">{col.name}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${getRoleBadgeColor(col.role)}`}
                      >
                        {getRoleIcon(col.role)}
                        {ROLE_LABELS[col.role]}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getSemanticBadgeColor(col.semantic_type)}`}>
                        {SEMANTIC_LABELS[col.semantic_type]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={typeof col.null_rate === 'number' && col.null_rate > 0.5 ? 'text-[var(--neon-pink)]' : 'text-[var(--text-secondary)]'}>
                        {formatPercent(col.null_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-secondary)]">
                      {formatNumber(col.unique_count)}
                    </td>
                    <td className="py-2 px-2 text-[var(--text-muted)] text-xs max-w-[180px] truncate">
                      {(Array.isArray(col.examples) ? col.examples : []).slice(0, 3).map(String).join(', ') || '暂无'}
                    </td>
                    <td className="py-2 px-2">
                      {col.warnings && col.warnings.length > 0 ? (
                        <span className="text-xs text-[var(--neon-orange)]" title={col.warnings.join('; ')}>
                          {col.warnings.length} 项
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAllColumns && columns.length > 20 && (
            <p className="text-xs text-[var(--text-muted)]">
              仅展示前 20 个字段，共 {columns.length} 个字段
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KeyColumnGroup({
  title,
  icon,
  columns,
  warning,
}: {
  title: string;
  icon: React.ReactNode;
  columns: ColumnProfile[];
  warning?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <div className={`flex items-center gap-1.5 mb-2 text-xs font-medium ${warning ? 'text-[var(--neon-orange)]' : 'text-[var(--text-muted)]'}`}>
        {icon}
        {title}
      </div>
      <div className="space-y-1">
        {columns.slice(0, 5).map((col) => (
          <div key={col.name} className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-primary)] truncate">{col.name}</span>
            <span className="text-[var(--text-muted)] shrink-0 ml-2">
              {formatPercent(col.null_rate, 0)} 缺失
            </span>
          </div>
        ))}
        {columns.length > 5 && (
          <p className="text-xs text-[var(--text-muted)]">+{columns.length - 5} 个</p>
        )}
      </div>
    </div>
  );
}
