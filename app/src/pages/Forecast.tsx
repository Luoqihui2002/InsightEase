import { useState, useRef, useEffect } from 'react';
import { companionService } from '@/services';
import { 
  TrendingUp, 
  Play, 
  Settings2, 
  Download,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Brain,
  Calendar,
  BarChart3,
  Info,
  Upload
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  sample?: any[];
}

// 智能识别时间列
const isLikelyDateTimeColumn = (col: ColumnInfo): boolean => {
  const nameLower = col.name.toLowerCase();
  const dtypeLower = col.dtype.toLowerCase();
  
  // 1. 基于数据类型
  if (dtypeLower.includes('datetime') || dtypeLower.includes('timestamp')) {
    return true;
  }
  
  // 2. 基于列名关键词
  const timeKeywords = ['time', 'date', 'timestamp', 'created', 'updated', 'occurred', 'event_time', 
    'visit_time', 'click_time', 'session_time', 'dt', 'ts', '时间', '日期', 'period', 'day', 'month', 'year'];
  if (timeKeywords.some(kw => nameLower.includes(kw))) {
    return true;
  }
  
  // 3. 基于样本值（简单检查）
  if (col.sample && col.sample.length > 0) {
    const sample = String(col.sample[0]);
    const datePatterns = [
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
      /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/,
      /^\d{1,2}:\d{2}:\d{2}/,
      /^\d{4}\d{2}\d{2}/,
      /^[A-Za-z]{3,}\s+\d{1,2}/,
    ];
    if (datePatterns.some(p => p.test(sample))) {
      return true;
    }
  }
  
  return false;
};

// 电商大促日历配置
interface PromotionEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: 'preheat' | 'burst' | 'return' | 'festival';
  impact: number; // 促销影响系数
}

// 获取当前年份，动态生成大促日期
const CURRENT_YEAR = new Date().getFullYear();

// XBB 海外电商默认营销日历（基于俄罗斯/独联体市场）
const DEFAULT_PROMOTIONS: PromotionEvent[] = [
  // Q1
  { id: '1', name: '新年圣诞', date: `${CURRENT_YEAR}-01-07`, type: 'burst', impact: 2.0 },
  { id: '2', name: '男人节', date: `${CURRENT_YEAR}-02-23`, type: 'festival', impact: 1.4 },
  { id: '3', name: '女生节', date: `${CURRENT_YEAR}-03-08`, type: 'burst', impact: 1.8 },
  // Q2
  { id: '4', name: '换季大促', date: `${CURRENT_YEAR}-05-09`, type: 'burst', impact: 1.6 },
  // Q3
  { id: '5', name: '返校季', date: `${CURRENT_YEAR}-08-25`, type: 'festival', impact: 1.5 },
  // Q4
  { id: '6', name: '双11', date: `${CURRENT_YEAR}-11-11`, type: 'burst', impact: 2.5 },
  { id: '7', name: '黑五', date: `${CURRENT_YEAR}-11-29`, type: 'burst', impact: 2.2 },
];

// 支持导入自定义营销日历
let CUSTOM_PROMOTIONS: PromotionEvent[] = [];

// 强制使用 CUSTOM_PROMOTIONS 变量
void CUSTOM_PROMOTIONS;

// 辅助变量选项
interface AuxiliaryVariable {
  key: string;
  name: string;
  icon: string;
  description: string;
}

const AUXILIARY_VARIABLES: AuxiliaryVariable[] = [
  { key: 'uv', name: '访客数(UV)', icon: '👥', description: '网站/店铺访客数量' },
  { key: 'conversion', name: '转化率', icon: '📊', description: '访客到购买的转化比例' },
  { key: 'ad_spend', name: '广告投入', icon: '💰', description: '营销推广费用' },
  { key: 'avg_order', name: '客单价', icon: '🛒', description: '平均订单金额' },
  { key: 'inventory', name: '库存水平', icon: '📦', description: '商品库存量' },
  { key: 'competitor', name: '竞品价格', icon: '🔍', description: '竞争对手价格' },
];

