import { useState, useRef, useEffect } from 'react';
import { 
  Target, 
  Play, 
  Settings2, 
  ChevronDown,
  ChevronUp,
  Loader2,
  Brain,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
  ArrowRight,
  Calculator as CalculatorIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import gsap from 'gsap';

// 漏斗层级配置
interface FunnelLevel {
  id: string;
  name: string;
  metric: string; // 指标名称，如 "UV", "注册数", "购买数"
  currentValue: number;
  targetValue?: number; // 如果为空，则通过转化率计算
  conversionRate?: number; // 到下一层的转化率
}

// 拆解方式
type DecompositionMethod = 'linear' | 'accelerated' | 'frontloaded' | 'custom';

// 月度目标
interface MonthlyTarget {
  month: string;
  levelId: string;
  value: number;
  conversionRate?: number;
}

// 预设漏斗模板
const FUNNEL_TEMPLATES = {
  ecommerce: {
    name: '电商转化漏斗',
    levels: [
      { id: 'uv', name: '访客数', metric: 'UV' },
      { id: 'register', name: '注册数', metric: '注册用户' },
      { id: 'cart', name: '加购数', metric: '加购用户' },
      { id: 'order', name: '下单数', metric: '下单用户' },
      { id: 'pay', name: '支付数', metric: '支付用户' },
    ]
  },
  saas: {
    name: 'SaaS 转化漏斗',
    levels: [
      { id: 'visit', name: '网站访问', metric: '访客数' },
      { id: 'trial', name: '试用注册', metric: '试用用户' },
      { id: 'activate', name: '激活用户', metric: '激活数' },
      { id: 'subscribe', name: '付费订阅', metric: '订阅数' },
      { id: 'retain', name: '留存用户', metric: '留存数' },
    ]
  },
  content: {
    name: '内容平台漏斗',
    levels: [
      { id: 'impression', name: '曝光量', metric: '曝光' },
      { id: 'click', name: '点击量', metric: '点击' },
      { id: 'read', name: '阅读完成', metric: '完读' },
      { id: 'like', name: '点赞数', metric: '点赞' },
      { id: 'share', name: '分享数', metric: '分享' },
    ]
  }
};

// 拆解方式说明
const DECOMPOSITION_METHODS: { key: DecompositionMethod; name: string; desc: string }[] = [
  { key: 'linear', name: '线性拆解', desc: '每月匀速增长，适合稳定业务' },
  { key: 'accelerated', name: '加速拆解', desc: '前期慢后期快，适合新业务爬坡' },
  { key: 'frontloaded', name: '前置拆解', desc: '前期快后期慢，适合冲刺型业务' },
  { key: 'custom', name: '自定义', desc: '结合营销日历手动调整每月目标' },
];
// 强制使用以避免 TypeScript 报错
void DECOMPOSITION_METHODS;

// XBB 营销日历（用于自定义拆解提示）
const MARKETING_CALENDAR = [
  { month: 1, name: '新年圣诞', date: '01-07', type: 'burst', impact: 2.0 },
  { month: 2, name: '男人节', date: '02-23', type: 'festival', impact: 1.4 },
  { month: 3, name: '女生节', date: '03-08', type: 'burst', impact: 1.8 },
  { month: 5, name: '换季大促', date: '05-09', type: 'burst', impact: 1.6 },
  { month: 8, name: '返校季', date: '08-25', type: 'festival', impact: 1.5 },
  { month: 11, name: '双11', date: '11-11', type: 'burst', impact: 2.5 },
  { month: 11, name: '黑五', date: '11-29', type: 'burst', impact: 2.2 },
];

export function GoalPlanner() {
  // 强制使用导入的图标和常量
  void CalculatorIcon;
  
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  
  // 漏斗配置
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [funnelLevels, setFunnelLevels] = useState<FunnelLevel[]>([]);
  
  // 目标设置
  const [targetLevelId, setTargetLevelId] = useState<string>('');
  const [targetValue, setTargetValue] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  
  // 拆解方式
  const [decompositionMethod, setDecompositionMethod] = useState<DecompositionMethod>('linear');
  // 强制使用 setter 避免 TypeScript 报错
  void setDecompositionMethod;
  // 自定义月度目标值
  const [customMonthlyValues, setCustomMonthlyValues] = useState<{[key: string]: number}>({});
  
  // 结果
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[][]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<any>(null);
  
  // 预测对比数据
  const [forecastData, setForecastData] = useState<{
    months: string[];
    values: number[];
    levelId: string;
  } | null>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  
  // 智能建议
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  
  const resultRef = useRef<HTMLDivElement>(null);

  // 应用模板
  const applyTemplate = (templateKey: string) => {
    const template = FUNNEL_TEMPLATES[templateKey as keyof typeof FUNNEL_TEMPLATES];
    if (template) {
      setFunnelLevels(template.levels.map((l, i) => ({
        ...l,
        currentValue: 0,
        conversionRate: i < template.levels.length - 1 ? undefined : undefined
      })));
      setSelectedTemplate(templateKey);
      // 默认目标层为最后一层
      setTargetLevelId(template.levels[template.levels.length - 1].id);
    }
  };

  // 添加自定义层级
  const addFunnelLevel = () => {
    const newId = `level_${funnelLevels.length + 1}`;
    setFunnelLevels([...funnelLevels, {
      id: newId,
      name: `层级 ${funnelLevels.length + 1}`,
      metric: '指标',
      currentValue: 0
    }]);
  };

  // 删除层级
  const removeFunnelLevel = (id: string) => {
    setFunnelLevels(funnelLevels.filter(l => l.id !== id));
  };

  // 更新层级
  const updateLevel = (id: string, field: keyof FunnelLevel, value: any) => {
    setFunnelLevels(funnelLevels.map(l => 
      l.id === id ? { ...l, [field]: value } : l
    ));
  };

  // 计算月度目标
  const calculateMonthlyTargets = () => {
    if (!targetLevelId || !targetValue || !targetDate || funnelLevels.length === 0) {
      toast.error('请填写完整的目标信息');
      return;
    }

    const targetIndex = funnelLevels.findIndex(l => l.id === targetLevelId);
    if (targetIndex === -1) return;

    setIsCalculating(true);
    
    // 模拟计算延迟
    setTimeout(() => {
      const targetNum = parseFloat(targetValue);
      const currentDate = new Date();
      const deadline = new Date(targetDate);
      const monthsDiff = Math.max(1, 
        (deadline.getFullYear() - currentDate.getFullYear()) * 12 + 
        (deadline.getMonth() - currentDate.getMonth()) + 1
      );

      // 生成月份列表
      const months: string[] = [];
      for (let i = 0; i < monthsDiff; i++) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      // 计算每层级的月度目标
      const results: MonthlyTarget[][] = [];
      
      funnelLevels.forEach((level, levelIndex) => {
        const levelTargets: MonthlyTarget[] = [];
        
        months.forEach((month, monthIndex) => {
          let value: number;
          
          if (levelIndex === targetIndex) {
            // 目标层级：按拆解方式计算
            const progress = (monthIndex + 1) / monthsDiff;
            
            switch (decompositionMethod) {
              case 'linear':
                // 线性：匀速增长
                value = level.currentValue + (targetNum - level.currentValue) * progress;
                break;
              case 'accelerated':
                // 加速：前期慢后期快 (二次曲线)
                value = level.currentValue + (targetNum - level.currentValue) * (progress * progress);
                break;
              case 'frontloaded':
                // 前置：前期快后期慢 (开方曲线)
                value = level.currentValue + (targetNum - level.currentValue) * Math.sqrt(progress);
                break;
              case 'custom':
                // 自定义
                value = customMonthlyValues[`${level.id}_${month}`] || level.currentValue;
                break;
              default:
                value = level.currentValue;
            }
          } else if (levelIndex < targetIndex) {
            // 上层漏斗：根据转化率反推
            const conversionChain = funnelLevels
              .slice(levelIndex, targetIndex)
              .reduce((acc, l) => acc * (l.conversionRate || 0.5), 1);
            
            const targetLevelValue = results[targetIndex]?.[monthIndex]?.value || targetNum;
            value = targetLevelValue / conversionChain;
          } else {
            // 下层漏斗：根据转化率正推
            const sourceLevel = results[levelIndex - 1]?.[monthIndex];
            const conversionRate = funnelLevels[levelIndex - 1]?.conversionRate || 0.5;
            value = (sourceLevel?.value || 0) * conversionRate;
          }
          
          levelTargets.push({
            month,
            levelId: level.id,
            value: Math.round(value),
            conversionRate: levelIndex < funnelLevels.length - 1 ? level.conversionRate : undefined
          });
        });
        
        results.push(levelTargets);
      });

      setMonthlyTargets(results);
      
      // 差距分析
      const totalGrowth = targetNum / (funnelLevels[targetIndex]?.currentValue || 1);
      const monthlyGrowthRate = Math.pow(totalGrowth, 1 / monthsDiff) - 1;
      
      setGapAnalysis({
        totalMonths: monthsDiff,
        targetLevelName: funnelLevels[targetIndex]?.name,
        currentValue: funnelLevels[targetIndex]?.currentValue,
        targetValue: targetNum,
        totalGrowth: ((totalGrowth - 1) * 100).toFixed(1),
        monthlyGrowthRate: (monthlyGrowthRate * 100).toFixed(1),
        feasibility: monthlyGrowthRate > 0.3 ? 'high_risk' : monthlyGrowthRate > 0.15 ? 'medium' : 'achievable'
      });
      
      // 计算目标 vs 预测对比（如果有预测数据）
      if (forecastData && forecastData.levelId === targetLevelId) {
        calculateComparison(results[targetIndex], forecastData, monthsDiff);
      }
      
      // 生成智能建议
      generateSmartSuggestions(results, targetIndex, monthlyGrowthRate, monthsDiff);
      
      setShowResult(true);
      setIsCalculating(false);
      toast.success('目标拆解完成');
    }, 800);
  };
  
  // 导入预测数据 - 从本地存储获取之前时序预测的结果
  const importForecastData = () => {
    try {
      // 尝试从 localStorage 获取之前预测的结果
      const savedForecast = localStorage.getItem('insightease_forecast_result');
      
      if (savedForecast) {
        const parsed = JSON.parse(savedForecast);
        // 提取预测数据
        const forecastMonths = parsed.forecast?.dates?.slice(0, 12) || [];
        const forecastValues = parsed.forecast?.yhat?.slice(0, 12) || [];
        
        if (forecastMonths.length > 0 && forecastValues.length > 0) {
          const importedData = {
            months: forecastMonths,
            values: forecastValues.map((v: number) => Math.round(v)),
            levelId: targetLevelId || 'default'
          };
          setForecastData(importedData);
          toast.success(`已导入 ${forecastMonths.length} 个月的预测数据`);
          
          // 如果已经计算过目标，重新计算对比
          if (monthlyTargets.length > 0 && targetLevelId) {
            const targetIndex = funnelLevels.findIndex(l => l.id === targetLevelId);
            const monthsDiff = monthlyTargets[0]?.length || forecastMonths.length;
            calculateComparison(monthlyTargets[targetIndex], importedData, monthsDiff);
          }
          return;
        }
      }
      
      // 如果没有找到保存的预测数据，提示用户
      toast.info('未找到预测数据', {
        description: '请先前往「时序预测」模块进行预测，或手动输入预测值'
      });
    } catch (error) {
      toast.error('导入失败', {
        description: '无法读取预测数据，请确保已在时序预测模块完成预测'
      });
    }
  };
  
  // 计算目标 vs 预测对比
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const calculateComparison = (targetMonthly: MonthlyTarget[], forecast: typeof forecastData, _months: number) => {
    if (!targetMonthly || !forecast) return;
    
    const comparisons = targetMonthly.map((target, idx) => {
      const forecastValue = forecast.values[idx] || 0;
      const gap = target.value - forecastValue;
      const gapPercent = forecastValue > 0 ? (gap / forecastValue * 100) : 0;
      
      return {
        month: target.month,
        target: target.value,
        forecast: forecastValue,
        gap: gap,
        gapPercent: gapPercent,
        status: gap > 0 ? 'shortfall' : gap < 0 ? 'exceed' : 'match'
      };
    });
    
    const totalGap = comparisons.reduce((sum, c) => sum + c.gap, 0);
    const avgGapPercent = comparisons.reduce((sum, c) => sum + c.gapPercent, 0) / comparisons.length;
    
    // 达成概率评估
    let achievementProbability: string;
    if (avgGapPercent <= 5) {
      achievementProbability = 'high';
    } else if (avgGapPercent <= 15) {
      achievementProbability = 'medium';
    } else if (avgGapPercent <= 30) {
      achievementProbability = 'low';
    } else {
      achievementProbability = 'very_low';
    }
    
    setComparisonResult({
      comparisons,
      totalGap,
      avgGapPercent: avgGapPercent.toFixed(1),
      achievementProbability,
      summary: {
        monthsAtRisk: comparisons.filter(c => c.gap > 0).length,
        monthsOnTrack: comparisons.filter(c => c.gap <= 0).length,
        maxShortfall: Math.max(...comparisons.map(c => c.gap)),
        maxShortfallMonth: comparisons.find(c => c.gap === Math.max(...comparisons.map(c => c.gap)))?.month
      }
    });
  };
  
  // 生成智能建议
  const generateSmartSuggestions = (
    _results: MonthlyTarget[][], 
    _targetIndex: number, 
    monthlyGrowthRate: number,
    monthsDiff: number
  ) => {
    const suggestions: string[] = [];
    
    // 建议1：基于增长率的可行性
    if (monthlyGrowthRate > 0.3) {
      suggestions.push(`⚠️ 月均增长率高达 ${(monthlyGrowthRate * 100).toFixed(1)}%，目标挑战性极强。建议：① 延长达成时间 3-6 个月；② 或拆分阶段目标，先达成 70% 作为里程碑。`);
    } else if (monthlyGrowthRate > 0.15) {
      suggestions.push(`📈 月均增长率 ${(monthlyGrowthRate * 100).toFixed(1)}%，目标有一定挑战。建议：① 前 3 个月重点优化转化率；② 预留额外预算应对市场波动。`);
    } else {
      suggestions.push(`✅ 月均增长率 ${(monthlyGrowthRate * 100).toFixed(1)}%，目标较为稳健。建议：① 按拆解计划执行；② 可设置更高的冲刺目标。`);
    }
    
    // 建议2：基于预测对比（如果有）
    if (comparisonResult) {
      const prob = comparisonResult.achievementProbability;
      if (prob === 'very_low') {
        suggestions.push(`🚨 基于历史趋势预测，目标达成概率极低。当前差距 ${comparisonResult.avgGapPercent}%。建议：① 重新评估目标合理性；② 大幅增加资源投入；③ 考虑分阶段达成。`);
      } else if (prob === 'low') {
        suggestions.push(`⚠️ 基于历史趋势预测，目标达成有难度。当前差距 ${comparisonResult.avgGapPercent}%。建议：① 优化关键转化环节；② ${comparisonResult.summary.maxShortfallMonth ? comparisonResult.summary.maxShortfallMonth + ' 月是瓶颈期，需重点突破' : '关注峰值月份的资源配置'}。`);
      } else if (prob === 'medium') {
        suggestions.push(`💡 基于历史趋势预测，目标有挑战性但可达成。建议：① 密切监控 ${comparisonResult.summary.monthsAtRisk} 个风险月份的执行；② 提前准备应急预案。`);
      } else {
        suggestions.push(`🎉 基于历史趋势预测，目标大概率可以达成！建议：① 保持当前策略；② 可设定更高挑战目标；③ 提前规划下一阶段。`);
      }
    }
    
    // 建议3：漏斗优化建议
    const weakConversionIndex = funnelLevels.findIndex((l, i) => {
      if (i >= funnelLevels.length - 1) return false;
      const rate = l.conversionRate || 0;
      return rate < 0.2; // 转化率低于20%认为是薄弱环节
    });
    
    if (weakConversionIndex !== -1) {
      const weakLevel = funnelLevels[weakConversionIndex];
      const nextLevel = funnelLevels[weakConversionIndex + 1];
      suggestions.push(`🔧 发现转化瓶颈：${weakLevel.name} → ${nextLevel?.name} 的转化率仅 ${((weakLevel.conversionRate || 0) * 100).toFixed(1)}%。建议优先优化该环节，可显著提升目标达成概率。优化方向：① 简化流程 ② 优化引导 ③ A/B测试。`);
    }
    
    // 建议4：时间节点建议
    if (monthsDiff <= 3) {
      suggestions.push(`⏰ 目标周期较短（${monthsDiff} 个月），建议：① 立即启动所有优化措施；② 每周复盘进度；③ 准备好应急预案。`);
    } else if (monthsDiff >= 12) {
      suggestions.push(`📅 目标周期较长（${monthsDiff} 个月），建议：① 设置季度里程碑；② 每季度评估一次市场变化；③ 保持策略灵活性。`);
    }
    
    setSmartSuggestions(suggestions);
  };

  useEffect(() => {
    if (showResult && resultRef.current) {
      gsap.fromTo(
        resultRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, [showResult]);

  // 获取可行性标签
  const getFeasibilityLabel = (status: string) => {
    switch (status) {
      case 'achievable':
        return { text: '目标可行', color: 'var(--neon-green)', icon: CheckCircle2 };
      case 'medium':
        return { text: '略有挑战', color: 'var(--neon-orange)', icon: AlertCircle };
      case 'high_risk':
        return { text: '风险较高', color: 'var(--neon-pink)', icon: AlertCircle };
      default:
        return { text: '未知', color: 'var(--text-muted)', icon: Info };
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          指标规划
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          多层漏斗目标拆解与路径规划
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
                规划配置
              </div>
              {isConfigOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          
          {isConfigOpen && (
            <CardContent className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* 漏斗模板选择 */}
              <div className="space-y-2">
                <label className="text-body text-[var(--text-secondary)] font-medium">选择漏斗模板</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(FUNNEL_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => applyTemplate(key)}
                      className={`p-2 rounded text-xs text-left transition-all ${
                        selectedTemplate === key
                          ? 'bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
                          : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50'
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-[10px] opacity-70">
                        {template.levels.map(l => l.name).join(' → ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 漏斗层级配置 */}
              {funnelLevels.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[var(--neon-cyan)] font-medium">
                      漏斗层级配置
                    </label>
                    <button
                      onClick={addFunnelLevel}
                      className="text-xs flex items-center gap-1 text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80"
                    >
                      <Plus className="w-3 h-3" /> 添加层级
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {funnelLevels.map((level, index) => (
                      <div key={level.id} className="p-2 rounded bg-[var(--bg-secondary)] space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--neon-cyan)] w-6">{index + 1}</span>
                          <input
                            type="text"
                            value={level.name}
                            onChange={(e) => updateLevel(level.id, 'name', e.target.value)}
                            className="flex-1 text-xs p-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                            placeholder="层级名称"
                          />
                          {funnelLevels.length > 1 && (
                            <button
                              onClick={() => removeFunnelLevel(level.id)}
                              className="text-[var(--neon-pink)] hover:text-[var(--neon-pink)]/80"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pl-6">
                          <input
                            type="number"
                            value={level.currentValue || ''}
                            onChange={(e) => updateLevel(level.id, 'currentValue', parseFloat(e.target.value) || 0)}
                            className="w-20 text-xs p-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                            placeholder="当前值"
                          />
                          <span className="text-[10px] text-[var(--text-muted)]">当前</span>
                          {index < funnelLevels.length - 1 && (
                            <>
                              <input
                                type="number"
                                value={level.conversionRate ? (level.conversionRate * 100).toFixed(1) : ''}
                                onChange={(e) => updateLevel(level.id, 'conversionRate', (parseFloat(e.target.value) || 0) / 100)}
                                className="w-16 text-xs p-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                                placeholder="转化率"
                              />
                              <span className="text-[10px] text-[var(--text-muted)]">% → 下一层</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 目标设置 */}
              {funnelLevels.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                  <label className="text-sm text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                    <Target className="w-4 h-4" /> 目标设置
                  </label>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-muted)]">目标层级</label>
                    <select
                      value={targetLevelId}
                      onChange={(e) => setTargetLevelId(e.target.value)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    >
                      {funnelLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-muted)]">目标值</label>
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      placeholder="例如: 10000"
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-muted)]">截止日期</label>
                    <input
                      type="month"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  
                  {/* 预测数据对比 */}
                  <div className="pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-muted)]">预测数据对比（可选）</label>
                      {forecastData && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                          已导入 {forecastData.months.length} 个月
                        </span>
                      )}
                    </div>
                    <button
                      onClick={importForecastData}
                      disabled={!targetLevelId}
                      className="w-full p-2.5 rounded text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: forecastData ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                        color: forecastData ? '#22c55e' : 'var(--text-muted)',
                        border: `1px solid ${forecastData ? '#22c55e' : 'var(--border-subtle)'}`
                      }}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {forecastData ? '重新导入预测数据' : '从时序预测模块导入数据'}
                    </button>
                    <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
                      💡 提示：先在「时序预测」模块完成预测并保存结果，然后点击上方按钮导入，系统将自动对比目标与预测趋势
                    </p>
                  </div>
                </div>
              )}

              {/* 拆解方式 */}
              {funnelLevels.length > 0 && targetLevelId && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                  <label className="text-sm text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                    <CalculatorIcon className="w-4 h-4" /> 拆解方式
                  </label>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {DECOMPOSITION_METHODS.map((method) => (
                      <button
                        key={method.key}
                        onClick={() => setDecompositionMethod(method.key)}
                        className={`p-2 rounded text-xs text-left transition-all ${
                          decompositionMethod === method.key
                            ? 'bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)] text-[var(--neon-purple)]'
                            : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/50'
                        }`}
                      >
                        <div className="font-medium">{method.name}</div>
                        <div className="text-[10px] opacity-70">{method.desc}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* 自定义拆解 - 月度目标设置 */}
                  {decompositionMethod === 'custom' && targetDate && targetValue && (
                    <div className="mt-4 p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs text-[var(--neon-cyan)] font-medium">
                          自定义每月目标
                        </label>
                        <button
                          onClick={() => {
                            // 自动根据营销日历生成建议值
                            const targetNum = parseFloat(targetValue);
                            const currentDate = new Date();
                            const deadline = new Date(targetDate);
                            const monthsDiff = Math.max(1, 
                              (deadline.getFullYear() - currentDate.getFullYear()) * 12 + 
                              (deadline.getMonth() - currentDate.getMonth()) + 1
                            );
                            
                            const newValues: {[key: string]: number} = {};
                            const targetLevel = funnelLevels.find(l => l.id === targetLevelId);
                            
                            for (let i = 0; i < monthsDiff; i++) {
                              const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                              const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              const monthNum = d.getMonth() + 1;
                              
                              // 检查该月是否有营销活动
                              const events = MARKETING_CALENDAR.filter(e => e.month === monthNum);
                              const hasBurst = events.some(e => e.type === 'burst');
                              
                              // 基础线性值
                              const progress = (i + 1) / monthsDiff;
                              let baseValue = (targetLevel?.currentValue || 0) + (targetNum - (targetLevel?.currentValue || 0)) * progress;
                              
                              // 有爆发活动月份增加20%
                              if (hasBurst) {
                                baseValue *= 1.2;
                              }
                              
                              newValues[`${targetLevelId}_${monthKey}`] = Math.round(baseValue);
                            }
                            
                            setCustomMonthlyValues(newValues);
                            toast.success('已根据营销日历生成建议值');
                          }}
                          className="text-[10px] px-2 py-1 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
                        >
                          根据营销日历自动生成
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const currentDate = new Date();
                          const deadline = new Date(targetDate);
                          const monthsDiff = Math.max(1, 
                            (deadline.getFullYear() - currentDate.getFullYear()) * 12 + 
                            (deadline.getMonth() - currentDate.getMonth()) + 1
                          );
                          
                          return Array.from({ length: monthsDiff }, (_, i) => {
                            const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            const monthNum = d.getMonth() + 1;
                            
                            // 查找该月份的营销活动
                            const events = MARKETING_CALENDAR.filter(e => e.month === monthNum);
                            
                            return (
                              <div key={monthKey} className="flex items-center gap-2">
                                <div className="w-16 text-[10px] text-[var(--text-muted)]">{monthKey}</div>
                                <input
                                  type="number"
                                  value={customMonthlyValues[`${targetLevelId}_${monthKey}`] || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCustomMonthlyValues(prev => ({
                                      ...prev,
                                      [`${targetLevelId}_${monthKey}`]: val
                                    }));
                                  }}
                                  placeholder="目标值"
                                  className="flex-1 text-xs p-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                                />
                                <div className="w-24 flex flex-wrap gap-1">
                                  {events.map((event, idx) => (
                                    <span 
                                      key={idx}
                                      className={`text-[9px] px-1 py-0.5 rounded ${
                                        event.type === 'burst' 
                                          ? 'bg-[var(--neon-pink)]/20 text-[var(--neon-pink)]' 
                                          : 'bg-[var(--neon-orange)]/20 text-[var(--neon-orange)]'
                                      }`}
                                      title={`${event.name} (${event.date}) 影响系数: ${event.impact}`}
                                    >
                                      {event.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      <p className="text-[10px] text-[var(--text-muted)] mt-2">
                        💡 提示：粉色标签表示爆发型活动，建议在该月设定更高目标
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 开始拆解按钮 - 只要有目标层级就显示，但禁用状态 */}
              {funnelLevels.length > 0 && targetLevelId && (
                <button
                  onClick={calculateMonthlyTargets}
                  disabled={isCalculating || !targetValue || !targetDate || (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0)}
                  className="w-full font-medium py-2 px-4 rounded transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: (!targetValue || !targetDate || (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0)) ? 'var(--bg-tertiary)' : 'var(--neon-cyan)',
                    color: (!targetValue || !targetDate || (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0)) ? 'var(--text-muted)' : 'var(--bg-primary)',
                    border: 'none',
                    cursor: (!targetValue || !targetDate || (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0)) ? 'not-allowed' : 'pointer',
                    opacity: (isCalculating || !targetValue || !targetDate || (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0)) ? 0.5 : 1
                  }}
                  title={!targetValue ? '请先填写目标值' : !targetDate ? '请先选择截止日期' : (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0) ? '请先设置每月目标值' : ''}
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      计算中...
                    </>
                  ) : !targetValue ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      请先填写目标值
                    </>
                  ) : !targetDate ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      请先选择截止日期
                    </>
                  ) : (decompositionMethod === 'custom' && Object.keys(customMonthlyValues).length === 0) ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      请先设置每月目标值
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      开始拆解
                    </>
                  )}
                </button>
              )}
            </CardContent>
          )}
        </Card>

        {/* 结果展示区域 */}
        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Target className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">配置漏斗层级和目标</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">拆解结果将在此显示</p>
              </div>
            </Card>
          ) : (
            <div ref={resultRef} className="space-y-6">
              {/* 差距分析卡片 */}
              {gapAnalysis && (
                <Card className="glass border-[var(--border-subtle)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[var(--neon-cyan)]" />
                      目标可行性分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">目标层级</p>
                        <p className="text-lg font-bold text-[var(--neon-cyan)]">
                          {gapAnalysis.targetLevelName}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">当前 → 目标</p>
                        <p className="text-lg font-bold text-[var(--text-primary)]">
                          {gapAnalysis.currentValue} → {gapAnalysis.targetValue}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">总增长</p>
                        <p className="text-lg font-bold text-[var(--neon-green)]">
                          +{gapAnalysis.totalGrowth}%
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">月均增长率</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold" style={{ color: getFeasibilityLabel(gapAnalysis.feasibility).color }}>
                            {gapAnalysis.monthlyGrowthRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 可行性评估 */}
                    <div className="mt-4 p-3 rounded-lg flex items-center gap-3" style={{ 
                      backgroundColor: `${getFeasibilityLabel(gapAnalysis.feasibility).color}20`,
                      border: `1px solid ${getFeasibilityLabel(gapAnalysis.feasibility).color}40`
                    }}>
                      {(() => {
                        const Icon = getFeasibilityLabel(gapAnalysis.feasibility).icon;
                        return <Icon className="w-5 h-5" style={{ color: getFeasibilityLabel(gapAnalysis.feasibility).color }} />;
                      })()}
                      <div>
                        <p className="text-sm font-medium" style={{ color: getFeasibilityLabel(gapAnalysis.feasibility).color }}>
                          {getFeasibilityLabel(gapAnalysis.feasibility).text}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {gapAnalysis.feasibility === 'achievable' 
                            ? '目标合理，按计划执行即可达成'
                            : gapAnalysis.feasibility === 'medium'
                            ? '目标有挑战性，需要额外资源投入或策略调整'
                            : '目标难度较大，建议重新评估或延长达成时间'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 目标 vs 预测对比 */}
              {comparisonResult && (
                <Card className="glass border-[var(--border-subtle)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[var(--neon-orange)]" />
                      目标 vs 预测对比
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        comparisonResult.achievementProbability === 'high' ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]' :
                        comparisonResult.achievementProbability === 'medium' ? 'bg-[var(--neon-orange)]/20 text-[var(--neon-orange)]' :
                        'bg-[var(--neon-pink)]/20 text-[var(--neon-pink)]'
                      }`}>
                        达成概率: {
                          comparisonResult.achievementProbability === 'high' ? '高' :
                          comparisonResult.achievementProbability === 'medium' ? '中' :
                          comparisonResult.achievementProbability === 'low' ? '低' : '极低'
                        }
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* 关键指标 */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">平均差距</p>
                        <p className={`text-lg font-bold ${parseFloat(comparisonResult.avgGapPercent) > 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--neon-green)]'}`}>
                          {parseFloat(comparisonResult.avgGapPercent) > 0 ? '+' : ''}{comparisonResult.avgGapPercent}%
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">风险月份</p>
                        <p className="text-lg font-bold text-[var(--neon-orange)]">
                          {comparisonResult.summary.monthsAtRisk} 个
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-muted)]">最大缺口</p>
                        <p className="text-lg font-bold text-[var(--neon-pink)]">
                          +{comparisonResult.summary.maxShortfall.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* 对比表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <th className="text-left p-2 text-[var(--text-muted)]">月份</th>
                            <th className="text-center p-2 text-[var(--text-muted)]">目标值</th>
                            <th className="text-center p-2 text-[var(--text-muted)]">预测值</th>
                            <th className="text-center p-2 text-[var(--text-muted)]">差距</th>
                            <th className="text-center p-2 text-[var(--text-muted)]">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonResult.comparisons.map((comp: any, idx: number) => (
                            <tr key={idx} className="border-b border-[var(--border-subtle)]/50">
                              <td className="p-2 text-[var(--text-primary)]">{comp.month}</td>
                              <td className="text-center p-2 text-[var(--neon-cyan)]">{comp.target.toLocaleString()}</td>
                              <td className="text-center p-2 text-[var(--text-muted)]">{comp.forecast.toLocaleString()}</td>
                              <td className={`text-center p-2 ${comp.gap > 0 ? 'text-[var(--neon-pink)]' : 'text-[var(--neon-green)]'}`}>
                                {comp.gap > 0 ? '+' : ''}{comp.gap.toLocaleString()}
                                <span className="text-[10px] ml-1">({comp.gapPercent > 0 ? '+' : ''}{comp.gapPercent.toFixed(1)}%)</span>
                              </td>
                              <td className="text-center p-2">
                                {comp.status === 'shortfall' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-[var(--neon-pink)]/20 text-[var(--neon-pink)] text-[10px]">缺口</span>
                                ) : comp.status === 'exceed' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] text-[10px]">超额</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] text-[10px]">匹配</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 智能建议 */}
              {smartSuggestions.length > 0 && (
                <Card className="glass border-[var(--neon-purple)]/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                      <Brain className="w-5 h-5 text-[var(--neon-purple)]" />
                      智能建议
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {smartSuggestions.map((suggestion, idx) => (
                        <div 
                          key={idx}
                          className="p-3 rounded-lg bg-[var(--bg-secondary)] border-l-2 border-[var(--neon-purple)]"
                        >
                          <p className="text-sm text-[var(--text-primary)] whitespace-pre-line">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 逐层拆解结果 */}
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[var(--neon-purple)]" />
                    逐层拆解结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]">
                          <th className="text-left p-2 text-[var(--text-muted)]">层级</th>
                          {monthlyTargets[0]?.map(t => (
                            <th key={t.month} className="text-center p-2 text-[var(--text-muted)]">
                              {t.month}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {funnelLevels.map((level, levelIndex) => (
                          <tr key={level.id} className="border-b border-[var(--border-subtle)]/50">
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--text-primary)] font-medium">{level.name}</span>
                                {levelIndex === funnelLevels.findIndex(l => l.id === targetLevelId) && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]">
                                    目标
                                  </span>
                                )}
                              </div>
                              {levelIndex < funnelLevels.length - 1 && level.conversionRate && (
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  转化率: {(level.conversionRate * 100).toFixed(1)}%
                                </div>
                              )}
                            </td>
                            {monthlyTargets[levelIndex]?.map((t, idx) => (
                              <td key={`${t.month}_${idx}`} className="text-center p-2">
                                <span className={`
                                  ${levelIndex === funnelLevels.findIndex(l => l.id === targetLevelId) 
                                    ? 'text-[var(--neon-cyan)] font-bold' 
                                    : 'text-[var(--text-primary)]'}
                                `}>
                                  {t.value.toLocaleString()}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* 路径可视化 */}
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-[var(--neon-green)]" />
                    目标达成路径
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {funnelLevels.map((level, index) => {
                      const isTarget = level.id === targetLevelId;
                      const levelData = monthlyTargets[index];
                      const startValue = levelData?.[0]?.value || level.currentValue;
                      const endValue = levelData?.[levelData.length - 1]?.value || 0;
                      
                      return (
                        <div key={level.id} className="flex items-center gap-4">
                          <div className="w-24 text-xs text-[var(--text-muted)]">{level.name}</div>
                          <div className="flex-1 h-8 rounded bg-[var(--bg-secondary)] relative overflow-hidden">
                            {/* 进度条 */}
                            <div 
                              className="absolute top-0 left-0 h-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(100, ((endValue - startValue) / (startValue || 1)) * 50 + 50)}%`,
                                background: isTarget 
                                  ? 'linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))'
                                  : 'linear-gradient(90deg, var(--neon-green), var(--neon-cyan))'
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-between px-3">
                              <span className="text-xs text-[var(--text-muted)]">{startValue.toLocaleString()}</span>
                              <span className={`text-xs font-bold ${isTarget ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-primary)]'}`}>
                                {endValue.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {isTarget && (
                            <span className="text-xs px-2 py-1 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]">
                              目标
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
