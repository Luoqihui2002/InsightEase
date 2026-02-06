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
  AlertCircle,
  X,
  FileJson,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import { quickRequest } from '@/lib/request';
import type { Analysis, Dataset } from '@/types/api';
import gsap from 'gsap';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
  
  // 详情弹窗状态
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  // 加载真实数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 5秒超时保护
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
  
  // 重试加载
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

  // 打开详情弹窗并加载完整数据
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
      // 获取完整结果数据
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

  // 切换章节展开
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

  // 导出报告
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

  // 下载 JSON
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

  // 下载 CSV（简化版，导出主要数据表）
  const downloadCsv = (analysis: Analysis, filename: string) => {
    const result = analysis.result_data;
    if (!result || typeof result !== 'object') {
      toast.error('数据格式不支持 CSV 导出');
      return;
    }

    // 尝试提取表格数据
    let rows: any[] = [];
    let columns: string[] = [];
    
    // 根据不同分析类型提取数据
    if (Array.isArray(result)) {
      rows = result;
      columns = result.length > 0 ? Object.keys(result[0]) : [];
    } else if (result.data && Array.isArray(result.data)) {
      rows = result.data;
      columns = result.columns || (rows.length > 0 ? Object.keys(rows[0]) : []);
    } else if (result.clusters) {
      // 聚类分析
      columns = ['cluster_id', 'size', ...Object.keys(result.clusters[0] || {})];
      rows = result.clusters;
    } else if (result.statistics) {
      // 统计分析 - 转换为行
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
        // 处理包含逗号或换行符的值
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  };

  // 下载 Excel
  const downloadExcel = (analysis: Analysis, filename: string) => {
    const result = analysis.result_data;
    const wb = XLSX.utils.book_new();
    
    // 工作表1：结果数据
    let dataSheet: any[][] = [];
    if (Array.isArray(result)) {
      dataSheet = result;
    } else if (result.data && Array.isArray(result.data)) {
      dataSheet = result.data;
    } else {
      // 将对象转换为表格
      dataSheet = Object.entries(result).map(([k, v]) => ({ key: k, value: JSON.stringify(v) }));
    }
    
    const ws1 = XLSX.utils.json_to_sheet(dataSheet);
    XLSX.utils.book_append_sheet(wb, ws1, '分析结果');
    
    // 工作表2：AI解读
    if (analysis.ai_interpretation) {
      const ws2 = XLSX.utils.aoa_to_sheet([['AI 解读'], [''], [analysis.ai_interpretation]]);
      XLSX.utils.book_append_sheet(wb, ws2, 'AI解读');
    }
    
    // 工作表3：建议
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

  // 下载 Markdown 报告
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
    md += `\`\`\`json\n${JSON.stringify(analysis.result_data, null, 2)}\n\`\`\`\n`;
    
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

  // 渲染结果预览
  const renderResultPreview = (result: any) => {
    if (!result) return <p className="text-[var(--text-muted)]">暂无数据</p>;
    
    // 数组数据表格展示
    if (Array.isArray(result) && result.length > 0) {
      const columns = Object.keys(result[0]).slice(0, 5); // 最多显示5列
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {columns.map(col => (
                  <th key={col} className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-b border-[var(--border-subtle)]/50">
                  {columns.map(col => (
                    <td key={col} className="py-2 px-2 text-[var(--text-primary)]">
                      {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col]).slice(0, 50)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.length > 10 && (
            <p className="text-xs text-[var(--text-muted)] mt-2 text-center">...还有 {result.length - 10} 行数据</p>
          )}
        </div>
      );
    }
    
    // 对象数据 JSON 展示
    return (
      <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-3 rounded-lg overflow-auto max-h-60">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--neon-cyan)]" />
        <p className="text-[var(--text-secondary)]">正在加载分析历史...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--neon-pink)] gap-4">
        <AlertCircle className="w-12 h-12" />
        <p>{error}</p>
        <Button onClick={handleRetry} variant="outline" className="border-[var(--neon-pink)] text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/10">
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-heading-1 text-[var(--text-primary)]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          History
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">
          查看所有分析任务的历史记录
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass border-[var(--border-subtle)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">总任务数</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mono">{analyses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-[var(--border-subtle)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">已完成</p>
                <p className="text-xl font-bold text-[var(--neon-green)] mono">
                  {analyses.filter(h => h.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-[var(--border-subtle)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">进行中</p>
                <p className="text-xl font-bold text-[var(--neon-cyan)] mono">
                  {analyses.filter(h => h.status === 'running' || h.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-[var(--border-subtle)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-pink)]/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[var(--neon-pink)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">失败</p>
                <p className="text-xl font-bold text-[var(--neon-pink)] mono">
                  {analyses.filter(h => h.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 历史记录列表 */}
      <div ref={tableRef}>
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)]">
              分析记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>暂无分析记录</p>
                <p className="text-sm mt-2">创建你的第一个分析任务</p>
              </div>
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
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {item.status === 'completed' && (
                                <div className="relative group">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 text-[var(--text-muted)] hover:text-[var(--neon-cyan)]"
                                    title="下载报告"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  {/* 下载格式选择菜单 */}
                                  <div className="absolute right-0 top-full mt-2 py-2 w-40 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                    <button
                                      onClick={() => handleDownload(item, 'excel')}
                                      className="w-full px-4 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <FileSpreadsheet className="w-4 h-4 text-[var(--neon-green)]" />
                                      Excel (.xlsx)
                                    </button>
                                    <button
                                      onClick={() => handleDownload(item, 'csv')}
                                      className="w-full px-4 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <FileText className="w-4 h-4 text-[var(--neon-cyan)]" />
                                      CSV (.csv)
                                    </button>
                                    <button
                                      onClick={() => handleDownload(item, 'json')}
                                      className="w-full px-4 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <FileJson className="w-4 h-4 text-[var(--neon-purple)]" />
                                      JSON (.json)
                                    </button>
                                    <button
                                      onClick={() => handleDownload(item, 'markdown')}
                                      className="w-full px-4 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                                      Markdown (.md)
                                    </button>
                                  </div>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-[var(--text-muted)] hover:text-[var(--neon-pink)]"
                                onClick={() => handleDelete(item.id)}
                                title="删除"
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
          </CardContent>
        </Card>
      </div>

      {/* 详情弹窗 */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col">
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
          </div>
        </div>
      )}
    </div>
  );
}
