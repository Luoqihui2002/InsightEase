import { useState, useRef, useEffect } from 'react';
import { companionService } from '@/services';
import { 
  BarChart3, 
  Play, 
  Sparkles,
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
import {
  AnalysisPageShell,
  AnalysisConfigPanel,
  AnalysisResultPanel,
  AnalysisActionBar,
} from '@/components/analysis';

interface ColumnInfo {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
}

export function Statistics() {
  // 设置当前页面
  useEffect(() => {
    companionService.setPage('statistics');
  }, []);

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

  const handleExportCSV = () => {
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
    <AnalysisPageShell
      title="统计分析"
      description="对数据进行描述性统计分析，了解数据分布特征"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <AnalysisConfigPanel
          footer={
            <>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedDataset}
                className="w-full"
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
              </Button>
              {isAnalyzing && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  正在分析数据，请稍候...
                </p>
              )}
            </>
          }
        >
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
        </AnalysisConfigPanel>

        <AnalysisResultPanel
          loading={isAnalyzing && !showResult}
          loadingMessage="正在分析数据，请稍候..."
          empty={!showResult && !isAnalyzing}
          emptyTitle="选择数据集和列并启动分析"
          emptyDescription="分析结果将在此显示"
          actions={showResult ? (
            <AnalysisActionBar onExportCSV={handleExportCSV} />
          ) : undefined}
        >
          {showResult && (
            <div ref={resultRef} className="space-y-6">
              {/* 统计结果 */}
              {renderStatsResult()}

              {/* AI 解读 */}
              {analysisResult?.ai_summary && (
                <div className="rounded-xl border border-[var(--neon-cyan)]/30 bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="p-4 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                      <Sparkles className="w-5 h-5 text-[var(--neon-cyan)]" />
                      AI 智能解读
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--neon-purple)]/10 to-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                        {analysisResult.ai_summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnalysisResultPanel>
      </div>
    </AnalysisPageShell>
  );
}
