import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Settings2, 
  PieChart,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  Users,
  MousePointerClick,
  Clock,
  Target,
  BarChart3,
  GitBranch
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
import * as echarts from 'echarts';

interface ColumnInfo {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
  sample?: any[];
}

// 导出给DataTypeValidation使用
export type { ColumnInfo };

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
    'visit_time', 'click_time', 'session_time', 'dt', 'ts', '时间', '日期'];
  if (timeKeywords.some(kw => nameLower.includes(kw))) {
    return true;
  }
  
  // 3. 基于样本值（简单检查）
  if (col.sample && col.sample.length > 0) {
    const sample = String(col.sample[0]);
    // 检查常见的日期格式：2024-01-01, 2024/01/01, 01/01/2024, Jan 01 2024 等
    const datePatterns = [
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/,  // 2024-01-01, 2024/01/01
      /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/,  // 01/01/2024
      /^\d{1,2}:\d{2}:\d{2}/,            // 12:34:56
      /^\d{4}\d{2}\d{2}/,                 // 20240101
      /^[A-Za-z]{3,}\s+\d{1,2}/,          // Jan 01
    ];
    if (datePatterns.some(p => p.test(sample))) {
      return true;
    }
  }
  
  return false;
};

const ATTRIBUTION_MODELS = [
  { 
    key: 'first_touch', 
    name: '首次触点', 
    description: '100%功劳归第一个触点', 
    color: '#00f5ff',
    useCase: '品牌认知分析',
    scenario: '适用于重视品牌首次曝光的场景，如品牌推广、新品发布。帮助识别哪些渠道最能带来新用户认知。',
    example: '例：用户通过抖音广告首次了解产品，无论后续经过多少渠道，功劳都归抖音。'
  },
  { 
    key: 'last_touch', 
    name: '末次触点', 
    description: '100%功劳归最后一个触点', 
    color: '#b829f7',
    useCase: '成交促成分析',
    scenario: '适用于关注最终转化渠道的场景，如销售促成、促销活动。帮助识别直接带来转化的渠道。',
    example: '例：用户经过搜索→官网→客服咨询→微信下单，功劳归微信。'
  },
  { 
    key: 'linear', 
    name: '线性归因', 
    description: '平均分配给所有触点', 
    color: '#00ff9d',
    useCase: '全链路均衡评估',
    scenario: '适用于重视用户体验全链路的场景，如长周期决策、B2B销售。公平看待每个触点的作用。',
    example: '例：用户经过5个触点，每个触点获得20%的功劳。'
  },
  { 
    key: 'time_decay', 
    name: '时间衰减', 
    description: '越近的触点权重越高', 
    color: '#ffaa00',
    useCase: '短期决策分析',
    scenario: '适用于决策周期短、近期行为影响大的场景，如快消品、限时促销。强调近期触点的推动作用。',
    example: '例：昨天看到的广告比上周的权重高，距离转化越近的触点功劳越大。'
  },
  { 
    key: 'position_based', 
    name: '位置归因', 
    description: '首触点40%、末触点40%、中间平分20%', 
    color: '#ff0080',
    useCase: '入口出口兼顾分析',
    scenario: '适用于同时重视获客和转化的场景，如电商运营、会员营销。既看获客能力，又看转化能力。',
    example: '例：首次接触的渠道和最终下单的渠道各拿40%，中间辅助渠道共拿20%。'
  },
  { 
    key: 'shapley', 
    name: 'Shapley值', 
    description: '基于博弈论的公平分配', 
    color: '#3b82f6',
    useCase: '科学公平评估',
    scenario: '适用于需要最科学、最公平评估的场景，如预算分配、渠道谈判。基于数学博弈论，消除顺序影响。',
    example: '例：计算每个渠道在所有可能的组合中的边际贡献平均值，最客观的分配方式。'
  },
];

