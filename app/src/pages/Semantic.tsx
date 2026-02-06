import { useState, useRef, useEffect } from 'react';
import { 
  Settings2, 
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Brain,
  Loader2,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import gsap from 'gsap';

export function Semantic() {
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      return;
    }

    const loadDatasetInfo = async () => {
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data);
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
    console.log('handleAnalyze called, selectedDataset:', selectedDataset);
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }

    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);

    try {
      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'comprehensive',
        params: {}
      }) as any;

      if (res.code === 202 || res.code === 200 || res.data?.id) {
        const analysisId = res.data?.id;
        if (analysisId) {
          await pollResult(analysisId);
        } else {
          throw new Error(res.message || '分析启动失败：未返回分析ID');
        }
      } else {
        throw new Error(res.message || '分析启动失败');
      }
    } catch (err: any) {
      toast.error(err.message || '分析失败');
      setIsAnalyzing(false);
    }
  };

  const pollResult = async (analysisId: string) => {
    const maxAttempts = 180; // 最多等待3分钟
    let attempts = 0;

    const checkResult = async () => {
      try {
        const res = await analysisApi.getResult(analysisId) as any;
        
        if (res.data?.status === 'completed') {
          // comprehensive 分析返回的是 { descriptive: { column_stats: [...] } }
          const resultData = res.data?.result_data;
          if (resultData?.descriptive) {
            setAnalysisResult(resultData.descriptive);
          } else {
            setAnalysisResult(resultData);
          }
          setShowResult(true);
          setIsAnalyzing(false);
          toast.success('分析完成');
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data?.error_msg || '分析失败');
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkResult, 1000);
        } else {
          throw new Error('分析超时，请稍后到历史记录查看结果');
        }
      } catch (err: any) {
        toast.error(err.message);
        setIsAnalyzing(false);
      }
    };

    setTimeout(checkResult, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          语义分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          自动识别字段语义类型，理解数据结构
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">选择数据集</label>
                <DatasetSelector 
                  value={selectedDataset}
                  onChange={(value) => { console.log("Dataset selected:", value); setSelectedDataset(value); }}
                />
                {datasetInfo && (
                  <p className="text-xs text-[var(--neon-cyan)]">
                    {datasetInfo.row_count?.toLocaleString()} 行 · {datasetInfo.col_count} 列
                  </p>
                )}
              </div>

              {/* 语义分析说明 */}
              <div className="p-3 rounded text-sm" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <p className="text-[var(--text-muted)]">
                  语义分析将自动识别数据集中的字段类型和语义含义，无需手动选择列。
                </p>
              </div>

              <button
                onClick={() => {
                  console.log('Analyze button clicked, selectedDataset:', selectedDataset);
                  handleAnalyze();
                }}
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
                    <Brain className="w-4 h-4 mr-2" />
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

        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Brain className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">选择数据集并启动分析</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">语义分析结果将在此显示</p>
              </div>
            </Card>
          ) : (
            <div ref={resultRef} className="space-y-6">
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <Tag className="w-5 h-5 text-[var(--neon-cyan)]" />
                    字段语义识别
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult?.column_stats ? (
                    <div className="space-y-3">
                      {/* 汇总统计 */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] text-center">
                          <p className="text-xs text-[var(--text-muted)]">总行数</p>
                          <p className="text-xl font-bold text-[var(--neon-cyan)]">{analysisResult.total_rows?.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] text-center">
                          <p className="text-xs text-[var(--text-muted)]">总列数</p>
                          <p className="text-xl font-bold text-[var(--neon-cyan)]">{analysisResult.total_columns}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] text-center">
                          <p className="text-xs text-[var(--text-muted)]">数值列</p>
                          <p className="text-xl font-bold text-[var(--neon-purple)]">
                            {analysisResult.column_stats.filter((c: any) => c.type === 'numeric').length}
                          </p>
                        </div>
                      </div>
                      
                      {/* 字段详情 */}
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {analysisResult.column_stats.map((col: any, index: number) => (
                          <div 
                            key={index}
                            className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-[var(--neon-cyan)]">{col.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                                {col.dtype}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                col.type === 'numeric' 
                                  ? 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]' 
                                  : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                              }`}>
                                {col.type === 'numeric' ? '数值型' : '分类型'}
                              </span>
                            </div>
                            
                            {/* 缺失值信息 */}
                            <div className="text-xs text-[var(--text-muted)] mb-1">
                              非空: {col.non_null_count} | 缺失: {col.null_count} ({col.null_percentage}%)
                            </div>
                            
                            {/* 数值型额外统计 */}
                            {col.type === 'numeric' && (
                              <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">均值</span>
                                  <p className="text-sm text-[var(--text-primary)]">{col.mean?.toFixed(2) || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">中位数</span>
                                  <p className="text-sm text-[var(--text-primary)]">{col.median?.toFixed(2) || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">标准差</span>
                                  <p className="text-sm text-[var(--text-primary)]">{col.std?.toFixed(2) || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">范围</span>
                                  <p className="text-sm text-[var(--text-primary)]">{col.min?.toFixed(0) || '-'} ~ {col.max?.toFixed(0) || '-'}</p>
                                </div>
                              </div>
                            )}
                            
                            {/* 分类型额外统计 */}
                            {col.type === 'categorical' && col.unique_count !== undefined && (
                              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                                <span className="text-xs text-[var(--text-muted)]">唯一值: {col.unique_count}</span>
                                {Array.isArray(col.top_values) && col.top_values.length > 0 && (
                                  <span className="text-xs text-[var(--text-secondary)] ml-3">
                                    最常见: {col.top_values.slice(0, 3).join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      分析完成，数据已生成
                    </div>
                  )}
                </CardContent>
              </Card>

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

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className="flex-1 border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10"
                  onClick={() => {
                    if (!analysisResult) return;
                    
                    // 生成报告内容
                    const report = {
                      title: '语义分析报告',
                      dataset: datasetInfo?.filename,
                      generatedAt: new Date().toLocaleString(),
                      columnStats: analysisResult.column_stats || [],
                      aiSummary: analysisResult.ai_summary || ''
                    };
                    
                    // 转换为 JSON 并下载
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `semantic-analysis-report-${Date.now()}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    
                    toast.success('报告已导出');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出报告
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
