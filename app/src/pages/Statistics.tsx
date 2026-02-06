import { useState, useRef, useEffect } from 'react';
import { 
  BarChart3, 
  Play, 
  Settings2, 
  Download,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
import { DataTypeValidation } from '@/components/DataTypeValidation';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import gsap from 'gsap';

interface ColumnInfo {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
}

export function Statistics() {
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setColumns([]);
      setSelectedColumn('all');
      return;
    }

    const loadDatasetInfo = async () => {
      // 切换数据集时清空列信息，避免显示旧数据集的验证结果
      setColumns([]);
      setSelectedColumn('all');
      
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data || res);
        
        // 解析 schema 信息
        const schema = res.schema || res.data?.schema;
        console.log('Statistics schema:', schema);
        
        if (schema && Array.isArray(schema) && schema.length > 0) {
          const cols: ColumnInfo[] = schema.map((field: any) => {
            const dtype = (field.dtype || field.type || field.data_type || 'unknown')?.toLowerCase() || '';
            let type: ColumnInfo['type'] = 'other';
            if (dtype.includes('int') || dtype.includes('float') || dtype.includes('number') || dtype.includes('double')) {
              type = 'numeric';
            } else if (dtype.includes('date') || dtype.includes('time') || dtype.includes('timestamp')) {
              type = 'datetime';
            } else if (dtype.includes('str') || dtype.includes('cat') || dtype.includes('object') || dtype.includes('text')) {
              type = 'categorical';
            }
            return {
              name: field.name || field.column || field.column_name || 'unknown',
              dtype: field.dtype || field.type || field.data_type || 'unknown',
              type
            };
          });
          setColumns(cols);
        }
      } catch (err) {
        console.error('Failed to load dataset info:', err);
      }
    };

    loadDatasetInfo();
  }, [selectedDataset]);

  useEffect(() => {
    if (showResult && resultRef.current) {
      gsap.fromTo(
        resultRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, [showResult]);

  const handleAnalyze = async () => {
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }

    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);

    try {
      const params: any = {};
      if (selectedColumn !== 'all') {
        params.column = selectedColumn;
      }

      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'descriptive',
        params
      }) as any;

      if ((res.code === 202 || res.code === 200) && res.data?.id) {
        await pollResult(res.data.id);
      } else {
        throw new Error(res.message || '分析启动失败');
      }
    } catch (err: any) {
      toast.error(err.message || '分析失败');
      setIsAnalyzing(false);
    }
  };

  const pollResult = async (analysisId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const checkResult = async () => {
      try {
        attempts++;
        const res = await analysisApi.getResult(analysisId) as any;
        
        if (res.data?.status === 'completed') {
          setAnalysisResult(res.data?.result_data);
          setShowResult(true);
          setIsAnalyzing(false);
          toast.success('分析完成');
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data?.error_msg || '分析失败');
        }

        if (attempts < maxAttempts) {
          setTimeout(checkResult, 1000);
        } else {
          throw new Error('分析超时');
        }
      } catch (err: any) {
        toast.error(err.message);
        setIsAnalyzing(false);
      }
    };

    setTimeout(checkResult, 1000);
  };

  // 渲染统计结果
  const renderStatsResult = () => {
    if (!analysisResult?.column_stats) return null;

    const targetColumns = selectedColumn === 'all' 
      ? analysisResult.column_stats 
      : analysisResult.column_stats.filter((c: any) => c.name === selectedColumn);

    return (
      <div className="space-y-6">
        {targetColumns.map((col: any) => (
          <Card key={col.name} className="glass border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--text-primary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)]" />
                {col.name} 
                <span className="text-xs text-[var(--text-muted)] font-normal">
                  ({col.dtype})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded bg-[var(--bg-secondary)]">
                  <p className="text-xs text-[var(--text-muted)]">非空值</p>
                  <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.non_null_count}</p>
                </div>
                <div className="p-3 rounded bg-[var(--bg-secondary)]">
                  <p className="text-xs text-[var(--text-muted)]">空值</p>
                  <p className="text-lg font-bold text-[var(--neon-pink)]">{col.null_count}</p>
                </div>
                <div className="p-3 rounded bg-[var(--bg-secondary)]">
                  <p className="text-xs text-[var(--text-muted)]">空值占比</p>
                  <p className="text-lg font-bold text-[var(--neon-orange)]">{col.null_percentage}%</p>
                </div>
                {col.type === 'numeric' ? (
                  <>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">平均值</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.mean?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">中位数</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.median?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">标准差</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.std?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">最小值</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.min?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">最大值</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.max?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">Q1 (25%)</p>
                      <p className="text-lg font-bold text-[var(--neon-purple)]">{col.q1?.toFixed(2) || '-'}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">Q3 (75%)</p>
                      <p className="text-lg font-bold text-[var(--neon-purple)]">{col.q3?.toFixed(2) || '-'}</p>
                    </div>
                  </>
                ) : col.type === 'categorical' ? (
                  <>
                    <div className="p-3 rounded bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">唯一值</p>
                      <p className="text-lg font-bold text-[var(--neon-cyan)]">{col.unique_count}</p>
                    </div>
                    <div className="p-3 rounded bg-[var(--bg-secondary)] col-span-2">
                      <p className="text-xs text-[var(--text-muted)]">最常见</p>
                      <p className="text-sm font-bold text-[var(--neon-cyan)] truncate">{col.most_common || '-'}</p>
                    </div>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          统计分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          对数据进行描述性统计分析，了解数据分布特征
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 配置面板 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                分析配置
              </div>
              {isConfigOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          
          {isConfigOpen && (
            <CardContent className="space-y-4">
              {/* 数据集选择 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">选择数据集</label>
                <DatasetSelector 
                  value={selectedDataset}
                  onChange={setSelectedDataset}
                />
                {datasetInfo && (
                  <p className="text-xs text-[var(--neon-cyan)]">
                    {datasetInfo.row_count?.toLocaleString()} 行 · {datasetInfo.col_count} 列
                  </p>
                )}
              </div>

              {/* 数据类型验证提示 */}
              {columns.length > 0 && (
                <DataTypeValidation 
                  columns={columns} 
                  analysisType="statistics" 
                />
              )}

              {/* 列选择 */}
              {columns.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm text-[var(--text-muted)]">选择分析列</label>
                  <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="all">全部分析 (所有列)</option>
                    <optgroup label="数值型列">
                      {columns.filter(c => c.type === 'numeric').map(col => (
                        <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                      ))}
                    </optgroup>
                    <optgroup label="分类型列">
                      {columns.filter(c => c.type === 'categorical').map(col => (
                        <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                      ))}
                    </optgroup>
                    <optgroup label="其他列">
                      {columns.filter(c => c.type !== 'numeric' && c.type !== 'categorical').map(col => (
                        <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* 分析按钮 */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedDataset}
                className="w-full font-medium py-2 px-4 rounded transition-all flex items-center justify-center"
                style={{
                  backgroundColor: selectedDataset ? 'var(--neon-cyan)' : 'var(--bg-tertiary)',
                  color: selectedDataset ? 'var(--bg-primary)' : 'var(--text-muted)',
                  cursor: selectedDataset ? 'pointer' : 'not-allowed',
                  border: 'none',
                  opacity: selectedDataset ? 1 : 0.5
                }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    启动分析
                  </>
                )}
              </button>

              {isAnalyzing && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  正在分析数据，请稍候...
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* 结果展示 */}
        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">选择数据集和列并启动分析</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">分析结果将在此显示</p>
              </div>
            </Card>
          ) : (
            <div ref={resultRef} className="space-y-6">
              {/* 统计结果 */}
              {renderStatsResult()}

              {/* AI 解读 */}
              {analysisResult?.ai_summary && (
                <Card className="glass border-[var(--neon-cyan)]/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[var(--neon-cyan)]" />
                      AI 智能解读
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--neon-purple)]/10 to-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                        {analysisResult.ai_summary}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className="flex-1 border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10"
                  onClick={() => {
                    if (!analysisResult?.column_stats) {
                      toast.error('暂无数据可导出');
                      return;
                    }
                    
                    // 准备 CSV 数据
                    const targetColumns = selectedColumn === 'all' 
                      ? analysisResult.column_stats 
                      : analysisResult.column_stats.filter((c: any) => c.name === selectedColumn);
                    
                    // CSV 头部
                    const headers = ['字段名', '数据类型', '字段类型', '非空值', '空值', '空值占比(%)'];
                    const numericHeaders = ['平均值', '中位数', '标准差', '最小值', '最大值', 'Q1(25%)', 'Q3(75%)'];
                    const categoricalHeaders = ['唯一值', '最常见'];
                    
                    // 判断是否有数值型和分类型列
                    const hasNumeric = targetColumns.some((c: any) => c.type === 'numeric');
                    const hasCategorical = targetColumns.some((c: any) => c.type === 'categorical');
                    
                    let allHeaders = [...headers];
                    if (hasNumeric) allHeaders = [...allHeaders, ...numericHeaders];
                    if (hasCategorical) allHeaders = [...allHeaders, ...categoricalHeaders];
                    
                    // 生成数据行
                    const rows = targetColumns.map((col: any) => {
                      const baseRow = [
                        col.name,
                        col.dtype,
                        col.type === 'numeric' ? '数值型' : col.type === 'categorical' ? '分类型' : col.type,
                        col.non_null_count,
                        col.null_count,
                        col.null_percentage
                      ];
                      
                      let extraRow: (string | number)[] = [];
                      
                      if (col.type === 'numeric') {
                        extraRow = [
                          col.mean?.toFixed(4) || '',
                          col.median?.toFixed(4) || '',
                          col.std?.toFixed(4) || '',
                          col.min?.toFixed(4) || '',
                          col.max?.toFixed(4) || '',
                          col.q1?.toFixed(4) || '',
                          col.q3?.toFixed(4) || ''
                        ];
                        if (hasCategorical) {
                          extraRow = [...extraRow, '', '']; // 填充分类型列的空值
                        }
                      } else if (col.type === 'categorical') {
                        if (hasNumeric) {
                          extraRow = ['', '', '', '', '', '', '']; // 填充数值型列的空值
                        }
                        extraRow = [
                          ...extraRow,
                          col.unique_count || '',
                          col.most_common || ''
                        ];
                      } else {
                        // 其他类型填充空值
                        const fillCount = (hasNumeric ? 5 : 0) + (hasCategorical ? 2 : 0);
                        extraRow = new Array(fillCount).fill('');
                      }
                      
                      return [...baseRow, ...extraRow];
                    });
                    
                    // 生成 CSV 内容
                    const csvContent = [
                      allHeaders.join(','),
                      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
                    ].join('\n');
                    
                    // 添加 BOM 以支持中文
                    const BOM = '\uFEFF';
                    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `统计分析报告-${datasetInfo?.filename || 'data'}-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    
                    toast.success('报告已导出为 CSV');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出报告 (CSV)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