export function Forecast() {
  // 设置当前页面
  useEffect(() => {
    companionService.setPage('forecast');
  }, []);

  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [forecastDays, setForecastDays] = useState('30');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [dateColumn, setDateColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  
  // 电商特性配置
  const [selectedModel, setSelectedModel] = useState<'prophet' | 'lightgbm' | 'sarima'>('prophet');
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
  const [selectedAuxVars, setSelectedAuxVars] = useState<string[]>([]);
  const [whatIfConfig, setWhatIfConfig] = useState<{[key: string]: number}>({});
  
  // 自定义营销日历
  const [customPromotions, setCustomPromotions] = useState<PromotionEvent[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // 批量预测配置
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatchColumns, setSelectedBatchColumns] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<any>(null);
  
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setColumns([]);
      setDateColumn('');
      setValueColumn('');
      return;
    }

    const loadDatasetInfo = async () => {
      // 切换数据集时清空列信息，避免显示旧数据集的验证结果
      setColumns([]);
      setDateColumn('');
      setValueColumn('');
      
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data || res);
        
        // 解析 schema 信息
        const schema = res.schema || res.data?.schema;
        console.log('Forecast schema:', schema);
        
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
              type,
              sample: field.sample || field.sample_values || field.samples || []
            };
          });
          setColumns(cols);
          
          // 自动选择日期列和数值列（使用智能检测）
          const dateCol = cols.find(c => isLikelyDateTimeColumn(c));
          const valueCol = cols.find(c => c.type === 'numeric');
          if (dateCol) setDateColumn(dateCol.name);
          if (valueCol) setValueColumn(valueCol.name);
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
    console.log('handleAnalyze called, selectedDataset:', selectedDataset);
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }

    // 批量预测模式
    if (isBatchMode) {
      if (selectedBatchColumns.length === 0) {
        toast.error('请至少选择一个预测列');
        return;
      }
      if (selectedBatchColumns.length > 20) {
        toast.error('批量预测最多支持20个SKU/品类');
        return;
      }
      
      setIsAnalyzing(true);
      setShowResult(false);
      setBatchResult(null);
      
      try {
        const params: any = { 
          periods: parseInt(forecastDays),
          model: selectedModel,
          value_columns: selectedBatchColumns,
          promotions: selectedPromotions.map(id => DEFAULT_PROMOTIONS.find(p => p.id === id)).filter(Boolean)
        };
        if (dateColumn) params.date_column = dateColumn;

        const res = await analysisApi.create({
          dataset_id: selectedDataset,
          analysis_type: 'batch_forecast',
          params
        }) as any;

        if ((res.code === 202 || res.code === 200) && res.data?.id) {
          const analysisId = res.data.id;
          await pollBatchResult(analysisId);
        } else {
          throw new Error(res.message || '分析启动失败');
        }
      } catch (err: any) {
        toast.error(err.message || '分析失败');
        setIsAnalyzing(false);
      }
      return;
    }

    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);

    try {
      const allPromotions = [...DEFAULT_PROMOTIONS, ...customPromotions];
      const params: any = { 
        periods: parseInt(forecastDays),
        model: selectedModel,
        promotions: selectedPromotions.map(id => allPromotions.find(p => p.id === id)).filter(Boolean),
        auxiliary_variables: selectedAuxVars
      };
      if (dateColumn) params.date_column = dateColumn;
      if (valueColumn) params.value_column = valueColumn;

      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'forecast',
        params
      }) as any;

      if ((res.code === 202 || res.code === 200) && res.data?.id) {
        const analysisId = res.data.id;
        await pollResult(analysisId);
      } else {
        throw new Error(res.message || '分析启动失败');
      }
    } catch (err: any) {
      toast.error(err.message || '分析失败');
      setIsAnalyzing(false);
    }
  };
  
  // 处理营销日历文件导入
  const handlePromotionImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        // 解析 CSV/Excel 导出的数据
        // 支持格式: 名称,日期,类型,影响系数
        const imported: PromotionEvent[] = [];
        let idOffset = DEFAULT_PROMOTIONS.length + 1;
        
        lines.forEach((line, idx) => {
          if (idx === 0 && (line.includes('名称') || line.includes('name'))) return; // 跳过表头
          
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            const name = parts[0];
            const dateStr = parts[1];
            const type = (parts[2] as PromotionEvent['type']) || 'festival';
            const impact = parseFloat(parts[3]) || 1.5;
            
            // 解析日期 (支持多种格式: 2026-01-01, 2026/01/01, 01-01 等)
            let date = dateStr;
            if (!date.includes('-') && !date.includes('/')) {
              // 假设是当前年的 MM-DD 格式
              date = `${CURRENT_YEAR}-${date}`;
            }
            
            imported.push({
              id: `custom_${idOffset++}`,
              name,
              date,
              type,
              impact
            });
          }
        });
        
        if (imported.length > 0) {
          setCustomPromotions(imported);
          toast.success(`成功导入 ${imported.length} 个营销活动`);
          setShowImportDialog(false);
        } else {
          toast.error('未能识别有效数据，请检查文件格式');
        }
      } catch (error) {
        toast.error('文件解析失败，请确保格式正确');
      }
    };
    
    reader.readAsText(file);
  };
  
  // 批量预测轮询
  const pollBatchResult = async (analysisId: string) => {
    const maxAttempts = 60; // 批量预测可能需要更长时间
    let attempts = 0;

    const checkResult = async () => {
      try {
        const res = await analysisApi.getResult(analysisId) as any;
        
        if (res.data?.status === 'completed') {
          setBatchResult(res.data?.result_data);
          setShowResult(true);
          setIsAnalyzing(false);
          toast.success(`批量预测完成！成功预测 ${res.data?.result_data?.summary?.success_count || 0} 个SKU`);
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data?.error_msg || '分析失败');
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkResult, 2000);
        } else {
          throw new Error('分析超时');
        }
      } catch (err: any) {
        toast.error(err.message);
        setIsAnalyzing(false);
      }
    };

    setTimeout(checkResult, 2000);
  };

  const pollResult = async (analysisId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const checkResult = async () => {
      try {
        const res = await analysisApi.getResult(analysisId) as any;
        
        if (res.data?.status === 'completed') {
          const resultData = res.data?.result_data;
          setAnalysisResult(resultData);
          setShowResult(true);
          setIsAnalyzing(false);
          
          // 保存预测结果到 localStorage，供指标规划模块使用
          if (resultData && !resultData.error) {
            try {
              localStorage.setItem('insightease_forecast_result', JSON.stringify(resultData));
            } catch (e) {
              console.error('Failed to save forecast result:', e);
            }
          }
          
          toast.success('分析完成');
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data?.error_msg || '分析失败');
        }

        attempts++;
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

  // What-if 分析
  const handleWhatIfAnalysis = async () => {
    if (!selectedDataset || !analysisResult) return;
    
    setIsAnalyzing(true);
    
    try {
      // 计算调整后的预测
      const adjustments = selectedAuxVars.map(varKey => {
        const variable = AUXILIARY_VARIABLES.find(v => v.key === varKey);
        const adjustment = whatIfConfig[varKey] || 0;
        
        // 不同变量的影响系数
        const impactFactors: {[key: string]: number} = {
          'uv': 0.8,        // 访客数影响大
          'conversion': 1.2, // 转化率影响最大
          'ad_spend': 0.6,  // 广告投入影响中等
          'avg_order': 0.5, // 客单价影响中等
          'inventory': 0.3, // 库存影响较小
          'competitor': -0.4 // 竞品价格负向影响
        };
        
        const factor = impactFactors[varKey] || 0.5;
        return {
          variable: variable?.name,
          adjustment: adjustment,
          impact: adjustment * factor
        };
      });
      
      // 总影响系数
      const totalImpact = adjustments.reduce((sum, adj) => sum + adj.impact, 0);
      
      // 调整预测结果
      const adjustedForecast = analysisResult.forecast?.yhat?.map((value: number) => {
        return value * (1 + totalImpact / 100);
      });
      
      // 更新结果
      const newResult = {
        ...analysisResult,
        what_if: {
          adjustments: adjustments,
          total_impact: totalImpact,
          original_forecast: analysisResult.forecast?.yhat
        },
        forecast: {
          ...analysisResult.forecast,
          yhat: adjustedForecast,
          yhat_lower: adjustedForecast?.map((v: number) => v * 0.9),
          yhat_upper: adjustedForecast?.map((v: number) => v * 1.1)
        },
        statistics: {
          ...analysisResult.statistics,
          forecast_mean: adjustedForecast?.reduce((a: number, b: number) => a + b, 0) / adjustedForecast?.length
        }
      };
      
      setAnalysisResult(newResult);
      toast.success('What-if 分析完成');
    } catch (err: any) {
      toast.error(err.message || '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          趋势预测
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          基于 Prophet 模型的时间序列预测
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

              {/* 数据类型验证提示 */}
              {columns.length > 0 && (
                <DataTypeValidation 
                  columns={columns} 
                  analysisType="forecast" 
                />
              )}

              {/* 配置帮助指南 */}
              <details className="rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                <summary className="p-3 text-sm font-medium text-[var(--neon-cyan)] cursor-pointer hover:bg-[var(--bg-tertiary)] flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  模块使用说明
                </summary>
                <div className="p-3 text-xs space-y-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">📈 功能介绍</p>
                    <p className="text-[var(--text-muted)]">基于时间序列模型预测未来趋势，支持单SKU深度分析和多SKU批量预测两种模式。</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">⚙️ 参数说明</p>
                    <ul className="text-[var(--text-muted)] space-y-0.5 pl-1">
                      <li>• <b>日期列</b>: 时间序列数据的时间维度，支持自动检测</li>
                      <li>• <b>预测目标列</b>: 需要预测的数值列（如销量、GMV等）</li>
                      <li>• <b>预测周期</b>: 7天/30天/90天三种预设周期</li>
                      <li>• <b>批量预测模式</b>: 同时预测最多20个SKU/品类</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">🤖 模型选择</p>
                    <ul className="text-[var(--text-muted)] space-y-0.5 pl-1">
                      <li>• <b>Prophet</b>: 适合有明显季节性和节假日效应的数据</li>
                      <li>• <b>LightGBM</b>: 适合多变量特征，训练速度快</li>
                      <li>• <b>SARIMA</b>: 适合趋势稳定的时间序列</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">🎁 电商特性</p>
                    <ul className="text-[var(--text-muted)] space-y-0.5 pl-1">
                      <li>• <b>大促日历</b>: 勾选已知的促销活动，提升预测准确度</li>
                      <li>• <b>What-if分析</b>: 调整UV、转化率等变量，模拟不同场景</li>
                      <li>• <b>预测分解</b>: 拆解趋势/季节/促销/残差各成分贡献</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">💡 使用建议</p>
                    <ul className="text-[var(--text-muted)] space-y-0.5 pl-1">
                      <li>• 数据量建议：至少30个数据点（如30天日频数据）</li>
                      <li>• 批量预测适合商品组合分析，快速对比各SKU趋势</li>
                      <li>• 结合大促日历可获得更准确的电商场景预测</li>
                    </ul>
                  </div>
                </div>
              </details>

              {/* 日期列选择 -->
              {columns.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm text-[var(--text-muted)]">日期列</label>
                  <select
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="">自动检测</option>
                    <optgroup label="推荐的日期列">
                      {columns.filter(c => isLikelyDateTimeColumn(c)).map(col => (
                        <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                      ))}
                    </optgroup>
                    <optgroup label="其他列">
                      {columns.filter(c => !isLikelyDateTimeColumn(c)).map(col => (
                        <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    支持 datetime、string、date 等格式，系统会自动解析
                  </p>
                </div>
              )}

              {/* 批量预测模式切换 */}
              {columns.length > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-secondary)]">
                  <span className="text-sm text-[var(--text-muted)]">批量预测模式</span>
                  <button
                    onClick={() => {
                      setIsBatchMode(!isBatchMode);
                      if (!isBatchMode) {
                        setSelectedBatchColumns([]);
                      }
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      isBatchMode 
                        ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]' 
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {isBatchMode ? '已开启' : '关闭'}
                  </button>
                </div>
              )}

              {/* 数值列选择 - 单模式 */}
              {columns.length > 0 && !isBatchMode && (
                <div className="space-y-2">
                  <label className="text-sm text-[var(--text-muted)]">预测目标列</label>
                  <select
                    value={valueColumn}
                    onChange={(e) => setValueColumn(e.target.value)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="">自动检测</option>
                    {columns.filter(c => c.type === 'numeric').map(col => (
                      <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                    ))}
                    {columns.filter(c => c.type !== 'numeric').map(col => (
                      <option key={col.name} value={col.name}>{col.name} ({col.dtype})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 批量预测列选择 */}
              {columns.length > 0 && isBatchMode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[var(--text-muted)]">选择预测列 (多选)</label>
                    <span className="text-xs text-[var(--neon-cyan)]">
                      已选 {selectedBatchColumns.length}/20
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    {columns.filter(c => c.type === 'numeric').map(col => (
                      <label
                        key={col.name}
                        className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[var(--bg-tertiary)] text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBatchColumns.includes(col.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedBatchColumns.length < 20) {
                                setSelectedBatchColumns([...selectedBatchColumns, col.name]);
                              }
                            } else {
                              setSelectedBatchColumns(selectedBatchColumns.filter(n => n !== col.name));
                            }
                          }}
                          className="rounded"
                          style={{ accentColor: 'var(--neon-cyan)' }}
                        />
                        <span className="text-[var(--text-primary)]">{col.name}</span>
                        <span className="text-[var(--text-muted)]">({col.dtype})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    同时预测多个SKU/品类的销售趋势，适合商品组合分析
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">预测周期</label>
                <ToggleGroup 
                  type="single" 
                  value={forecastDays}
                  onValueChange={(value) => value && setForecastDays(value)}
                  className="grid grid-cols-3 gap-2"
                >
                  <ToggleGroupItem 
                    value="7" 
                    className="data-[state=on]:bg-[var(--neon-cyan)] data-[state=on]:text-[var(--bg-primary)]"
                  >
                    7天
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="30"
                    className="data-[state=on]:bg-[var(--neon-cyan)] data-[state=on]:text-[var(--bg-primary)]"
                  >
                    30天
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="90"
                    className="data-[state=on]:bg-[var(--neon-cyan)] data-[state=on]:text-[var(--bg-primary)]"
                  >
                    90天
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* 模型选择 */}
              <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
                <label className="text-sm text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 预测模型
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'prophet', name: 'Prophet', desc: '适合季节性' },
                    { key: 'lightgbm', name: 'LightGBM', desc: '适合多变量' },
                    { key: 'sarima', name: 'SARIMA', desc: '适合稳定趋势' },
                  ].map((model) => (
                    <button
                      key={model.key}
                      onClick={() => setSelectedModel(model.key as any)}
                      className={`p-2 rounded text-xs text-left transition-all ${
                        selectedModel === model.key
                          ? 'bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
                          : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-[10px] opacity-70">{model.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 大促日历 */}
              <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
                <label className="text-sm text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                  🎁 电商大促日历
                </label>
                <p className="text-[10px] text-[var(--text-muted)]">
                  选择已知的促销活动，提升预测准确度
                </p>
                
                {/* 大促日历使用说明 */}
                <details className="text-xs">
                  <summary className="text-[var(--text-muted)] cursor-pointer hover:text-[var(--neon-cyan)] flex items-center gap-1">
                    <Info className="w-3 h-3" /> 怎么用？
                  </summary>
                  <div className="mt-2 p-2 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] space-y-1">
                    <p>• 勾选预测期内会发生的促销活动</p>
                    <p>• 模型会学习历史大促效应，在预测期自动应用</p>
                    <p>• 例如：勾选"双11爆发"，预测时会在11月11日给出销量峰值</p>
                  </div>
                </details>
                
                {/* 导入自定义营销日历 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    {customPromotions.length > 0 ? `已加载 ${customPromotions.length} 个自定义活动` : '使用默认日历'}
                  </span>
                  <button
                    onClick={() => setShowImportDialog(true)}
                    className="text-xs flex items-center gap-1 text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
                  >
                    <Upload className="w-3 h-3" /> 导入Excel/CSV
                  </button>
                </div>
                
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded bg-[var(--bg-secondary)]">
                  {[...DEFAULT_PROMOTIONS, ...customPromotions].map((promo) => (
                    <label
                      key={promo.id}
                      className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[var(--bg-tertiary)] text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPromotions.includes(promo.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPromotions([...selectedPromotions, promo.id]);
                          } else {
                            setSelectedPromotions(selectedPromotions.filter(id => id !== promo.id));
                          }
                        }}
                        className="rounded"
                        style={{ accentColor: 'var(--neon-cyan)' }}
                      />
                      <span className="flex-1">
                        <span className="text-[var(--text-primary)]">{promo.name}</span>
                        <span className="text-[var(--text-muted)] ml-1">{promo.date}</span>
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        promo.type === 'burst' ? 'bg-[var(--neon-pink)]/20 text-[var(--neon-pink)]' :
                        promo.type === 'preheat' ? 'bg-[var(--neon-orange)]/20 text-[var(--neon-orange)]' :
                        'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                      }`}>
                        {promo.type === 'burst' ? '爆发' : promo.type === 'preheat' ? '预热' : '返场'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 辅助变量 */}
              <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
                <label className="text-sm text-[var(--neon-cyan)] font-medium">
                  📊 辅助变量（可选）
                </label>
                <p className="text-[10px] text-[var(--text-muted)]">
                  选择影响销量的因素，用于多变量预测
                </p>
                
                {/* 辅助变量使用说明 */}
                <details className="text-xs">
                  <summary className="text-[var(--text-muted)] cursor-pointer hover:text-[var(--neon-cyan)] flex items-center gap-1">
                    <Info className="w-3 h-3" /> 怎么用？
                  </summary>
                  <div className="mt-2 p-2 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] space-y-1">
                    <p>• 这是<strong>假设分析</strong>工具，<strong>不需要</strong>数据表包含这些列</p>
                    <p>• 勾选变量后，在下方 What-if 区域调整百分比</p>
                    <p>• 例如：勾选"广告投入"并设为+30%，查看销量变化</p>
                    <p>• 适合模拟"如果XX因素变了，销量会怎样"的场景</p>
                  </div>
                </details>
                
                <div className="grid grid-cols-2 gap-2">
                  {AUXILIARY_VARIABLES.map((variable) => (
                    <button
                      key={variable.key}
                      onClick={() => {
                        if (selectedAuxVars.includes(variable.key)) {
                          setSelectedAuxVars(selectedAuxVars.filter(k => k !== variable.key));
                          // 移除对应的what-if配置
                          const newConfig = {...whatIfConfig};
                          delete newConfig[variable.key];
                          setWhatIfConfig(newConfig);
                        } else {
                          setSelectedAuxVars([...selectedAuxVars, variable.key]);
                          // 初始化what-if配置
                          setWhatIfConfig({...whatIfConfig, [variable.key]: 0});
                        }
                      }}
                      className={`p-2 rounded text-xs text-left transition-all ${
                        selectedAuxVars.includes(variable.key)
                          ? 'bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)] text-[var(--neon-purple)]'
                          : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/50'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{variable.icon}</span>
                        <span className="font-medium">{variable.name}</span>
                      </div>
                      <div className="text-[10px] opacity-70">{variable.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* What-if 分析 */}
              {selectedAuxVars.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                  <label className="text-sm text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                    🔮 What-if 分析
                  </label>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    调整变量查看对销量的影响
                  </p>
                  
                  {selectedAuxVars.map((varKey) => {
                    const variable = AUXILIARY_VARIABLES.find(v => v.key === varKey);
                    const currentValue = whatIfConfig[varKey] || 0;
                    
                    return (
                      <div key={varKey} className="p-3 rounded bg-[var(--bg-secondary)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-primary)]">{variable?.name}</span>
                          <span className={`font-bold ${
                            currentValue > 0 ? 'text-[var(--neon-green)]' : 
                            currentValue < 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--text-muted)]'
                          }`}>
                            {currentValue > 0 ? '+' : ''}{currentValue}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="100"
                          step="5"
                          value={currentValue}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value);
                            setWhatIfConfig({...whatIfConfig, [varKey]: newValue});
                          }}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, var(--neon-pink) 0%, var(--neon-pink) ${(50 + currentValue) / 1.5}%, var(--bg-tertiary) ${(50 + currentValue) / 1.5}%, var(--bg-tertiary) 100%)`
                          }}
                        />
                        <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                          <span>-50%</span>
                          <span>0%</span>
                          <span>+100%</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {showResult && (
                    <button
                      onClick={handleWhatIfAnalysis}
                      disabled={isAnalyzing}
                      className="w-full py-2 px-3 rounded text-xs font-medium transition-all"
                      style={{
                        backgroundColor: 'var(--neon-purple)',
                        color: 'var(--bg-primary)',
                        opacity: isAnalyzing ? 0.5 : 1
                      }}
                    >
                      {isAnalyzing ? '计算中...' : '重新计算预测'}
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  console.log('Analyze button clicked, selectedDataset:', selectedDataset);
                  handleAnalyze();
                }}
                disabled={isAnalyzing || !selectedDataset || (isBatchMode && selectedBatchColumns.length === 0)}
                className="w-full font-medium py-2 px-4 rounded transition-all flex items-center justify-center"
                style={{
                  backgroundColor: selectedDataset ? 'var(--neon-cyan)' : 'var(--bg-tertiary)',
                  color: selectedDataset ? 'var(--bg-primary)' : 'var(--text-muted)',
                  cursor: selectedDataset ? 'pointer' : 'not-allowed',
                  border: 'none',
                  opacity: (selectedDataset && (!isBatchMode || selectedBatchColumns.length > 0)) ? 1 : 0.5
                }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isBatchMode ? `批量预测中 (${selectedBatchColumns.length}个SKU)...` : '预测中...'}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {isBatchMode 
                      ? `批量预测 (${selectedBatchColumns.length}个SKU)` 
                      : '启动预测'
                    }
                  </>
                )}
              </button>

              {isAnalyzing && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  正在预测数据，请稍候...
                </p>
              )}
            </CardContent>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">选择数据集并启动预测</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">预测结果将在此显示</p>
              </div>
            </Card>
          ) : batchResult ? (
            // 批量预测结果展示
            <div ref={resultRef} className="space-y-6">
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--neon-cyan)]" />
                    批量预测结果
                    <span className="text-sm px-2 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]">
                      {batchResult.summary?.success_count || 0} SKU
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 汇总统计 */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">总SKU数</p>
                        <p className="text-xl font-bold text-[var(--neon-cyan)] mono">
                          {batchResult.summary?.total_sku || 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">成功预测</p>
                        <p className="text-xl font-bold text-[var(--neon-green)] mono">
                          {batchResult.summary?.success_count || 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">平均增长</p>
                        <p className={`text-xl font-bold mono ${(batchResult.summary?.avg_growth || 0) >= 0 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-pink)]'}`}>
                          {(batchResult.summary?.avg_growth || 0) >= 0 ? '+' : ''}{batchResult.summary?.avg_growth?.toFixed(1) || 0}%
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">预测周期</p>
                        <p className="text-xl font-bold text-[var(--neon-purple)] mono">
                          {forecastDays}天
                        </p>
                      </div>
                    </div>
                    
                    {/* 增长最快 */}
                    {batchResult.summary?.top_growing && (
                      <div className="p-4 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--neon-green)]">🚀</span>
                          <span className="text-sm text-[var(--text-muted)]">增长最快:</span>
                          <span className="font-medium text-[var(--text-primary)]">{batchResult.summary.top_growing}</span>
                          <span className="text-[var(--neon-green)]">+{batchResult.summary.top_growth_rate}%</span>
                        </div>
                      </div>
                    )}
                    
                    {/* SKU列表 */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <h4 className="text-sm font-medium text-[var(--text-muted)]">各SKU预测详情</h4>
                      {batchResult.forecasts?.map((item: any) => (
                        <div 
                          key={item.column}
                          className="flex items-center justify-between p-3 rounded bg-[var(--bg-secondary)]"
                        >
                          <span className="text-sm text-[var(--text-primary)]">{item.column}</span>
                          {item.error ? (
                            <span className="text-xs text-[var(--neon-pink)]">失败: {item.error}</span>
                          ) : (
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-[var(--text-muted)]">
                                历史均值: <span className="mono text-[var(--text-primary)]">
                                  {item.forecast?.statistics?.historical_mean?.toFixed(0) || '-'}
                                </span>
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                预测均值: <span className="mono text-[var(--neon-cyan)]">
                                  {item.forecast?.statistics?.forecast_mean?.toFixed(0) || '-'}
                                </span>
                              </span>
                              <span className={`text-xs font-medium ${(item.growth_rate || 0) >= 0 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-pink)]'}`}>
                                {(item.growth_rate || 0) >= 0 ? '↗' : '↘'} {Math.abs(item.growth_rate || 0).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div ref={resultRef} className="space-y-6">
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--neon-cyan)]" />
                    预测结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 错误提示 */}
                  {analysisResult?.error && (
                    <div className="p-4 rounded-lg bg-[var(--neon-pink)]/10 border border-[var(--neon-pink)]/30 mb-4">
                      <p className="text-sm text-[var(--neon-pink)]">
                        ⚠️ {analysisResult.error}
                      </p>
                      {analysisResult.solution && (
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                          💡 <b>解决方案:</b> {analysisResult.solution}
                        </p>
                      )}
                      {/* 数据诊断信息 */}
                      {analysisResult.diagnostic && (
                        <details className="mt-3">
                          <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                            查看数据诊断
                          </summary>
                          <div className="mt-2 p-2 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-muted)] overflow-auto max-h-32">
                            <pre>{JSON.stringify(analysisResult.diagnostic, null, 2)}</pre>
                          </div>
                        </details>
                      )}
                      {/* 样本数据 */}
                      {analysisResult.sample_data && analysisResult.sample_data.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                            查看样本数据
                          </summary>
                          <div className="mt-2 p-2 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-muted)] overflow-auto max-h-32">
                            <pre>{JSON.stringify(analysisResult.sample_data, null, 2)}</pre>
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  
                  {/* 预测数据展示 */}
                  {analysisResult?.forecast || analysisResult?.historical_data ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-muted)]">预测均值</p>
                          <p className="text-xl font-bold text-[var(--neon-cyan)] mono">
                            {analysisResult.statistics?.forecast_mean?.toFixed(2) || 
                             (analysisResult.forecast?.yhat && (analysisResult.forecast.yhat.reduce((a: number, b: number) => a + b, 0) / analysisResult.forecast.yhat.length).toFixed(2)) ||
                             '-'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-muted)]">趋势</p>
                          <p className="text-xl font-bold text-[var(--neon-green)]">
                            {analysisResult.statistics?.trend_direction || 
                             analysisResult.trend?.direction || 
                             '-'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-muted)]">预测天数</p>
                          <p className="text-xl font-bold text-[var(--neon-purple)] mono">
                            {analysisResult.forecast_periods || forecastDays}天
                          </p>
                        </div>
                      </div>
                      
                      {/* AI 智能解读 */}
                      {analysisResult.ai_summary && (
                        <div className="p-4 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                          <p className="text-sm font-medium text-[var(--neon-cyan)] mb-2">🤖 AI 智能解读</p>
                          <p className="text-sm text-[var(--text-primary)] whitespace-pre-line">
                            {analysisResult.ai_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      {analysisResult?.error ? '预测失败' : '预测完成，数据已生成'}
                    </div>
                  )}
                  
                  {/* 调试信息 - 数据为空时显示原始数据结构 */}
                  {!analysisResult?.forecast && !analysisResult?.historical_data && !analysisResult?.error && (
                    <details className="mt-4 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                      <summary className="p-2 text-xs text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-tertiary)]">
                        查看原始数据 (调试)
                      </summary>
                      <div className="p-2 overflow-auto max-h-48">
                        <pre className="text-[10px] text-[var(--text-muted)]">
                          {JSON.stringify(analysisResult, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>

              {/* 预测分解 - 电商特性 */}
              {analysisResult?.decomposition && (
                <Card className="glass border-[var(--border-subtle)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-[var(--neon-purple)]" />
                      预测分解
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">趋势成分</p>
                        <p className="text-lg font-bold text-[var(--neon-cyan)]">
                          {analysisResult.decomposition.trend?.toFixed(1) || '-'}%
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">季节性</p>
                        <p className="text-lg font-bold text-[var(--neon-green)]">
                          {analysisResult.decomposition.seasonal?.toFixed(1) || '-'}%
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">促销效应</p>
                        <p className="text-lg font-bold text-[var(--neon-pink)]">
                          {analysisResult.decomposition.promotion?.toFixed(1) || '-'}%
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">异常波动</p>
                        <p className="text-lg font-bold text-[var(--neon-orange)]">
                          {analysisResult.decomposition.residual?.toFixed(1) || '-'}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 大促影响分析 */}
              {analysisResult?.promotion_impact && analysisResult.promotion_impact.length > 0 && (
                <Card className="glass border-[var(--neon-pink)]/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[var(--neon-pink)]" />
                      大促影响分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisResult.promotion_impact.map((impact: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-[var(--bg-secondary)]">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              impact.type === 'burst' ? 'bg-[var(--neon-pink)]' :
                              impact.type === 'preheat' ? 'bg-[var(--neon-orange)]' : 'bg-[var(--neon-green)]'
                            }`} />
                            <span className="text-sm text-[var(--text-primary)]">{impact.name}</span>
                            <span className="text-xs text-[var(--text-muted)]">{impact.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--neon-pink)]">+{impact.lift?.toFixed(0)}%</span>
                            <span className="text-xs text-[var(--text-muted)]">销量提升</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* What-if 分析结果 */}
              {analysisResult?.what_if && (
                <Card className="glass border-[var(--neon-purple)]/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[var(--neon-purple)]" />
                      What-if 分析结果
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 各变量影响 */}
                      <div className="space-y-2">
                        {analysisResult.what_if.adjustments?.map((adj: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-[var(--bg-secondary)]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--text-primary)]">{adj.variable}</span>
                              <span className={`text-xs ${
                                adj.adjustment > 0 ? 'text-[var(--neon-green)]' : 
                                adj.adjustment < 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--text-muted)]'
                              }`}>
                                {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-sm font-bold ${
                                adj.impact > 0 ? 'text-[var(--neon-green)]' : 
                                adj.impact < 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--text-muted)]'
                              }`}>
                                {adj.impact > 0 ? '+' : ''}{adj.impact.toFixed(1)}%
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">销量影响</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 总影响 */}
                      <div className="p-3 rounded-lg border border-[var(--neon-purple)]/30 bg-[var(--neon-purple)]/5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-primary)]">总销量影响</span>
                          <span className={`text-2xl font-bold ${
                            analysisResult.what_if.total_impact > 0 ? 'text-[var(--neon-green)]' : 
                            analysisResult.what_if.total_impact < 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--text-muted)]'
                          }`}>
                            {analysisResult.what_if.total_impact > 0 ? '+' : ''}
                            {analysisResult.what_if.total_impact.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          基于当前变量调整，预测销量将
                          {analysisResult.what_if.total_impact > 0 ? '增长' : '下降'}
                          {Math.abs(analysisResult.what_if.total_impact).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisResult?.ai_summary && (
                <Card className="glass border-[var(--neon-cyan)]/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <Brain className="w-5 h-5 text-[var(--neon-cyan)]" />
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
                    
                    const rows: any[] = [];
                    rows.push(['预测分析报告']);
                    rows.push(['生成时间', new Date().toLocaleString()]);
                    rows.push(['数据集', datasetInfo?.filename || '']);
                    rows.push(['日期列', dateColumn || '自动检测']);
                    rows.push(['预测目标列', valueColumn || '自动检测']);
                    rows.push(['预测天数', forecastDays]);
                    rows.push([]);
                    
                    // 统计汇总
                    rows.push(['预测统计']);
                    rows.push(['预测均值', analysisResult.statistics?.forecast_mean?.toFixed(2) || '-']);
                    rows.push(['趋势方向', analysisResult.trend?.direction || '-']);
                    rows.push([]);
                    
                    // 预测数据
                    if (analysisResult.forecast && Array.isArray(analysisResult.forecast)) {
                      rows.push(['预测数据']);
                      rows.push(['日期', '预测值', '下限', '上限']);
                      analysisResult.forecast.forEach((item: any) => {
                        rows.push([
                          item.date || item.ds || '',
                          item.value || item.yhat || '',
                          item.lower || item.yhat_lower || '',
                          item.upper || item.yhat_upper || ''
                        ]);
                      });
                    }
                    
                    // AI解读
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
                    link.download = `预测分析_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    toast.success('CSV导出成功');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出CSV
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 导入营销日历对话框 */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-subtle)] max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
              导入营销日历
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
                <p className="mb-2">支持 CSV/Excel 格式，需包含以下列：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>第1列：活动名称（如：新年圣诞）</li>
                  <li>第2列：活动日期（如：2026-01-07 或 1.7）</li>
                  <li>第3列：活动类型（可选：burst/festival/preheat/return）</li>
                  <li>第4列：影响系数（可选：1.0-3.0）</li>
                </ul>
                <p className="mt-2 text-[var(--neon-cyan)]">示例：新年圣诞, 2026-01-07, burst, 2.0</p>
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  选择文件（.csv 或 .xlsx）
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handlePromotionImport}
                  className="w-full text-sm text-[var(--text-primary)] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[var(--neon-cyan)]/20 file:text-[var(--neon-cyan)] hover:file:bg-[var(--neon-cyan)]/30"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="flex-1 py-2 rounded text-sm border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
