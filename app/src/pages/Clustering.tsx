import { useState, useRef, useEffect } from 'react';
import { companionService } from '@/services';
import { 
  Users, 
  Play, 
  Sparkles,
  Loader2,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  selected: boolean;
  type?: 'numeric' | 'categorical' | 'datetime' | 'other';
}

export function Clustering() {
  // 设置当前页面
  useEffect(() => {
    companionService.setPage('clustering');
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [kValue, setKValue] = useState(3);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [numericColumns, setNumericColumns] = useState<ColumnInfo[]>([]);
  const [allColumns, setAllColumns] = useState<Array<{name: string, dtype: string, type: 'numeric' | 'categorical' | 'datetime' | 'other'}>>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setNumericColumns([]);
      return;
    }

    const loadDatasetInfo = async () => {
      // 切换数据集时清空列信息，避免显示旧数据集的验证结果
      setAllColumns([]);
      setNumericColumns([]);
      
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data || res);
        
        // 解析数值型列
        const schema = res.schema || res.data?.schema;
        console.log('Clustering schema:', schema);
        
        if (schema && Array.isArray(schema) && schema.length > 0) {
          // 保存所有列用于数据验证
          const allCols = schema.map((field: any) => {
            const dtype = (field.dtype || field.type || field.data_type || 'unknown')?.toLowerCase() || '';
            let type: 'numeric' | 'categorical' | 'datetime' | 'other' = 'other';
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
          setAllColumns(allCols);
          
          const cols: ColumnInfo[] = allCols
            .filter((col: any) => col.type === 'numeric')
            .map((col: any) => ({
              name: col.name,
              dtype: col.dtype,
              selected: false,
              type: col.type
            }));
          setNumericColumns(cols);
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

  const toggleColumn = (index: number) => {
    setNumericColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, selected: !col.selected } : col
    ));
  };

  const handleAnalyze = async () => {
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }

    const selectedCols = numericColumns.filter(c => c.selected).map(c => c.name);
    if (selectedCols.length < 2) {
      toast.error('请至少选择 2 个数值型列进行聚类分析');
      return;
    }

    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);

    try {
      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'comprehensive',
        params: { 
          k: kValue,
          columns: selectedCols
        }
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
          toast.success('聚类分析完成');
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

  const canRun = selectedDataset && numericColumns.filter(c => c.selected).length >= 2;

  return (
    <AnalysisPageShell
      title="聚类分析"
      description="使用 K-Means 算法对数据进行分群，发现数据中的潜在模式"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <AnalysisConfigPanel
          footer={
            <>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !canRun}
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
                    启动聚类
                  </>
                )}
              </Button>
              {isAnalyzing && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  正在进行聚类分析，请稍候...
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
          {allColumns.length > 0 && (
            <DataTypeValidation 
              columns={allColumns} 
              analysisType="clustering_analysis" 
            />
          )}

          {/* 数值型列选择 */}
          {numericColumns.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">
                选择特征列 (至少2个)
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {numericColumns.map((col, index) => (
                  <label 
                    key={col.name}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-[var(--bg-tertiary)]"
                  >
                    <input
                      type="checkbox"
                      checked={col.selected}
                      onChange={() => toggleColumn(index)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: 'var(--neon-cyan)' }}
                    />
                    <span className="text-sm text-[var(--text-primary)]">{col.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">({col.dtype})</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                已选择 {numericColumns.filter(c => c.selected).length} 个列
              </p>
            </div>
          )}

          {numericColumns.length === 0 && selectedDataset && (
            <div className="p-3 rounded text-sm text-[var(--neon-orange)]"
              style={{ backgroundColor: 'rgba(255, 170, 0, 0.1)' }}
            >
              该数据集没有数值型列，无法进行聚类分析
            </div>
          )}

          {/* K值选择 */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-[var(--text-muted)]">聚类数量 (K)</label>
              <span className="text-sm text-[var(--neon-cyan)] mono">{kValue}</span>
            </div>
            <Slider
              value={[kValue]}
              onValueChange={(value) => setKValue(value[0])}
              min={2}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-[var(--text-muted)]">
              建议: 2-5 个聚类通常效果最好
            </p>
          </div>
        </AnalysisConfigPanel>

        <AnalysisResultPanel
          loading={isAnalyzing && !showResult}
          loadingMessage="正在分析数据，请稍候..."
          empty={!showResult && !isAnalyzing}
          emptyTitle="选择数据集和特征列并启动分析"
          emptyDescription="聚类结果将在此显示"
          actions={showResult ? (
            <AnalysisActionBar onDownload={() => toast.info('导出功能开发中')} />
          ) : undefined}
        >
          {showResult && (
            <div ref={resultRef} className="space-y-6">
              {/* 聚类结果 */}
              <div>
                <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] mb-4">
                  <Users className="w-5 h-5 text-[var(--neon-cyan)]" />
                  聚类结果
                </div>
                {analysisResult?.descriptive?.column_stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisResult.descriptive.column_stats.slice(0, kValue * 2).map((col: any, index: number) => (
                      <div 
                        key={index}
                        className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[var(--text-primary)]">{col.name}</span>
                          <span className="text-xs text-[var(--neon-cyan)]">{col.dtype}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-[var(--text-muted)]">均值: </span>
                            <span className="text-[var(--neon-cyan)]">{col.mean?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">标准差: </span>
                            <span className="text-[var(--neon-cyan)]">{col.std?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>聚类分析已完成</p>
                  </div>
                )}
              </div>

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
