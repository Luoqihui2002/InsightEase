import { useRef, useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  BarChart3,
  Users,
  Filter,
  TrendingUp,
  MessageSquare,
  Download,
  Eye,
  Brain,
  Wand2,
  Trash2,
  X,
  FileJson,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { analysisApi } from '@/api/analysis';
import {
  DEFAULT_RESULT_FOLLOWUP_PROMPTS,
  dispatchAIWorkbenchHandoff,
} from '@/lib/assistant/aiWorkbenchHandoff';
import { buildSafeResultSummary } from '@/lib/assistant/safeResultSummary';
import { quickRequest } from '@/lib/request';
import type { Analysis, Dataset } from '@/types/api';
import gsap from 'gsap';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { ContentGrid } from '@/components/layout/ContentGrid';
import { StatCard } from '@/components/data-display/StatCard';
import { DataTablePreview } from '@/components/data-display/DataTablePreview';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';

const typeIcons: Record<string, typeof BarChart3> = {
  descriptive: BarChart3,
  correlation: MessageSquare,
  clustering: Users,
  forecast: TrendingUp,
  attribution: Filter,
  visualization: Eye,
  comprehensive: Brain,
  smart_process: Wand2,
  statistics: BarChart3,
  time_series: TrendingUp,
  rfm: Users,
  funnel: Filter,
};

const typeLabels: Record<string, string> = {
  descriptive: '描述统计',
  correlation: '相关分析',
  clustering: '聚类分析',
  forecast: '时序预测',
  attribution: '归因分析',
  visualization: '可视化',
  comprehensive: '综合分析',
  smart_process: '智能处理',
  statistics: '统计分析',
  time_series: '时间序列',
  rfm: 'RFM分析',
  funnel: '漏斗分析',
};

export function History() {
  const tableRef = useRef<HTMLDivElement>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [datasets, setDatasets] = useState<Record<string, Dataset>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('请求超时，请检查网络连接后重试')), 5000);
        });

        const [analysesRes, datasetsRes] = await Promise.race([
          Promise.all([
            quickRequest.get('/analyses', { params: { page: 1, page_size: 20 } }),
            quickRequest.get('/datasets', { params: { page: 1, page_size: 20 } })
          ]),
          timeoutPromise
        ]) as [any, any];

        const analysesData = analysesRes as any;
        const datasetsData = datasetsRes as any;

        const analysesItems = analysesData.items || analysesData.data?.items || [];
        const datasetsItems = datasetsData.items || datasetsData.data?.items || [];

        setAnalyses(analysesItems);

        const datasetMap: Record<string, Dataset> = {};
        datasetsItems.forEach((d: Dataset) => {
          datasetMap[d.id] = d;
        });
        setDatasets(datasetMap);
      } catch (err: any) {
        setError(err.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (loading) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        tableRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      );
    });

    return () => ctx.revert();
  }, [loading]);

  const getStatusIcon = (status: Analysis['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-[var(--neon-pink)]" />;
      case 'running':
      case 'pending':
        return <Loader2 className="w-5 h-5 text-[var(--neon-cyan)] animate-spin" />;
    }
  };

  const getStatusText = (status: Analysis['status']) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'running':
        return '进行中';
      case 'pending':
        return '等待中';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await analysisApi.delete(id);
      setAnalyses(analyses.filter(a => a.id !== id));
      toast.success('分析记录已删除');
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleViewResult = async (analysis: Analysis) => {
    if (analysis.status !== 'completed') {
      if (analysis.status === 'failed') {
        toast.error(analysis.error_msg || '分析失败');
      } else {
        toast.info('分析尚未完成');
      }
      return;
    }

    setSelectedAnalysis(analysis);
    setDetailLoading(true);

    try {
      const resultRes = await analysisApi.getResult(analysis.id) as any;
      const fullData = resultRes?.data || resultRes;

      if (fullData) {
        setSelectedAnalysis({ ...analysis, ...fullData });
      }
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;

    const analysisId = new URLSearchParams(window.location.search).get('analysis_id');
    if (!analysisId || selectedAnalysis?.id === analysisId) return;

    const matchedAnalysis = analyses.find((analysis) => analysis.id === analysisId);
    if (matchedAnalysis) {
      void handleViewResult(matchedAnalysis);
    }
  }, [analyses, loading, selectedAnalysis?.id]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleDownload = (analysis: Analysis, format: 'json' | 'csv' | 'excel' | 'markdown') => {
    if (!analysis.result_data) {
      toast.error('没有可导出的数据');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const typeName = typeLabels[analysis.type] || analysis.type;
    const baseFilename = `${typeName}_${timestamp}`;

    try {
      switch (format) {
        case 'json':
          downloadJson(analysis, baseFilename);
          break;
        case 'csv':
          downloadCsv(analysis, baseFilename);
          break;
        case 'excel':
          downloadExcel(analysis, baseFilename);
          break;
        case 'markdown':
          downloadMarkdown(analysis, baseFilename);
          break;
      }
      toast.success(`已导出 ${format.toUpperCase()} 格式`);
    } catch (err) {
      toast.error('导出失败');
    }
  };

  const downloadJson = (analysis: Analysis, filename: string) => {
    const data = {
      analysis_info: {
        id: analysis.id,
        type: analysis.type,
        type_name: typeLabels[analysis.type] || analysis.type,
        dataset_id: analysis.dataset_id,
        created_at: analysis.created_at,
        completed_at: analysis.completed_at,
        params: analysis.params,
      },
      result: analysis.result_data,
      ai_interpretation: analysis.ai_interpretation,
      ai_recommendations: analysis.ai_recommendations,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
  };

  const downloadCsv = (analysis: Analysis, filename: string) => {
    const result = analysis.result_data;
    if (!result || typeof result !== 'object') {
      toast.error('数据格式不支持 CSV 导出');
      return;
    }

    let rows: any[] = [];
    let columns: string[] = [];

    if (Array.isArray(result)) {
      rows = result;
      columns = result.length > 0 ? Object.keys(result[0]) : [];
    } else if (result.data && Array.isArray(result.data)) {
      rows = result.data;
      columns = result.columns || (rows.length > 0 ? Object.keys(rows[0]) : []);
    } else if (result.clusters) {
      columns = ['cluster_id', 'size', ...Object.keys(result.clusters[0] || {})];
      rows = result.clusters;
    } else if (result.statistics) {
      const stats = result.statistics;
      columns = ['metric', 'value'];
      rows = Object.entries(stats).map(([k, v]) => ({ metric: k, value: v }));
    }

    if (rows.length === 0) {
      toast.error('没有找到可导出的表格数据');
      return;
    }

    const csv = [
      columns.join(','),
      ...rows.map(row => columns.map(col => {
        const val = row[col];
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  };

  const downloadExcel = (analysis: Analysis, filename: string) => {
    const result = analysis.result_data;
    const wb = XLSX.utils.book_new();

    let dataSheet: any[][] = [];
    if (Array.isArray(result)) {
      dataSheet = result;
    } else if (result.data && Array.isArray(result.data)) {
      dataSheet = result.data;
    } else {
      dataSheet = Object.entries(result).map(([k, v]) => [k, JSON.stringify(v)]);
    }

    const ws1 = XLSX.utils.json_to_sheet(dataSheet);
    XLSX.utils.book_append_sheet(wb, ws1, '分析结果');

    if (analysis.ai_interpretation) {
      const ws2 = XLSX.utils.aoa_to_sheet([['AI 解读'], [''], [analysis.ai_interpretation]]);
      XLSX.utils.book_append_sheet(wb, ws2, 'AI解读');
    }

    if (analysis.ai_recommendations && analysis.ai_recommendations.length > 0) {
      const ws3 = XLSX.utils.aoa_to_sheet([
        ['AI 建议'],
        [''],
        ...analysis.ai_recommendations.map((r, i) => [`${i + 1}. ${r}`])
      ]);
      XLSX.utils.book_append_sheet(wb, ws3, '建议');
    }

    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const downloadMarkdown = (analysis: Analysis, filename: string) => {
    const typeName = typeLabels[analysis.type] || analysis.type;
    const datasetName = datasets[analysis.dataset_id]?.filename || '未知数据集';

    let md = `# ${typeName}分析报告\n\n`;
    md += `**分析ID**: ${analysis.id}  \n`;
    md += `**数据集**: ${datasetName}  \n`;
    md += `**创建时间**: ${new Date(analysis.created_at).toLocaleString('zh-CN')}  \n`;
    md += `**完成时间**: ${analysis.completed_at ? new Date(analysis.completed_at).toLocaleString('zh-CN') : '-'}  \n\n`;

    md += `---\n\n`;

    if (analysis.ai_interpretation) {
      md += `## AI 解读\n\n${analysis.ai_interpretation}\n\n`;
    }

    if (analysis.ai_recommendations && analysis.ai_recommendations.length > 0) {
      md += `## 建议\n\n`;
      analysis.ai_recommendations.forEach((rec, i) => {
        md += `${i + 1}. ${rec}\n`;
      });
      md += `\n`;
    }

    md += `## 详细结果\n\n`;
    md += `\`\`\`json\n${JSON.stringify(analysis.result_data, null, 2)}\n\`\`\``;

    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `${filename}.md`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderResultPreview = (result: any) => {
    if (!result) return <p className="text-[var(--text-muted)]">暂无数据</p>;

    if (Array.isArray(result) && result.length > 0) {
      const columns = Object.keys(result[0]).slice(0, 5);
      const previewData = result.slice(0, 10).map((row: any) => {
        const processed: Record<string, unknown> = {};
        columns.forEach((col) => {
          processed[col] = typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col]).slice(0, 50);
        });
        return processed;
      });
      return (
        <div className="space-y-2">
          <DataTablePreview
            columns={columns}
            data={previewData}
            maxRows={10}
            maxHeight="300px"
          />
          {result.length > 10 && (
            <p className="text-xs text-[var(--text-muted)] text-center">...还有 {result.length - 10} 行数据</p>
          )}
        </div>
      );
    }

    return (
      <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-3 rounded-lg overflow-auto max-h-60">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  const renderSafeResultSummary = (analysis: Analysis) => {
    const summary = buildSafeResultSummary(analysis, {
      dataset_name: datasets[analysis.dataset_id]?.filename,
    });
    const firstTable = summary.tables[0];

    return (
      <div className="rounded-lg border border-[var(--neon-cyan)]/25 bg-[var(--bg-tertiary)]/40 p-4 space-y-3">
        <div>
          <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)]" />
            安全结果摘要
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            这里只展示摘要、关键指标和少量预览行；完整结果请使用下方详细结果或导出功能。
          </p>
        </div>

        {(summary.ai_summary || summary.ai_interpretation) && (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-4">
            {summary.ai_summary || summary.ai_interpretation}
          </p>
        )}

        {summary.result_keys.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.result_keys.map((key) => (
              <span
                key={key}
                className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {key}
              </span>
            ))}
          </div>
        )}

        {summary.metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {summary.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2">
                <p className="text-[10px] text-[var(--text-muted)] truncate">{metric.label}</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)] truncate">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {firstTable && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">
              表格预览：{firstTable.title}（最多 5 行 / 共 {firstTable.total_rows ?? firstTable.rows.length} 行）
            </p>
            <DataTablePreview
              columns={firstTable.columns}
              data={firstTable.rows}
              maxRows={5}
              maxHeight="220px"
            />
          </div>
        )}
      </div>
    );
  };

  const handleSendToAIWorkbench = (analysis: Analysis) => {
    const safeSummary = buildSafeResultSummary(analysis, {
      dataset_name: datasets[analysis.dataset_id]?.filename,
    });

    dispatchAIWorkbenchHandoff({
      source: 'history',
      analysis_id: analysis.id,
      safe_result_summary: safeSummary,
      suggested_prompts: DEFAULT_RESULT_FOLLOWUP_PROMPTS,
      created_at: new Date().toISOString(),
    });
    toast.success('已将结果加入 AI 工作台上下文，不会自动生成解释');
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingState message="正在加载分析历史..." />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <ErrorState title="加载失败" message={error} onRetry={handleRetry} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="历史记录"
        subtitle="查看历史分析任务、结果摘要和导出记录。"
      />

      {/* 统计卡片 */}
      <ContentGrid cols={4}>
        <StatCard
          label="总任务数"
          value={analyses.length}
          icon={<Clock className="w-5 h-5 text-[var(--neon-cyan)]" />}
        />
        <StatCard
          label="已完成"
          value={analyses.filter(h => h.status === 'completed').length}
          valueClassName="text-[var(--neon-green)]"
          icon={<CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />}
        />
        <StatCard
          label="进行中"
          value={analyses.filter(h => h.status === 'running' || h.status === 'pending').length}
          valueClassName="text-[var(--neon-cyan)]"
          icon={<Loader2 className="w-5 h-5 text-[var(--neon-cyan)]" />}
        />
        <StatCard
          label="失败"
          value={analyses.filter(h => h.status === 'failed').length}
          valueClassName="text-[var(--neon-pink)]"
          icon={<XCircle className="w-5 h-5 text-[var(--neon-pink)]" />}
        />
      </ContentGrid>

      {/* 历史记录列表 */}
      <div ref={tableRef}>
        <SectionCard title="分析记录">
          {analyses.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia>
                  <BarChart3 className="w-16 h-16 text-[var(--text-muted)] opacity-30" />
                </EmptyMedia>
                <EmptyTitle>暂无分析记录</EmptyTitle>
                <EmptyDescription>创建你的第一个分析任务</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">分析类型</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">数据集</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">创建时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">状态</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[var(--text-muted)]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((item) => {
                    const TypeIcon = typeIcons[item.type] || BarChart3;
                    const dataset = datasets[item.dataset_id];

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="w-4 h-4 text-[var(--neon-cyan)]" />
                            <span className="text-[var(--text-primary)]">
                              {typeLabels[item.type] || item.type}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          {dataset?.filename || '未知数据集'}
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className={`
                              text-sm
                              ${item.status === 'completed' ? 'text-[var(--neon-green)]' : ''}
                              ${item.status === 'failed' ? 'text-[var(--neon-pink)]' : ''}
                              ${item.status === 'running' || item.status === 'pending' ? 'text-[var(--neon-cyan)]' : ''}
                            `}>
                              {getStatusText(item.status)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 text-[var(--text-muted)] hover:text-[var(--neon-cyan)]"
                              onClick={() => handleViewResult(item)}
                              title="查看结果"
                              aria-label="查看结果"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {item.status === 'completed' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 text-[var(--text-muted)] hover:text-[var(--neon-cyan)]"
                                    title="下载报告"
                                    aria-label="下载报告"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDownload(item, 'excel')}>
                                    <FileSpreadsheet className="w-4 h-4 text-[var(--neon-green)] mr-2" />
                                    Excel (.xlsx)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(item, 'csv')}>
                                    <FileText className="w-4 h-4 text-[var(--neon-cyan)] mr-2" />
                                    CSV (.csv)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(item, 'json')}>
                                    <FileJson className="w-4 h-4 text-[var(--neon-purple)] mr-2" />
                                    JSON (.json)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(item, 'markdown')}>
                                    <FileText className="w-4 h-4 text-[var(--text-secondary)] mr-2" />
                                    Markdown (.md)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              variant="destructive"
                              size="icon"
                              className="w-8 h-8"
                              onClick={() => handleDelete(item.id)}
                              title="删除"
                              aria-label="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 详情弹窗 */}
      {selectedAnalysis && (
      <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedAnalysis(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden" showCloseButton={false}>
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                {(() => {
                  const Icon = typeIcons[selectedAnalysis.type] || BarChart3;
                  return <Icon className="w-5 h-5 text-[var(--neon-cyan)]" />;
                })()}
                {typeLabels[selectedAnalysis.type] || selectedAnalysis.type} - 分析详情
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                数据集: {datasets[selectedAnalysis.dataset_id]?.filename || '未知'} ·
                创建时间: {new Date(selectedAnalysis.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 导出按钮组 */}
              <div className="flex items-center gap-1 mr-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendToAIWorkbench(selectedAnalysis)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--neon-cyan)]"
                  title="不会自动生成解释，打开 AI 工作台后你可以继续提问。"
                >
                  <Brain className="w-4 h-4 mr-1" />
                  让 AI 解读这个结果
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(selectedAnalysis, 'excel')}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--neon-green)]"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(selectedAnalysis, 'csv')}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--neon-cyan)]"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(selectedAnalysis, 'markdown')}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  报告
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedAnalysis(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* 弹窗内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--neon-cyan)]" />
              </div>
            ) : (
              <>
                {/* AI 解读 */}
                {selectedAnalysis.ai_interpretation && (
                  <div className="rounded-lg border border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/5 overflow-hidden">
                    <button
                      onClick={() => toggleSection('interpretation')}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <h3 className="font-bold text-[var(--neon-cyan)] flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        AI 智能解读
                      </h3>
                      {expandedSections.has('interpretation') ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    {expandedSections.has('interpretation') && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                          {selectedAnalysis.ai_interpretation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 建议 */}
                {selectedAnalysis.ai_recommendations && selectedAnalysis.ai_recommendations.length > 0 && (
                  <div className="rounded-lg border border-[var(--neon-purple)]/30 bg-[var(--neon-purple)]/5 overflow-hidden">
                    <button
                      onClick={() => toggleSection('recommendations')}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <h3 className="font-bold text-[var(--neon-purple)] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        行动建议 ({selectedAnalysis.ai_recommendations.length} 条)
                      </h3>
                      {expandedSections.has('recommendations') ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    {expandedSections.has('recommendations') && (
                      <div className="px-4 pb-4">
                        <ul className="space-y-2">
                          {selectedAnalysis.ai_recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 分析结果 */}
                {renderSafeResultSummary(selectedAnalysis)}

                <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                  <button
                    onClick={() => toggleSection('result')}
                    className="w-full flex items-center justify-between p-4 text-left bg-[var(--bg-tertiary)]"
                  >
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)]" />
                      详细结果数据
                    </h3>
                    {expandedSections.has('result') ? (
                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </button>
                  {expandedSections.has('result') && (
                    <div className="p-4">
                      {renderResultPreview(selectedAnalysis.result_data)}
                    </div>
                  )}
                </div>

                {/* 参数信息 */}
                <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                  <button
                    onClick={() => toggleSection('params')}
                    className="w-full flex items-center justify-between p-4 text-left bg-[var(--bg-tertiary)]"
                  >
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                      分析参数
                    </h3>
                    {expandedSections.has('params') ? (
                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </button>
                  {expandedSections.has('params') && (
                    <div className="p-4">
                      <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 rounded-lg overflow-auto">
                        {JSON.stringify(selectedAnalysis.params, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      )}
    </PageShell>
  );
}
