import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { companionService } from '@/services';
import { 
  Play, 
  Users,
  MousePointerClick,
  Clock,
  Target,
  BarChart3,
  GitBranch,
  Loader2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
import { DataTypeValidation } from '@/components/DataTypeValidation';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import gsap from 'gsap';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select";
import {
  AnalysisPageShell,
  AnalysisConfigPanel,
  AnalysisResultPanel,
  AnalysisActionBar,
} from '@/components/analysis';
import { ResultView } from '@/components/results';
import { toAttributionAnalysisResult } from '@/lib/adapters/attributionResultAdapter';
import {
  clearAnalysisPrefill,
  getFirstExactSuggestedColumn,
  getSuggestedColumns,
  readAnalysisPrefill,
} from '@/lib/assistant/prefillNavigation';
import type { AnalysisPrefillPayload } from '@/types/assistant';

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
  const location = useLocation();

  // 设置当前页面
  useEffect(() => {
    companionService.setPage('attribution');
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 归因分析配置
  const [userIdCol, setUserIdCol] = useState('');
  const [touchpointCol, setTouchpointCol] = useState('');
  const [additionalTouchpointCols, setAdditionalTouchpointCols] = useState<string[]>([]);  // 联合触点列（支持多选）
  const [timestampCol, setTimestampCol] = useState('');
  const [conversionCol, setConversionCol] = useState('');
  const [conversionValueCol, setConversionValueCol] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['first_touch', 'last_touch', 'linear']);
  const [prefillPayload, setPrefillPayload] = useState<AnalysisPrefillPayload | null>(null);
  const [prefillFieldsApplied, setPrefillFieldsApplied] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(location.search).get('prefill');
    if (!key) return;

    const payload = readAnalysisPrefill(key);
    clearAnalysisPrefill(key);

    if (!payload || payload.analysis_type !== 'attribution') return;

    setPrefillPayload(payload);
    setPrefillFieldsApplied(false);

    const datasetId = payload.primary_dataset_id || payload.dataset_ids[0];
    if (datasetId) {
      setSelectedDataset(datasetId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!prefillPayload || prefillFieldsApplied || columns.length === 0) return;

    const availableColumns = columns.map((column) => column.name);
    const suggestedUserId = getFirstExactSuggestedColumn(prefillPayload, 'user_id', availableColumns);
    const suggestedTouchpoint = getFirstExactSuggestedColumn(prefillPayload, 'dimension', availableColumns);
    const suggestedTimestamp = getFirstExactSuggestedColumn(
      prefillPayload,
      'time_column',
      availableColumns
    );
    const suggestedMetric = getFirstExactSuggestedColumn(
      prefillPayload,
      'target_metric',
      availableColumns
    );

    if (suggestedUserId) setUserIdCol(suggestedUserId);
    if (suggestedTouchpoint) setTouchpointCol(suggestedTouchpoint);
    if (suggestedTimestamp) setTimestampCol(suggestedTimestamp);
    if (suggestedMetric) setConversionValueCol(suggestedMetric);
    setPrefillFieldsApplied(true);
  }, [columns, prefillFieldsApplied, prefillPayload]);

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

  const handleExportCSV = () => {
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
  };

  return (
    <AnalysisPageShell
      title="归因分析"
      description="分析用户转化路径，量化各触点的贡献价值"
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
                  正在进行归因分析，请稍候...
                </p>
              )}
            </>
          }
        >
          {/* 数据集选择 */}
          {prefillPayload && (
            <div className="rounded-lg border border-[var(--neon-cyan)]/25 bg-[var(--neon-cyan)]/10 p-3 text-xs text-[var(--text-secondary)]">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[var(--neon-cyan)] mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-[var(--text-primary)]">来自 AI 工作台的预填建议</p>
                  <p>这些配置尚未运行分析，请确认数据集和字段后再点击运行。</p>
                  {prefillPayload.suggested_fields && prefillPayload.suggested_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(
                        new Set(
                          ['user_id', 'dimension', 'time_column', 'target_metric'].flatMap((role) =>
                            getSuggestedColumns(
                              prefillPayload,
                              role as 'user_id' | 'dimension' | 'time_column' | 'target_metric'
                            )
                          )
                        )
                      ).slice(0, 8).map((field) => (
                        <span key={field} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px]">
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  <Select value={userIdCol || "none"} onValueChange={(v) => setUserIdCol(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder="选择列" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">选择列</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 触点列 */}
                <div className="space-y-1">
                  <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3" /> 触点/渠道列
                  </label>
                  <Select value={touchpointCol || "none"} onValueChange={(v) => setTouchpointCol(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder="选择列" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">选择列</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={timestampCol || "none"} onValueChange={(v) => setTimestampCol(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder="选择列" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">选择列</SelectItem>
                      <SelectGroup>
                        <SelectLabel>推荐的时间列</SelectLabel>
                        {columns.filter(c => isLikelyDateTimeColumn(c)).map(col => (
                          <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>其他列</SelectLabel>
                        {columns.filter(c => !isLikelyDateTimeColumn(c)).map(col => (
                          <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                  <Select value={conversionCol || "none"} onValueChange={(v) => setConversionCol(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder="无" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 转化价值列 */}
                <div className="space-y-1">
                  <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> 转化价值列
                  </label>
                  <Select value={conversionValueCol || "none"} onValueChange={(v) => setConversionValueCol(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder="无" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {columns.filter(c => c.type === 'numeric').map(col => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        </AnalysisConfigPanel>

        <AnalysisResultPanel
          loading={isAnalyzing && !showResult}
          loadingMessage="正在分析数据，请稍候..."
          empty={!showResult && !isAnalyzing}
          emptyTitle="配置分析参数并启动"
          emptyDescription="归因分析结果将在此显示"
          actions={showResult ? (
            <AnalysisActionBar onExportCSV={handleExportCSV} />
          ) : undefined}
        >
          {showResult && (
            <div ref={resultRef} className="space-y-6">
              {/* 统一结果视图 */}
              {(() => {
                const converted = toAttributionAnalysisResult(
                  analysisResult,
                  datasetInfo
                );
                return converted ? (
                  <ResultView result={converted} />
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <p>分析完成，但未返回归因数据</p>
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
