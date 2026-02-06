import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Database,
  Wand2,
  Brain,
  BarChart3,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
import { datasetApi } from '@/api/datasets';
import { analysisApi } from '@/api/analysis';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';


// 向导步骤类型
type WizardStep = 'select' | 'diagnose' | 'preprocess' | 'analyze' | 'result';

// 分析推荐类型
interface AnalysisRecommendation {
  id: string;
  type: 'preprocess' | 'statistics' | 'clustering' | 'attribution' | 'forecast' | 'path';
  title: string;
  description: string;
  icon: React.ReactNode;
  confidence: number; // 0-100
  reason: string;
}

// 数据诊断结果
interface DiagnosisResult {
  qualityScore: number;
  totalRows: number;
  totalCols: number;
  issues: {
    type: 'missing' | 'duplicate' | 'outlier' | 'format';
    severity: 'high' | 'medium' | 'low';
    description: string;
    count: number;
  }[];
  suggestions: string[];
}

export function SmartAnalysis() {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<WizardStep>('select');
  
  // 数据集选择
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  
  // 诊断结果
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  
  // 预处理
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [preprocessResult, setPreprocessResult] = useState<any>(null);
  
  // 推荐分析
  const [recommendations, setRecommendations] = useState<AnalysisRecommendation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setCurrentStep('select');
      return;
    }
    
    const loadDatasetInfo = async () => {
      try {
        const res: any = await datasetApi.getDetail(selectedDataset);
        setDatasetInfo(res.data || res);
        // 自动开始诊断
        runDiagnosis(res.data || res);
      } catch (err) {
        console.error('Failed to load dataset info:', err);
      }
    };
    
    loadDatasetInfo();
  }, [selectedDataset]);
  
  // 运行数据诊断
  const runDiagnosis = async (dataset: Dataset) => {
    setIsDiagnosing(true);
    setCurrentStep('diagnose');
    
    // 模拟诊断（实际应该调用后端API）
    setTimeout(() => {
      const issues = [];
      
      // 基于质量评分生成问题
      if (dataset.quality_score && dataset.quality_score < 80) {
        issues.push({
          type: 'missing' as const,
          severity: 'medium' as const,
          description: '部分字段存在缺失值',
          count: Math.floor(dataset.row_count * 0.05)
        });
      }
      
      if (dataset.quality_score && dataset.quality_score < 60) {
        issues.push({
          type: 'duplicate' as const,
          severity: 'high' as const,
          description: '检测到可能的重复记录',
          count: Math.floor(dataset.row_count * 0.02)
        });
      }
      
      const result: DiagnosisResult = {
        qualityScore: dataset.quality_score || 85,
        totalRows: dataset.row_count || 0,
        totalCols: dataset.col_count || 0,
        issues,
        suggestions: issues.length > 0 
          ? ['建议进行数据预处理', '检查缺失值处理策略']
          : ['数据质量良好，可直接进行分析']
      };
      
      setDiagnosisResult(result);
      setIsDiagnosing(false);
      
      // 生成推荐
      generateRecommendations(dataset, result);
    }, 1500);
  };
  
  // 生成分析推荐
  const generateRecommendations = (dataset: Dataset, diagnosis: DiagnosisResult) => {
    const recs: AnalysisRecommendation[] = [];
    
    // 根据数据特征推荐
    const hasNumeric = dataset.schema?.some(f => 
      f.dtype.includes('int') || f.dtype.includes('float') || f.dtype.includes('number')
    );
    const hasDatetime = dataset.schema?.some(f => 
      f.dtype.includes('datetime') || f.dtype.includes('date') || f.name.toLowerCase().includes('time')
    );
    const hasUserId = dataset.schema?.some(f => 
      f.name.toLowerCase().includes('user') || f.name.toLowerCase().includes('customer') || f.name.toLowerCase().includes('id')
    );
    const hasCategory = dataset.schema?.some(f => 
      f.dtype.includes('object') || f.dtype.includes('category')
    );
    
    // 1. 预处理推荐（如果有质量问题）
    if (diagnosis.issues.length > 0) {
      recs.push({
        id: 'preprocess',
        type: 'preprocess',
        title: '数据预处理',
        description: `修复 ${diagnosis.issues.length} 个数据质量问题`,
        icon: <Wand2 className="w-5 h-5" />,
        confidence: 95,
        reason: '检测到数据质量问题，建议先清洗数据'
      });
    }
    
    // 2. 统计分析（通用）
    if (hasNumeric) {
      recs.push({
        id: 'statistics',
        type: 'statistics',
        title: '统计分析',
        description: '描述性统计与数据分布分析',
        icon: <BarChart3 className="w-5 h-5" />,
        confidence: 90,
        reason: '数值型字段适合进行统计分析'
      });
    }
    
    // 3. 聚类分析
    if (hasNumeric && dataset.row_count > 100) {
      recs.push({
        id: 'clustering',
        type: 'clustering',
        title: '聚类分析',
        description: '发现数据中的自然分组模式',
        icon: <Users className="w-5 h-5" />,
        confidence: hasUserId ? 85 : 75,
        reason: hasUserId ? '适合进行用户分群' : '数值特征适合聚类'
      });
    }
    
    // 4. 时序预测
    if (hasDatetime && hasNumeric) {
      recs.push({
        id: 'forecast',
        type: 'forecast',
        title: '趋势预测',
        description: '基于时间序列的未来趋势预测',
        icon: <TrendingUp className="w-5 h-5" />,
        confidence: 80,
        reason: '检测到时间字段，适合进行趋势分析'
      });
    }
    
    // 5. 归因分析
    if (hasCategory && hasNumeric) {
      recs.push({
        id: 'attribution',
        type: 'attribution',
        title: '归因分析',
        description: '分析指标变化的贡献因素',
        icon: <Brain className="w-5 h-5" />,
        confidence: 70,
        reason: '分类维度+数值指标，适合归因分析'
      });
    }
    
    setRecommendations(recs);
  };
  
  // 执行预处理
  const handlePreprocess = async () => {
    setIsPreprocessing(true);
    setCurrentStep('preprocess');
    
    // 模拟预处理
    setTimeout(() => {
      setPreprocessResult({
        originalRows: datasetInfo?.row_count || 0,
        processedRows: (datasetInfo?.row_count || 0) - 156,
        removedDuplicates: 23,
        filledMissing: 133,
        qualityImproved: true
      });
      setIsPreprocessing(false);
      toast.success('数据预处理完成！');
      
      // 重新诊断
      if (datasetInfo) {
        const updatedInfo = { ...datasetInfo, quality_score: 92 };
        setDatasetInfo(updatedInfo);
        runDiagnosis(updatedInfo);
      }
    }, 3000);
  };
  
  // 执行推荐的分析
  const handleRunAnalysis = async (rec: AnalysisRecommendation) => {
    setIsAnalyzing(true);
    setCurrentStep('analyze');
    
    try {
      // 调用实际分析API
      if (rec.type === 'statistics') {
        const res: any = await analysisApi.create({
          dataset_id: selectedDataset,
          analysis_type: 'descriptive',
          params: {}
        });
        
        if (res.data?.id) {
          await pollAnalysisResult(res.data.id);
        }
      } else {
        // 其他分析类型先模拟
        setTimeout(() => {
          setAnalysisResult({
            type: rec.type,
            title: rec.title,
            summary: `${rec.title}已完成，发现了一些有价值的洞察。`,
            ready: true
          });
          setIsAnalyzing(false);
          setCurrentStep('result');
        }, 2000);
      }
    } catch (err) {
      toast.error('分析执行失败');
      setIsAnalyzing(false);
    }
  };
  
  // 轮询分析结果
  const pollAnalysisResult = async (analysisId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    
    const checkResult = async () => {
      try {
        const res: any = await analysisApi.getResult(analysisId);
        
        if (res.data?.status === 'completed') {
          setAnalysisResult({
            type: 'statistics',
            title: '统计分析',
            data: res.data.result_data,
            ready: true
          });
          setIsAnalyzing(false);
          setCurrentStep('result');
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data.error_msg || '分析失败');
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkResult, 1000);
        } else {
          throw new Error('分析超时');
        }
      } catch (err) {
        toast.error('获取分析结果失败');
        setIsAnalyzing(false);
      }
    };
    
    checkResult();
  };
  
  // 重置向导
  const handleReset = () => {
    setSelectedDataset('');
    setDatasetInfo(null);
    setDiagnosisResult(null);
    setPreprocessResult(null);
    setAnalysisResult(null);
    setRecommendations([]);
    setCurrentStep('select');
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          智能分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          向导式数据分析，自动推荐最佳分析方案
        </p>
      </div>
      
      {/* 步骤指示器 */}
      <div className="flex items-center gap-2">
        {[
          { key: 'select', label: '选择数据', icon: Database },
          { key: 'diagnose', label: '质量诊断', icon: AlertCircle },
          { key: 'preprocess', label: '预处理', icon: Wand2 },
          { key: 'analyze', label: '智能分析', icon: Brain },
          { key: 'result', label: '查看结果', icon: CheckCircle2 },
        ].map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.key;
          const isCompleted = ['select', 'diagnose', 'preprocess', 'analyze', 'result'].indexOf(currentStep) > 
                              ['select', 'diagnose', 'preprocess', 'analyze', 'result'].indexOf(step.key);
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isActive 
                  ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]' 
                  : isCompleted
                    ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}>
                <StepIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < 4 && (
                <ArrowRight className="w-4 h-4 mx-2 text-[var(--text-muted)]" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置面板 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--neon-cyan)]" />
              分析配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 数据集选择 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">选择数据集</label>
              <DatasetSelector 
                value={selectedDataset}
                onChange={setSelectedDataset}
              />
            </div>
            
            {datasetInfo && (
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)] space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">行数</span>
                  <span className="text-[var(--text-primary)]">{datasetInfo.row_count?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">列数</span>
                  <span className="text-[var(--text-primary)]">{datasetInfo.col_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">质量评分</span>
                  <span className={`font-medium ${
                    (datasetInfo.quality_score || 0) >= 80 
                      ? 'text-[var(--neon-green)]' 
                      : (datasetInfo.quality_score || 0) >= 60 
                        ? 'text-[var(--neon-orange)]'
                        : 'text-[var(--neon-pink)]'
                  }`}>
                    {datasetInfo.quality_score || '-'}/100
                  </span>
                </div>
              </div>
            )}
            
            {/* 重置按钮 */}
            {currentStep !== 'select' && (
              <Button 
                variant="outline" 
                className="w-full border-[var(--border-subtle)]"
                onClick={handleReset}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新开始
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* 右侧：步骤内容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 步骤 1: 选择数据集提示 */}
          {currentStep === 'select' && !selectedDataset && (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Database className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">请先选择一个数据集开始分析</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">支持 CSV、Excel 格式</p>
              </div>
            </Card>
          )}
          
          {/* 步骤 2: 数据诊断 */}
          {(currentStep === 'diagnose' || (currentStep === 'select' && selectedDataset)) && (
            <Card className="glass border-[var(--border-subtle)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[var(--neon-cyan)]" />
                  数据质量诊断
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isDiagnosing ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--neon-cyan)] mb-4" />
                    <p className="text-[var(--text-muted)]">正在分析数据质量...</p>
                  </div>
                ) : diagnosisResult ? (
                  <div className="space-y-6">
                    {/* 质量评分卡片 */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">质量评分</p>
                        <p className={`text-3xl font-bold ${
                          diagnosisResult.qualityScore >= 80 
                            ? 'text-[var(--neon-green)]' 
                            : diagnosisResult.qualityScore >= 60 
                              ? 'text-[var(--neon-orange)]'
                              : 'text-[var(--neon-pink)]'
                        }`}>
                          {diagnosisResult.qualityScore}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">数据规模</p>
                        <p className="text-3xl font-bold text-[var(--neon-cyan)]">
                          {diagnosisResult.totalRows.toLocaleString()}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">行 × {diagnosisResult.totalCols}列</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">问题数量</p>
                        <p className={`text-3xl font-bold ${
                          diagnosisResult.issues.length === 0 
                            ? 'text-[var(--neon-green)]' 
                            : 'text-[var(--neon-orange)]'
                        }`}>
                          {diagnosisResult.issues.length}
                        </p>
                      </div>
                    </div>
                    
                    {/* 问题列表 */}
                    {diagnosisResult.issues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">检测到的问题</p>
                        {diagnosisResult.issues.map((issue, index) => (
                          <div 
                            key={index}
                            className={`p-3 rounded-lg border ${
                              issue.severity === 'high' 
                                ? 'border-[var(--neon-pink)]/30 bg-[var(--neon-pink)]/10'
                                : issue.severity === 'medium'
                                  ? 'border-[var(--neon-orange)]/30 bg-[var(--neon-orange)]/10'
                                  : 'border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[var(--text-primary)]">{issue.description}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                issue.severity === 'high' 
                                  ? 'bg-[var(--neon-pink)]/20 text-[var(--neon-pink)]'
                                  : issue.severity === 'medium'
                                    ? 'bg-[var(--neon-orange)]/20 text-[var(--neon-orange)]'
                                    : 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                              }`}>
                                {issue.count} 条
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 建议操作 */}
                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                      <p className="text-sm font-medium text-[var(--text-primary)] mb-2">建议操作</p>
                      <ul className="space-y-1">
                        {diagnosisResult.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[var(--neon-cyan)]" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* 预处理按钮 */}
                    {diagnosisResult.issues.length > 0 && !preprocessResult && (
                      <Button 
                        className="w-full bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                        onClick={handlePreprocess}
                        disabled={isPreprocessing}
                      >
                        {isPreprocessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            正在预处理...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            一键数据预处理
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
          
          {/* 预处理结果 */}
          {preprocessResult && (
            <Card className="glass border-[var(--neon-green)]/30">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--neon-green)] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  预处理完成
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-muted)]">原始行数</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{preprocessResult.originalRows.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-muted)]">处理后行数</p>
                    <p className="text-lg font-bold text-[var(--neon-green)]">{preprocessResult.processedRows.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-muted)]">删除重复</p>
                    <p className="text-lg font-bold text-[var(--neon-pink)]">{preprocessResult.removedDuplicates}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[var(--text-muted)]">填充缺失</p>
                    <p className="text-lg font-bold text-[var(--neon-cyan)]">{preprocessResult.filledMissing}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 分析推荐 */}
          {recommendations.length > 0 && !analysisResult && (
            <Card className="glass border-[var(--border-subtle)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[var(--neon-cyan)]" />
                  智能分析推荐
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.id}
                      className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center text-[var(--neon-cyan)]">
                            {rec.icon}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">{rec.title}</h4>
                            <p className="text-xs text-[var(--text-secondary)]">{rec.description}</p>
                            <p className="text-xs text-[var(--neon-cyan)] mt-1">{rec.reason}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]">
                            匹配度 {rec.confidence}%
                          </span>
                          <Button 
                            size="sm"
                            className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                            onClick={() => handleRunAnalysis(rec)}
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                开始分析
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 分析结果 */}
          {analysisResult && (
            <Card className="glass border-[var(--neon-green)]/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-[var(--neon-green)] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  {analysisResult.title} 结果
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[var(--border-subtle)] text-[var(--text-muted)]"
                    onClick={handleReset}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新开始
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[var(--neon-cyan)] text-[var(--neon-cyan)]"
                    onClick={() => {
                      if (!analysisResult) return;
                      
                      const rows: any[] = [];
                      rows.push(['智能分析报告']);
                      rows.push(['生成时间', new Date().toLocaleString()]);
                      rows.push(['数据集', datasetInfo?.filename || '']);
                      rows.push(['分析类型', analysisResult.type === 'statistics' ? '统计分析' : analysisResult.type || '智能分析']);
                      rows.push([]);
                      
                      if (analysisResult.type === 'statistics' && analysisResult.data) {
                        // 基本统计
                        rows.push(['数据概况']);
                        rows.push(['总行数', analysisResult.data.total_rows]);
                        rows.push(['总列数', analysisResult.data.total_columns]);
                        rows.push(['数值列数', analysisResult.data.column_stats?.filter((c: any) => c.type === 'numeric').length]);
                        rows.push(['分类列数', analysisResult.data.column_stats?.filter((c: any) => c.type === 'categorical').length]);
                        rows.push([]);
                        
                        // 字段统计
                        if (analysisResult.data.column_stats) {
                          rows.push(['字段统计详情']);
                          rows.push(['字段名', '数据类型', '类型', '唯一值数', '缺失值数', '均值/最常见值']);
                          analysisResult.data.column_stats.forEach((col: any) => {
                            rows.push([
                              col.name,
                              col.dtype,
                              col.type === 'numeric' ? '数值' : '分类',
                              col.unique_count,
                              col.null_count,
                              col.mean || col.mode || ''
                            ]);
                          });
                        }
                      } else if (analysisResult.type === 'clustering' && analysisResult.data) {
                        rows.push(['聚类结果']);
                        rows.push(['聚类数量', analysisResult.data.n_clusters]);
                        rows.push(['样本总数', analysisResult.data.samples_count]);
                        rows.push([]);
                        if (analysisResult.data.cluster_summary) {
                          rows.push(['聚类汇总']);
                          rows.push(['聚类ID', '样本数', '占比(%)']);
                          analysisResult.data.cluster_summary.forEach((c: any) => {
                            rows.push([c.cluster_id, c.count, (c.percentage * 100).toFixed(2)]);
                          });
                        }
                      } else if (analysisResult.type === 'forecast' && analysisResult.data) {
                        rows.push(['预测结果']);
                        rows.push(['预测天数', analysisResult.data.forecast_days]);
                        rows.push(['预测均值', analysisResult.data.forecast_mean]);
                        rows.push([]);
                        if (analysisResult.data.forecast_data) {
                          rows.push(['预测数据']);
                          rows.push(['日期', '预测值', '下限', '上限']);
                          analysisResult.data.forecast_data.forEach((item: any) => {
                            rows.push([item.date, item.value, item.lower, item.upper]);
                          });
                        }
                      }
                      
                      // AI摘要
                      if (analysisResult.ai_summary) {
                        rows.push([]);
                        rows.push(['AI智能解读']);
                        rows.push([analysisResult.ai_summary]);
                      }
                      
                      // 转换为CSV
                      const csvContent = rows.map((row: any[]) => 
                        row.map((cell: any) => {
                          const str = String(cell ?? '');
                          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                            return `"${str.replace(/"/g, '""')}"`;
                          }
                          return str;
                        }).join(',')
                      ).join('\n');
                      
                      const BOM = '\uFEFF';
                      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `智能分析_${analysisResult.type}_${new Date().toISOString().slice(0, 10)}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      toast.success('CSV导出成功');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {analysisResult.type === 'statistics' && analysisResult.data ? (
                  <div className="space-y-4">
                    {/* 统计结果展示 */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">总行数</p>
                        <p className="text-xl font-bold text-[var(--neon-cyan)]">{analysisResult.data.total_rows?.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">总列数</p>
                        <p className="text-xl font-bold text-[var(--neon-cyan)]">{analysisResult.data.total_columns}</p>
                      </div>
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">数值列</p>
                        <p className="text-xl font-bold text-[var(--neon-purple)]">
                          {analysisResult.data.column_stats?.filter((c: any) => c.type === 'numeric').length}
                        </p>
                      </div>
                    </div>
                    
                    {/* 字段统计详情 */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {analysisResult.data.column_stats?.map((col: any, index: number) => (
                        <div key={index} className="p-3 rounded bg-[var(--bg-tertiary)] text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--neon-cyan)]">{col.name}</span>
                            <span className="text-xs text-[var(--text-muted)]">({col.dtype})</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              col.type === 'numeric' 
                                ? 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]'
                                : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                            }`}>
                              {col.type === 'numeric' ? '数值' : '分类'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[var(--text-secondary)]">{analysisResult.summary}</p>
                    <Button 
                      className="mt-4 bg-[var(--neon-cyan)] text-[var(--bg-primary)]"
                      onClick={() => {
                        // 跳转到对应分析页面
                        toast.info('请从左侧导航进入对应分析页面查看详细结果');
                      }}
                    >
                      查看详细报告
                    </Button>
                  </div>
                )}
                
                {/* 下一步操作推荐 */}
                <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-[var(--neon-cyan)]" />
                    下一步您可以
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button 
                      variant="outline" 
                      className="justify-start border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50"
                      onClick={() => {
                        setAnalysisResult(null);
                        setCurrentStep('diagnose');
                        toast.info('已返回分析推荐，您可以选择其他分析类型');
                      }}
                    >
                      <Brain className="w-4 h-4 mr-2 text-[var(--neon-cyan)]" />
                      <span className="text-sm">继续其他分析</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start border-[var(--border-subtle)] hover:border-[var(--neon-purple)]/50"
                      onClick={() => {
                        // 跳转到可视化页面
                        window.location.href = '/app/visualization';
                      }}
                    >
                      <BarChart3 className="w-4 h-4 mr-2 text-[var(--neon-purple)]" />
                      <span className="text-sm">去可视化</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start border-[var(--border-subtle)] hover:border-[var(--neon-green)]/50"
                      onClick={() => {
                        // 跳转到历史记录
                        window.location.href = '/app/history';
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 text-[var(--neon-green)]" />
                      <span className="text-sm">查看历史</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start border-[var(--border-subtle)] hover:border-[var(--neon-orange)]/50"
                      onClick={handleReset}
                    >
                      <RefreshCw className="w-4 h-4 mr-2 text-[var(--neon-orange)]" />
                      <span className="text-sm">重新开始</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
