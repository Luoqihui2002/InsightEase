import { useState, useRef, useEffect } from 'react';
import { 
  Brain,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
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
import { ResultView } from '@/components/results';
import { toSemanticAnalysisResult } from '@/lib/adapters/semanticResultAdapter';

export function Semantic() {
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

  const handleExportJSON = () => {
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
  };

  return (
    <AnalysisPageShell
      title="语义分析"
      description="自动识别字段语义类型，理解数据结构"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <AnalysisConfigPanel
          footer={
            <>
              <Button
                onClick={() => {
                  console.log('Analyze button clicked, selectedDataset:', selectedDataset);
                  handleAnalyze();
                }}
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
                    <Brain className="w-4 h-4 mr-2" />
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
        </AnalysisConfigPanel>

        <AnalysisResultPanel
          loading={isAnalyzing && !showResult}
          loadingMessage="正在分析数据，请稍候..."
          empty={!showResult && !isAnalyzing}
          emptyTitle="选择数据集并启动分析"
          emptyDescription="语义分析结果将在此显示"
          actions={showResult ? (
            <AnalysisActionBar onExportJSON={handleExportJSON} />
          ) : undefined}
        >
          {showResult && (
            <div ref={resultRef}>
              {(() => {
                const converted = toSemanticAnalysisResult(
                  analysisResult,
                  datasetInfo
                );
                return converted ? (
                  <ResultView result={converted} />
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <p>分析完成，但未返回统计数据</p>
                  </div>
                );
              })()}
            </div>
          )}
        </AnalysisResultPanel>
      </div>
    </AnalysisPageShell>
  );
}