export function Attribution() {
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 归因分析配置
  const [userIdCol, setUserIdCol] = useState('');
  const [touchpointCol, setTouchpointCol] = useState('');
  const [additionalTouchpointCols, setAdditionalTouchpointCols] = useState<string[]>([]);  // 联合触点列（支持多选）
  const [timestampCol, setTimestampCol] = useState('');
  const [conversionCol, setConversionCol] = useState('');
  const [conversionValueCol, setConversionValueCol] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['first_touch', 'last_touch', 'linear']);

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setColumns([]);
      return;
    }

    const loadDatasetInfo = async () => {
      // 切换数据集时清空列信息，避免显示旧数据集的验证结果
      setColumns([]);
      setUserIdCol('');
      setTouchpointCol('');
      setTimestampCol('');
      
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data || res);
        
        const schema = res.schema || res.data?.schema;
        console.log('Dataset schema:', schema);
        
        if (schema && Array.isArray(schema) && schema.length > 0) {
          const cols: ColumnInfo[] = schema.map((field: any) => {
            // 支持多种字段名格式
            const dtype = (field.dtype || field.type || field.data_type || 'unknown')?.toLowerCase() || '';
            let type: ColumnInfo['type'] = 'other';
            if (dtype.includes('int') || dtype.includes('float') || dtype.includes('number') || dtype.includes('double') || dtype.includes('decimal')) {
              type = 'numeric';
            } else if (dtype.includes('date') || dtype.includes('time') || dtype.includes('timestamp')) {
              type = 'datetime';
            } else if (dtype.includes('str') || dtype.includes('cat') || dtype.includes('object') || dtype.includes('text') || dtype.includes('varchar')) {
              type = 'categorical';
            }
            return { 
              name: field.name || field.column || field.column_name || 'unknown', 
              dtype: field.dtype || field.type || field.data_type || 'unknown', 
              type,
              sample: field.sample || field.sample_values || field.samples || []
            };
          });
          console.log('Parsed columns:', cols);
          setColumns(cols);
          
          // 自动推荐列
          const suggestedUserId = cols.find(c => 
            c.name.toLowerCase().includes('user') || 
            c.name.toLowerCase().includes('id')
          )?.name;
          const suggestedTouchpoint = cols.find(c => 
            c.name.toLowerCase().includes('channel') || 
            c.name.toLowerCase().includes('source') ||
            c.name.toLowerCase().includes('touchpoint') ||
            c.name.toLowerCase().includes('page')
          )?.name;
          // 使用智能识别函数推荐时间列
          const suggestedTimestamp = cols.find(c => isLikelyDateTimeColumn(c))?.name;
          
          if (suggestedUserId) setUserIdCol(suggestedUserId);
          if (suggestedTouchpoint) setTouchpointCol(suggestedTouchpoint);
          if (suggestedTimestamp) setTimestampCol(suggestedTimestamp);
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

  useEffect(() => {
    if (analysisResult?.models && chartRef.current) {
      renderComparisonChart();
    }
    return () => {
      chartInstance.current?.dispose();
    };
  }, [analysisResult]);

  const renderComparisonChart = () => {
    if (!chartRef.current || !analysisResult?.models) return;
    
    chartInstance.current?.dispose();
    chartInstance.current = echarts.init(chartRef.current);

    const models = Object.keys(analysisResult.models);
    const touchpoints = Object.keys(analysisResult.models[models[0]] || {});
    
    const series = models.map(modelKey => {
      const modelData = analysisResult.models[modelKey];
      const modelInfo = ATTRIBUTION_MODELS.find(m => m.key === modelKey);
      return {
        name: modelInfo?.name || modelKey,
        type: 'bar',
        data: touchpoints.map(tp => modelData[tp]?.percentage || 0),
        itemStyle: { color: modelInfo?.color }
      };
    });

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: '各模型归因对比',
        textStyle: { color: '#e2e8f0', fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(21, 27, 61, 0.95)',
        borderColor: 'rgba(0, 245, 255, 0.3)',
        textStyle: { color: '#e2e8f0' }
      },
      legend: {
        data: series.map(s => s.name),
        textStyle: { color: '#94a3b8' },
        bottom: 0
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: touchpoints,
        axisLabel: { color: '#94a3b8', rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } }
      },
      yAxis: {
        type: 'value',
        name: '贡献度(%)',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } }
      },
      series
    };

    chartInstance.current.setOption(option);
  };

  const handleAnalyze = async () => {
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }
    if (!userIdCol || !touchpointCol || !timestampCol) {
      toast.error('请配置必需的列（用户ID、触点、时间戳）');
      return;
    }
    if (selectedModels.length === 0) {
      toast.error('请至少选择一种归因模型');
      return;
    }

    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);

    try {
      const params: any = {
        user_id_col: userIdCol,
        touchpoint_col: touchpointCol,
        timestamp_col: timestampCol,
        models: selectedModels
      };
      
      if (additionalTouchpointCols.length > 0) params.additional_touchpoint_cols = additionalTouchpointCols;
      if (conversionCol) params.conversion_col = conversionCol;
      if (conversionValueCol) params.conversion_value_col = conversionValueCol;

      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'attribution',
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

  const pollResult = async (analysisId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const checkResult = async () => {
      try {
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

  return (
    <div className="space-y-6">
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          归因分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          分析用户转化路径，量化各触点的贡献价值
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
                  analysisType="attribution" 
                />
              )}

              {/* 配置说明 */}
              <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <details className="text-xs">
                  <summary className="cursor-pointer text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    配置参数说明
                  </summary>
                  <div className="mt-2 space-y-2 text-[var(--text-secondary)]">
                    <p><span className="text-[var(--neon-purple)]">用户ID列：</span>唯一标识用户的列，用于区分不同用户的旅程。可以是用户ID、设备ID、会话ID等。</p>
                    <p><span className="text-[var(--neon-purple)]">触点/渠道列：</span>记录用户接触点的列，如渠道来源、页面名称、广告系列等。</p>
                    <p><span className="text-[var(--neon-purple)]">时间戳列：</span>记录事件发生时间的列，支持datetime、string、date等格式。</p>
                    <p><span className="text-[var(--neon-purple)]">转化标记列（可选）：</span>标记是否发生转化的列（0/1或true/false）。不选则默认所有记录都是触点。</p>
                    <p><span className="text-[var(--neon-purple)]">转化价值列（可选）：</span>转化的金额或价值，如订单金额、收益等。不选则默认每个转化价值为1。</p>
                    <p className="text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                      数据要求：每行代表一个触点事件，系统会按用户ID和时间戳自动构建用户旅程。
                    </p>
                  </div>
                </details>
              </div>

              {columns.length > 0 && (
                <>
                  {/* 必需列配置 */}
                  <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                    <p className="text-xs text-[var(--neon-cyan)] font-medium">必需配置</p>
                    
                    {/* 用户ID列 */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Users className="w-3 h-3" /> 用户ID列
                      </label>
                      <select
                        value={userIdCol}
                        onChange={(e) => setUserIdCol(e.target.value)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="">选择列</option>
                        {columns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 触点列 */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> 触点/渠道列
                      </label>
                      <select
                        value={touchpointCol}
                        onChange={(e) => setTouchpointCol(e.target.value)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="">选择列</option>
                        {columns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 联合触点列（可选，支持多选） */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        联合触点列（可选，可多选）
                      </label>
                      <div className="max-h-32 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded p-2 space-y-1">
                        {columns.filter(c => c.name !== touchpointCol).map(col => (
                          <label key={col.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-hover)] p-1 rounded">
                            <input
                              type="checkbox"
                              checked={additionalTouchpointCols.includes(col.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAdditionalTouchpointCols([...additionalTouchpointCols, col.name]);
                                } else {
                                  setAdditionalTouchpointCols(additionalTouchpointCols.filter(c => c !== col.name));
                                }
                              }}
                              className="rounded border-[var(--border-subtle)]"
                            />
                            <span className="text-[var(--text-primary)]">{col.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        例如：选择 block_type 与 page 联合为 "page_block_type"（最多选3列）
                      </p>
                    </div>

                    {/* 时间戳列 */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 时间戳列
                      </label>
                      <select
                        value={timestampCol}
                        onChange={(e) => setTimestampCol(e.target.value)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="">选择列</option>
                        <optgroup label="推荐的时间列">
                          {columns.filter(c => isLikelyDateTimeColumn(c)).map(col => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="其他列">
                          {columns.filter(c => !isLikelyDateTimeColumn(c)).map(col => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        支持 datetime、string、date 等格式，系统会自动解析
                      </p>
                    </div>
                  </div>

                  {/* 可选列配置 */}
                  <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                    <p className="text-xs text-[var(--text-muted)]">可选配置</p>
                    
                    {/* 转化标记列 */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Target className="w-3 h-3" /> 转化标记列
                      </label>
                      <select
                        value={conversionCol}
                        onChange={(e) => setConversionCol(e.target.value)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="">无</option>
                        {columns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 转化价值列 */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> 转化价值列
                      </label>
                      <select
                        value={conversionValueCol}
                        onChange={(e) => setConversionValueCol(e.target.value)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="">无</option>
                        {columns.filter(c => c.type === 'numeric').map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 归因模型选择 */}
                  <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> 归因模型
                      </p>
                      <span className="text-[10px] text-[var(--neon-cyan)]">
                        已选 {selectedModels.length} 个
                      </span>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ATTRIBUTION_MODELS.map(model => (
                        <div 
                          key={model.key} 
                          className={`p-3 rounded border transition-all ${
                            selectedModels.includes(model.key)
                              ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/5'
                              : 'border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50'
                          }`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedModels.includes(model.key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedModels([...selectedModels, model.key]);
                                } else {
                                  setSelectedModels(selectedModels.filter(m => m !== model.key));
                                }
                              }}
                              className="rounded mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.color }} />
                                <p className="text-sm font-medium text-[var(--text-primary)]">{model.name}</p>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]">
                                  {model.useCase}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-1">{model.description}</p>
                              
                              {/* 业务场景说明 */}
                              {selectedModels.includes(model.key) && (
                                <div className="mt-2 p-2 rounded bg-[var(--bg-tertiary)] text-xs space-y-1">
                                  <p className="text-[var(--text-secondary)]">
                                    <span className="text-[var(--neon-purple)]">适用场景：</span>
                                    {model.scenario}
                                  </p>
                                  <p className="text-[var(--text-muted)] italic">{model.example}</p>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedDataset}
                className="w-full bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
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
            </CardContent>
          )}
        </Card>

        {/* 结果展示 */}
        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <PieChart className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">配置分析参数并启动</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">归因分析结果将在此显示</p>
              </div>
            </Card>
          ) : (
            <div ref={resultRef} className="space-y-6">
              {/* 汇总统计 */}
              {analysisResult?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-[var(--text-muted)]">用户旅程数</p>
                      <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                        {analysisResult.user_journey_count?.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-[var(--text-muted)]">总转化数</p>
                      <p className="text-2xl font-bold text-[var(--neon-purple)]">
                        {analysisResult.total_conversions?.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-[var(--text-muted)]">转化率</p>
                      <p className="text-2xl font-bold text-[var(--neon-green)]">
                        {analysisResult.summary?.conversion_rate}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-[var(--text-muted)]">平均触点数</p>
                      <p className="text-2xl font-bold text-[var(--neon-orange)]">
                        {analysisResult.summary?.avg_touchpoints_per_journey}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 对比图表 */}
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)]">
                    模型对比分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div ref={chartRef} className="w-full h-80" />
                </CardContent>
              </Card>

              {/* 各模型详细结果 */}
              {analysisResult?.models && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(analysisResult.models).map(([modelKey, modelData]: [string, any]) => {
                    const modelInfo = ATTRIBUTION_MODELS.find(m => m.key === modelKey);
                    return (
                      <Card key={modelKey} className="glass border-[var(--border-subtle)]">
                        <CardHeader>
                          <CardTitle className="text-base text-[var(--text-primary)] flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: modelInfo?.color }} />
                            {modelInfo?.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(modelData).slice(0, 5).map(([touchpoint, data]: [string, any]) => (
                              <div key={touchpoint} className="flex items-center justify-between">
                                <span className="text-sm text-[var(--text-secondary)]">{touchpoint}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                                    <div 
                                      className="h-full rounded-full" 
                                      style={{ 
                                        width: `${data.percentage}%`,
                                        backgroundColor: modelInfo?.color 
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-[var(--neon-cyan)] w-12 text-right">
                                    {data.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* 模型对比表 */}
              {analysisResult?.summary?.model_comparison && (
                <Card className="glass border-[var(--border-subtle)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)]">
                      各模型Top3触点对比
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <th className="text-left p-2 text-[var(--text-muted)]">模型</th>
                            <th className="text-left p-2 text-[var(--text-muted)]">Top1</th>
                            <th className="text-left p-2 text-[var(--text-muted)]">Top2</th>
                            <th className="text-left p-2 text-[var(--text-muted)]">Top3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResult.summary.model_comparison.map((item: any) => (
                            <tr key={item.model} className="border-b border-[var(--border-subtle)]">
                              <td className="p-2 text-[var(--text-primary)] font-medium">
                                {item.model_name}
                              </td>
                              {item.top3.map((tp: any, i: number) => (
                                <td key={i} className="p-2">
                                  <span className="text-[var(--text-secondary)]">{tp.touchpoint}</span>
                                  <span className="text-xs text-[var(--neon-cyan)] ml-1">({tp.percentage}%)</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 下载结果 */}
              {analysisResult?.models && (
                <Card className="glass border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          导出归因分析结果
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          将各模型的归因数据导出为CSV格式
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-[var(--bg-primary)]"
                        onClick={() => {
                          if (!analysisResult?.models) return;
                          
                          // 构建CSV数据
                          const rows: any[] = [];
                          
                          // 添加汇总信息
                          rows.push(['归因分析报告']);
                          rows.push(['生成时间', new Date().toLocaleString()]);
                          rows.push(['用户旅程数', analysisResult.user_journey_count || 0]);
                          rows.push(['总转化数', analysisResult.total_conversions || 0]);
                          rows.push(['总转化价值', analysisResult.total_conversion_value || 0]);
                          rows.push([]);
                          
                          // 添加各模型的详细数据
                          Object.entries(analysisResult.models).forEach(([modelKey, modelData]: [string, any]) => {
                            const modelInfo = ATTRIBUTION_MODELS.find(m => m.key === modelKey);
                            rows.push([`${modelInfo?.name || modelKey} 归因结果`]);
                            rows.push(['触点', '贡献值', '贡献度(%)']);
                            
                            Object.entries(modelData).forEach(([touchpoint, data]: [string, any]) => {
                              rows.push([touchpoint, data.value, data.percentage]);
                            });
                            rows.push([]);
                          });
                          
                          // 添加模型对比
                          if (analysisResult.summary?.model_comparison) {
                            rows.push(['模型对比']);
                            rows.push(['模型', 'Top1触点', 'Top1占比(%)', 'Top2触点', 'Top2占比(%)', 'Top3触点', 'Top3占比(%)']);
                            analysisResult.summary.model_comparison.forEach((item: any) => {
                              const row = [item.model_name];
                              item.top3.forEach((tp: any) => {
                                row.push(tp.touchpoint, tp.percentage);
                              });
                              rows.push(row);
                            });
                          }
                          
                          // 转换为CSV格式
                          const csvContent = rows.map((row: any[]) => 
                            row.map((cell: any) => {
                              const str = String(cell ?? '');
                              if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                                return `"${str.replace(/"/g, '""')}"`;
                              }
                              return str;
                            }).join(',')
                          ).join('\n');
                          
                          // 添加BOM以支持中文
                          const BOM = '\uFEFF';
                          const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement('a');
                          const url = URL.createObjectURL(blob);
                          link.href = url;
                          link.download = `归因分析_${new Date().toISOString().slice(0, 10)}.csv`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          
                          toast.success('下载成功');
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
