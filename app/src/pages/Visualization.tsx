import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart3, 
  PieChart, 
  LineChart, 
  ScatterChart,
  Activity,
  Download,
  Settings2,
  RotateCcw,
  Palette,
  Grid3X3,
  TrendingUp,
  Database,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Info,
  Users,
  Loader2,
  Save,
  LayoutDashboard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DatasetSelector } from '@/components/DatasetSelector';
import { datasetApi } from '@/api/datasets';
import { analysisApi } from '@/api/analysis';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import * as echarts from 'echarts';

// 图表类型
type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'heatmap';

// 图表配置
interface ChartConfig {
  type: ChartType;
  xAxis?: string;
  yAxis?: string;
  colorBy?: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  title: string;
}

// 字段信息
interface FieldInfo {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
  uniqueCount?: number;
  sample?: any[];
}

// 颜色配置 - 使用实际颜色值避免 ECharts 无法解析 CSS 变量
const CHART_COLORS = {
  cyan: '#00f5ff',
  purple: '#b829f7',
  pink: '#ff0080',
  green: '#00ff9d',
  orange: '#ffaa00',
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
  // 高对比度配色方案
  primary: ['#00f5ff', '#00d4e6', '#00b3cc', '#0099b3', '#007a99'],
  categorical: ['#00f5ff', '#b829f7', '#ff0080', '#00ff9d', '#ffaa00', '#3b82f6', '#ef4444', '#eab308'],
  gradients: [
    ['#00f5ff', '#0066ff'],
    ['#b829f7', '#ff0080'],
    ['#00ff9d', '#00f5ff'],
    ['#ffaa00', '#ff0080'],
    ['#3b82f6', '#8b5cf6']
  ]
};

// 图表类型中文标签
const chartTypeLabels: Record<ChartType, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  scatter: '散点图',
  histogram: '直方图',
  heatmap: '热力图'
};

// 图表推荐规则
interface ChartRecommendation {
  type: ChartType;
  title: string;
  description: string;
  suitable: boolean;
  reason: string;
  xAxis?: string;
  yAxis?: string;
  priority: number;
}

export function Visualization() {
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // 图表配置
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'bar',
    aggregation: 'sum',
    title: '数据可视化'
  });
  
  // 聚类分析状态
  const [enableClustering, setEnableClustering] = useState(false);
  const [clusterK, setClusterK] = useState(3);
  const [clusterResult, setClusterResult] = useState<any>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  
  // 图表容器引用 - 使用 callback ref 确保 DOM 就绪
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 使用 setTimeout 延迟清理，避免 React DOM 操作冲突
      setTimeout(() => {
        if (resizeHandlerRef.current) {
          window.removeEventListener('resize', resizeHandlerRef.current);
          resizeHandlerRef.current = null;
        }
        if (chartInstanceRef.current) {
          try {
            chartInstanceRef.current.dispose();
          } catch (e) {
            // 忽略清理错误
          }
          chartInstanceRef.current = null;
        }
      }, 0);
    };
  }, []);
  
  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setFields([]);
      setChartData([]);
      return;
    }
    
    const loadDatasetInfo = async () => {
      try {
        setLoading(true);
        const res: any = await datasetApi.getDetail(selectedDataset);
        const data = res.data || res;
        setDatasetInfo(data);
        
        // 解析字段类型
        if (data.schema) {
          const parsedFields: FieldInfo[] = data.schema.map((field: any) => ({
            name: field.name,
            dtype: field.dtype,
            type: inferFieldType(field.dtype, field.name),
            uniqueCount: field.unique_count || field.uniqueCount,
            sample: field.sample || []
          }));
          setFields(parsedFields);
          
          // 加载实际数据
          await loadChartData(selectedDataset, parsedFields);
        }
      } catch (err) {
        console.error('Failed to load dataset info:', err);
        toast.error('加载数据集信息失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadDatasetInfo();
  }, [selectedDataset]);
  
  // 加载图表数据 - 带采样限制
  const loadChartData = async (datasetId: string, _fields: FieldInfo[]) => {
    try {
      setDataLoading(true);
      // 获取数据样本，限制数量避免性能问题
      const res: any = await datasetApi.preview(datasetId, 1000);
      const data = res.data || res;
      // 处理 preview API 返回的数据结构
      if (data && data.data && Array.isArray(data.data)) {
        setChartData(data.data);
      } else if (Array.isArray(data)) {
        setChartData(data);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
      toast.error('加载数据失败');
      setChartData([]);
    } finally {
      setDataLoading(false);
    }
  };
  
  // 推断字段类型
  const inferFieldType = (dtype: string, name: string): FieldInfo['type'] => {
    const lowerName = name.toLowerCase();
    const lowerDtype = dtype.toLowerCase();
    
    if (lowerDtype.includes('int') || lowerDtype.includes('float') || lowerDtype.includes('number') || lowerDtype.includes('double')) {
      return 'numeric';
    }
    if (lowerDtype.includes('datetime') || lowerDtype.includes('date') || lowerDtype.includes('time') || lowerName.includes('date') || lowerName.includes('time')) {
      return 'datetime';
    }
    if (lowerDtype.includes('object') || lowerDtype.includes('category') || lowerDtype.includes('string') || lowerDtype.includes('bool')) {
      return 'categorical';
    }
    // 根据字段名判断
    if (lowerName.includes('id') || lowerName.includes('name') || lowerName.includes('type') || lowerName.includes('category') || lowerName.includes('status')) {
      return 'categorical';
    }
    if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('count') || lowerName.includes('quantity') || lowerName.includes('value') || lowerName.includes('num') || lowerName.includes('total')) {
      return 'numeric';
    }
    return 'other';
  };
  
  // 获取可用的X轴字段
  const availableXFields = useMemo(() => {
    return fields.filter(f => f.type === 'categorical' || f.type === 'datetime');
  }, [fields]);
  
  // 获取可用的Y轴字段
  const availableYFields = useMemo(() => {
    return fields.filter(f => f.type === 'numeric');
  }, [fields]);
  
  // 获取可用的分组字段
  const availableColorFields = useMemo(() => {
    return fields.filter(f => f.type === 'categorical');
  }, [fields]);
  
  // 智能图表推荐
  const recommendations = useMemo((): ChartRecommendation[] => {
    if (!fields.length) return [];
    
    const recs: ChartRecommendation[] = [];
    const numericFields = fields.filter(f => f.type === 'numeric');
    const categoricalFields = fields.filter(f => f.type === 'categorical');
    const datetimeFields = fields.filter(f => f.type === 'datetime');
    
    // 柱状图推荐 - 分类 vs 数值
    if (categoricalFields.length > 0 && numericFields.length > 0) {
      const bestCatField = categoricalFields.find(f => 
        f.name.toLowerCase().includes('category') || 
        f.name.toLowerCase().includes('type')
      ) || categoricalFields[0];
      const bestNumField = numericFields.find(f => 
        f.name.toLowerCase().includes('amount') || 
        f.name.toLowerCase().includes('value') ||
        f.name.toLowerCase().includes('total')
      ) || numericFields[0];
      
      recs.push({
        type: 'bar',
        title: '分类对比分析',
        description: `展示不同${bestCatField.name}的${bestNumField.name}对比`,
        suitable: true,
        reason: `${bestCatField.name}是分类字段，${bestNumField.name}是数值字段，适合柱状图展示`,
        xAxis: bestCatField.name,
        yAxis: bestNumField.name,
        priority: 10
      });
    }
    
    // 折线图推荐 - 时间序列
    if (datetimeFields.length > 0 && numericFields.length > 0) {
      const bestDateField = datetimeFields[0];
      const bestNumField = numericFields[0];
      
      recs.push({
        type: 'line',
        title: '趋势分析',
        description: `展示${bestNumField.name}随时间的变化趋势`,
        suitable: true,
        reason: `${bestDateField.name}是时间字段，适合展示${bestNumField.name}的时间趋势`,
        xAxis: bestDateField.name,
        yAxis: bestNumField.name,
        priority: 9
      });
    }
    
    // 饼图推荐 - 单分类单数值
    if (categoricalFields.length > 0 && numericFields.length > 0) {
      const bestCatField = categoricalFields.find(f => {
        const uniqueCount = f.uniqueCount || 10;
        return uniqueCount >= 3 && uniqueCount <= 10;
      }) || categoricalFields[0];
      
      if (bestCatField) {
        const uniqueCount = bestCatField.uniqueCount || 10;
        recs.push({
          type: 'pie',
          title: '占比分析',
          description: `展示各${bestCatField.name}的占比分布`,
          suitable: uniqueCount >= 3 && uniqueCount <= 10,
          reason: uniqueCount > 10 
            ? `${bestCatField.name}类别过多(${uniqueCount}个)，饼图会较拥挤，建议使用柱状图`
            : `${bestCatField.name}有${uniqueCount}个类别，适合用饼图展示占比`,
          xAxis: bestCatField.name,
          yAxis: numericFields[0].name,
          priority: uniqueCount >= 3 && uniqueCount <= 10 ? 8 : 5
        });
      }
    }
    
    // 散点图推荐 - 双数值
    if (numericFields.length >= 2) {
      recs.push({
        type: 'scatter',
        title: '相关性分析',
        description: `分析${numericFields[0].name}与${numericFields[1].name}的相关性`,
        suitable: true,
        reason: '有两个数值字段，适合散点图分析相关性',
        xAxis: numericFields[0].name,
        yAxis: numericFields[1].name,
        priority: 7
      });
      
      // 散点图聚类推荐
      recs.push({
        type: 'scatter',
        title: '聚类分析',
        description: `对${numericFields[0].name}与${numericFields[1].name}进行聚类分群`,
        suitable: true,
        reason: '两个数值字段适合进行K-Means聚类，发现数据中的自然分组',
        xAxis: numericFields[0].name,
        yAxis: numericFields[1].name,
        priority: 6
      });
    }
    
    // 直方图推荐 - 单数值
    if (numericFields.length > 0) {
      recs.push({
        type: 'histogram',
        title: '分布分析',
        description: `展示${numericFields[0].name}的数据分布`,
        suitable: true,
        reason: `${numericFields[0].name}是数值字段，适合直方图展示分布情况`,
        yAxis: numericFields[0].name,
        priority: 6
      });
    }
    
    return recs.sort((a, b) => b.priority - a.priority);
  }, [fields]);
  
  // 应用推荐配置
  const applyRecommendation = (rec: ChartRecommendation) => {
    // 根据图表类型设置不同的字段
    const newConfig: ChartConfig = {
      type: rec.type,
      xAxis: rec.xAxis,
      yAxis: rec.yAxis,
      aggregation: 'sum',
      title: rec.title
    };
    
    // 特殊处理：直方图不需要 X 轴
    if (rec.type === 'histogram') {
      newConfig.xAxis = undefined;
    }
    
    // 重置聚类状态
    setEnableClustering(false);
    setClusterResult(null);
    
    setChartConfig(newConfig);
    toast.success(`已应用「${rec.title}」配置`);
  };
  
  // 执行聚类分析
  const runClustering = useCallback(async () => {
    if (!chartConfig.yAxis || chartData.length === 0) {
      toast.error('请先选择Y轴字段');
      return;
    }
    
    setClusterLoading(true);
    try {
      // 准备数据
      // 如果没有 X 轴，使用索引作为 X 值
      const scatterData = chartData
        .filter(row => chartConfig.xAxis ? (row[chartConfig.xAxis] != null && row[chartConfig.yAxis!] != null) : row[chartConfig.yAxis!] != null)
        .map((row, index) => [
          chartConfig.xAxis ? (parseFloat(row[chartConfig.xAxis]) || 0) : index,
          parseFloat(row[chartConfig.yAxis!]) || 0
        ]);
      
      // 调用聚类API
      const columns = chartConfig.xAxis ? [chartConfig.xAxis, chartConfig.yAxis] : ['索引', chartConfig.yAxis];
      const res = await analysisApi.runClustering({
        dataset_id: selectedDataset,
        columns: columns,
        n_clusters: clusterK,
        data: scatterData
      }) as any;
      
      if (res.data) {
        setClusterResult(res.data);
        toast.success(`聚类完成！发现 ${res.data.n_clusters} 个群体`);
      }
    } catch (err) {
      toast.error('聚类分析失败');
    } finally {
      setClusterLoading(false);
    }
  }, [chartConfig.xAxis, chartConfig.yAxis, chartData, clusterK, selectedDataset]);
  
  // 获取当前图表需要的字段提示
  const getFieldRequirementText = () => {
    switch (chartConfig.type) {
      case 'histogram':
        return '需要：数值字段';
      case 'scatter':
        return '需要：数值字段（Y轴），X轴可选';
      case 'pie':
        return '需要：分类字段 + 数值字段';
      case 'heatmap':
        return '需要：X轴字段 + Y轴字段 + 数值字段';
      case 'bar':
      case 'line':
      default:
        return '需要：分类/时间字段（X轴）+ 数值字段（Y轴）';
    }
  };
  
  // 根据图表类型获取字段标签
  const getAxisLabels = () => {
    switch (chartConfig.type) {
      case 'pie':
        return { x: '分类字段', y: '数值字段' };
      case 'histogram':
        return { x: '分组字段（可选）', y: '数值字段' };
      case 'heatmap':
        return { x: 'X轴 / 行', y: 'Y轴 / 列' };
      case 'scatter':
        return { x: 'X轴（可选）', y: 'Y轴 / 数值' };
      case 'bar':
      case 'line':
      default:
        return { x: 'X轴 / 分类', y: 'Y轴 / 数值' };
    }
  };
  
  const axisLabels = getAxisLabels();
  
  // 聚合数据
  const aggregateData = useCallback((data: any[], xField: string, yField: string, agg: string) => {
    const grouped = new Map<string, number[]>();
    
    data.forEach(row => {
      const key = String(row[xField] ?? '未知');
      const value = parseFloat(row[yField]) || 0;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(value);
    });
    
    const result = Array.from(grouped.entries()).map(([key, values]) => {
      let aggregatedValue: number;
      switch (agg) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        default:
          aggregatedValue = values.reduce((a, b) => a + b, 0);
      }
      return { name: key, value: aggregatedValue };
    });
    
    // 按值排序并限制数量
    return result.sort((a, b) => b.value - a.value).slice(0, 50);
  }, []);
  
  // 计算直方图数据 - 修复边界情况
  const calculateHistogram = useCallback((values: number[]) => {
    if (!values || values.length === 0) return [];
    
    // 过滤无效值
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return [];
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    
    // 处理所有值相同的情况
    if (min === max) {
      return [{ name: `${min.toFixed(1)}`, value: validValues.length }];
    }
    
    const bucketCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(validValues.length))));
    const bucketSize = (max - min) / bucketCount;
    
    // 安全地创建桶
    const buckets: { range: string; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const rangeStart = min + i * bucketSize;
      const rangeEnd = min + (i + 1) * bucketSize;
      buckets.push({
        range: `${rangeStart.toFixed(1)}-${rangeEnd.toFixed(1)}`,
        count: 0
      });
    }
    
    // 分配值到桶
    validValues.forEach(v => {
      // 处理边界情况
      if (v === max) {
        buckets[bucketCount - 1].count++;
      } else {
        const idx = Math.floor((v - min) / bucketSize);
        if (idx >= 0 && idx < bucketCount) {
          buckets[idx].count++;
        }
      }
    });
    
    return buckets.map(b => ({ name: b.range, value: b.count }));
  }, []);
  
  // 构建图表配置
  const buildChartOption = useCallback((type: ChartType, data: any[], xField: string, yField: string): echarts.EChartsOption => {
    // 验证数据
    if (!data || data.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#94a3b8' }
        }
      };
    }
    
    const baseOption: echarts.EChartsOption = {
      title: {
        text: chartConfig.title,
        left: 'center',
        textStyle: {
          color: '#e2e8f0',
          fontSize: 16,
          fontWeight: 'normal'
        }
      },
      tooltip: {
        trigger: type === 'pie' ? 'item' : 'axis',
        backgroundColor: 'rgba(21, 27, 61, 0.95)',
        borderColor: 'rgba(0, 245, 255, 0.3)',
        borderWidth: 1,
        textStyle: {
          color: '#e2e8f0'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 300
    };
    
    switch (type) {
      case 'bar':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
            axisLabel: { 
              color: '#94a3b8',
              rotate: data.length > 10 ? 45 : 0,
              interval: data.length > 20 ? 'auto' : 0
            },
            axisTick: { show: false }
          },
          yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisLabel: { color: '#94a3b8' },
            splitLine: { 
              lineStyle: { 
                color: 'rgba(148, 163, 184, 0.1)',
                type: 'dashed'
              } 
            }
          },
          series: [{
            type: 'bar',
            data: data.map(d => d.value),
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: CHART_COLORS.cyan },
                { offset: 1, color: CHART_COLORS.purple }
              ])
            },
            emphasis: {
              itemStyle: {
                color: CHART_COLORS.cyan
              }
            }
          }]
        };
        
      case 'line':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
            axisLabel: { 
              color: '#94a3b8',
              rotate: data.length > 10 ? 45 : 0
            },
            axisTick: { show: false },
            boundaryGap: false
          },
          yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisLabel: { color: '#94a3b8' },
            splitLine: { 
              lineStyle: { 
                color: 'rgba(148, 163, 184, 0.1)',
                type: 'dashed'
              } 
            }
          },
          series: [{
            type: 'line',
            data: data.map(d => d.value),
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { 
              color: CHART_COLORS.cyan, 
              width: 3,
              shadowColor: CHART_COLORS.cyan,
              shadowBlur: 10
            },
            itemStyle: {
              color: CHART_COLORS.cyan,
              borderColor: '#fff',
              borderWidth: 2
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(0, 245, 255, 0.3)' },
                { offset: 1, color: 'rgba(0, 245, 255, 0)' }
              ])
            }
          }]
        };
        
      case 'pie':
        return {
          ...baseOption,
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '55%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 8,
              borderColor: '#0a0e27',
              borderWidth: 2
            },
            label: {
              show: true,
              color: '#e2e8f0',
              formatter: '{b}: {d}%'
            },
            labelLine: {
              lineStyle: {
                color: 'rgba(148, 163, 184, 0.5)'
              }
            },
            data: data.map((d, i) => ({
              name: d.name,
              value: d.value,
              itemStyle: {
                color: CHART_COLORS.categorical[i % CHART_COLORS.categorical.length]
              }
            }))
          }]
        };
        
      case 'scatter':
        // 如果启用了聚类，按聚类标签分组数据
        if (enableClustering && clusterResult && clusterResult.labels) {
          const clusterColors = [
            '#00f5ff', '#b829f7', '#ff0080', '#00ff9d', 
            '#ffaa00', '#3b82f6', '#ef4444', '#eab308'
          ];
          
          // 按聚类标签分组数据
          const seriesData: any[] = [];
          for (let i = 0; i < clusterResult.n_clusters; i++) {
            const clusterData = data.filter((_, idx) => clusterResult.labels[idx] === i);
            seriesData.push({
              name: `群体 ${i + 1}`,
              type: 'scatter',
              data: clusterData,
              symbolSize: 12,
              itemStyle: {
                color: clusterColors[i % clusterColors.length],
                shadowBlur: 10,
                shadowColor: clusterColors[i % clusterColors.length]
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#fff',
                  borderWidth: 2
                }
              }
            });
          }
          
          // 添加聚类中心点
          if (clusterResult.centers) {
            seriesData.push({
              name: '中心点',
              type: 'scatter',
              data: clusterResult.centers,
              symbolSize: 20,
              symbol: 'diamond',
              itemStyle: {
                color: '#fff',
                borderColor: '#00f5ff',
                borderWidth: 2,
                opacity: 0.8
              },
              z: 10
            });
          }
          
          return {
            ...baseOption,
            legend: {
              data: seriesData.map(s => s.name),
              textStyle: { color: '#94a3b8' },
              top: 40
            },
            xAxis: {
              type: 'value',
              name: xField,
              nameTextStyle: { color: '#94a3b8' },
              axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
              axisLabel: { color: '#94a3b8' },
              splitLine: { 
                lineStyle: { 
                  color: 'rgba(148, 163, 184, 0.1)',
                  type: 'dashed'
                } 
              }
            },
            yAxis: {
              type: 'value',
              name: yField,
              nameTextStyle: { color: '#94a3b8' },
              axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
              axisLabel: { color: '#94a3b8' },
              splitLine: { 
                lineStyle: { 
                  color: 'rgba(148, 163, 184, 0.1)',
                  type: 'dashed'
                } 
              }
            },
            series: seriesData
          };
        }
        
        // 普通散点图
        return {
          ...baseOption,
          xAxis: {
            type: 'value',
            name: xField,
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
            axisLabel: { color: '#94a3b8' },
            splitLine: { 
              lineStyle: { 
                color: 'rgba(148, 163, 184, 0.1)',
                type: 'dashed'
              } 
            }
          },
          yAxis: {
            type: 'value',
            name: yField,
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
            axisLabel: { color: '#94a3b8' },
            splitLine: { 
              lineStyle: { 
                color: 'rgba(148, 163, 184, 0.1)',
                type: 'dashed'
              } 
            }
          },
          series: [{
            type: 'scatter',
            data: data,
            symbolSize: 12,
            itemStyle: {
              color: CHART_COLORS.cyan,
              shadowBlur: 10,
              shadowColor: CHART_COLORS.cyan
            },
            emphasis: {
              itemStyle: {
                color: CHART_COLORS.pink,
                borderColor: '#fff',
                borderWidth: 2
              }
            }
          }]
        };
        
      case 'histogram':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
            axisLabel: { 
              color: '#94a3b8',
              interval: Math.floor(data.length / 10)
            },
            axisTick: { show: false }
          },
          yAxis: {
            type: 'value',
            name: '频数',
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { show: false },
            axisLabel: { color: '#94a3b8' },
            splitLine: { 
              lineStyle: { 
                color: 'rgba(148, 163, 184, 0.1)',
                type: 'dashed'
              } 
            }
          },
          series: [{
            type: 'bar',
            data: data.map(d => d.value),
            barWidth: '95%',
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: CHART_COLORS.green },
                { offset: 1, color: CHART_COLORS.cyan }
              ])
            }
          }]
        };
        
      default:
        return baseOption;
    }
  }, [chartConfig.title, enableClustering, clusterResult]);
  
  // 判断图表是否可以渲染（根据图表类型有不同的字段要求）
  const canRenderChart = useCallback(() => {
    if (!chartData.length) return false;
    
    switch (chartConfig.type) {
      case 'histogram':
        // 直方图只需要 Y 轴（数值字段）
        return !!chartConfig.yAxis;
      case 'scatter':
        // 散点图只需要 Y 轴（数值字段），X 轴可选（默认为数据索引）
        return !!chartConfig.yAxis;
      case 'bar':
      case 'line':
      case 'pie':
      default:
        // 其他图表需要 X 轴（分类/时间）和 Y 轴（数值）
        return !!chartConfig.xAxis && !!chartConfig.yAxis;
    }
  }, [chartConfig.type, chartConfig.xAxis, chartConfig.yAxis, chartData.length]);
  
  // 渲染图表 - 使用更稳定的实现
  useEffect(() => {
    // 清理函数
    const cleanup = () => {
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.dispose();
        } catch (e) {
          // 忽略清理错误
        }
        chartInstanceRef.current = null;
      }
    };
    
    // 检查是否可以渲染
    if (!chartContainerRef.current || !canRenderChart()) {
      cleanup();
      return;
    }
    
    // 延迟渲染，确保 DOM 稳定
    const renderTimeout = setTimeout(() => {
      try {
        // 先清理旧实例
        cleanup();
        
        // 检查容器是否还在文档中
        if (!chartContainerRef.current || !document.contains(chartContainerRef.current)) {
          return;
        }
        
        // 创建新实例
        const instance = echarts.init(chartContainerRef.current);
        chartInstanceRef.current = instance;
        
        const xField = chartConfig.xAxis || '';
        const yField = chartConfig.yAxis || '';
        
        // 准备数据
        let processedData: any[] = [];
        
        if (chartConfig.type === 'scatter') {
          // 散点图使用原始数据
          // 如果没有 X 轴，使用数据索引作为 X
          processedData = chartData
            .filter(row => {
              if (xField) {
                return row[xField] != null && row[yField] != null;
              }
              return row[yField] != null;
            })
            .map((row, index) => [
              xField ? (parseFloat(row[xField]) || 0) : index, 
              parseFloat(row[yField]) || 0
            ])
            .filter(([x, y]) => isFinite(x) && isFinite(y))
            .slice(0, 500);
        } else if (chartConfig.type === 'histogram') {
          // 直方图只需要 Y 轴字段
          if (yField) {
            const values = chartData
              .map(row => parseFloat(row[yField]))
              .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
            processedData = calculateHistogram(values);
          }
        } else {
          // 其他图表聚合数据（需要 X 和 Y 轴）
          if (xField && yField) {
            processedData = aggregateData(chartData, xField, yField, chartConfig.aggregation);
          }
        }
        
        const option = buildChartOption(chartConfig.type, processedData, xField, yField);
        instance.setOption(option, true);
        
        // 响应式
        const handleResize = () => {
          if (chartInstanceRef.current) {
            chartInstanceRef.current.resize();
          }
        };
        resizeHandlerRef.current = handleResize;
        window.addEventListener('resize', handleResize);
        
      } catch (err) {
        console.error('Chart render error:', err);
        toast.error('图表渲染失败，请检查数据配置');
      }
    }, 100); // 100ms 延迟确保 DOM 稳定
    
    return () => {
      clearTimeout(renderTimeout);
      cleanup();
    };
  }, [chartConfig, chartData, aggregateData, calculateHistogram, buildChartOption, enableClustering, clusterResult]);
  
  // 下载图表
  const handleDownload = () => {
    if (chartInstanceRef.current && selectedDataset) {
      try {
        const url = chartInstanceRef.current.getDataURL({ 
          type: 'png', 
          pixelRatio: 2,
          backgroundColor: '#0a0e27'
        });
        const link = document.createElement('a');
        // 文件名格式：数据集_图表类型
        const filename = `${selectedDataset.filename.replace(/[\\/:*?"<>|]/g, '_')}_${chartTypeLabels[chartConfig.type]}.png`;
        link.download = filename;
        link.href = url;
        link.click();
        toast.success('图表已下载');
      } catch (err) {
        toast.error('下载失败');
      }
    }
  };
  
  // 保存到看板
  const saveToDashboard = () => {
    if (!canRenderChart() || !selectedDataset) {
      toast.error('请先配置并生成图表');
      return;
    }
    
    // 生成更好的默认名称：数据集_图表类型
    const defaultName = `${selectedDataset.filename}_${chartTypeLabels[chartConfig.type]}`;
    const vizName = (chartConfig.title && chartConfig.title !== '数据可视化') 
      ? chartConfig.title 
      : defaultName;
    
    const savedViz = {
      id: `viz_${Date.now()}`,
      name: vizName,
      datasetId: selectedDataset.id,
      datasetName: selectedDataset.filename,
      config: { ...chartConfig },
      data: chartData.slice(0, 1000), // Limit data size
      createdAt: new Date().toISOString()
    };
    
    // Get existing visualizations
    const existing = localStorage.getItem('insightease_visualizations');
    const visualizations = existing ? JSON.parse(existing) : [];
    
    // Add new visualization
    visualizations.push(savedViz);
    localStorage.setItem('insightease_visualizations', JSON.stringify(visualizations));
    
    toast.success('图表已保存到看板', {
      description: '在 Dashboard 的自定义看板中可以查看',
      action: {
        label: '前往看板',
        onClick: () => window.location.href = '/app/dashboard'
      }
    });
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          可视化分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          拖拽式数据可视化，快速生成图表
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧配置面板 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[var(--neon-cyan)]" />
              图表配置
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
              <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-muted)]">已选择</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{datasetInfo.filename}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {datasetInfo.row_count?.toLocaleString()} 行 × {datasetInfo.col_count} 列
                </p>
              </div>
            )}
            
            {/* 图表类型 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-body text-[var(--text-secondary)] font-medium">图表类型</label>
                <span className="text-[10px] text-[var(--neon-cyan)]">{getFieldRequirementText()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'bar', icon: BarChart3, label: '柱状图' },
                  { type: 'line', icon: LineChart, label: '折线图' },
                  { type: 'pie', icon: PieChart, label: '饼图' },
                  { type: 'scatter', icon: ScatterChart, label: '散点图' },
                  { type: 'histogram', icon: Activity, label: '直方图' },
                  { type: 'heatmap', icon: Grid3X3, label: '热力图' },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setChartConfig(prev => ({ ...prev, type: type as ChartType }))}
                    className={`p-2 rounded-lg border transition-all ${
                      chartConfig.type === type
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* X轴选择 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">{axisLabels.x}</label>
              <select
                value={chartConfig.xAxis || ''}
                onChange={(e) => setChartConfig(prev => ({ ...prev, xAxis: e.target.value }))}
                className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                disabled={availableXFields.length === 0}
              >
                <option value="">选择字段</option>
                {availableXFields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.type})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Y轴选择 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">{axisLabels.y}</label>
              <select
                value={chartConfig.yAxis || ''}
                onChange={(e) => setChartConfig(prev => ({ ...prev, yAxis: e.target.value }))}
                className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                disabled={availableYFields.length === 0}
              >
                <option value="">选择字段</option>
                {availableYFields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.dtype})
                  </option>
                ))}
              </select>
            </div>
            
            {/* 分组/颜色 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">分组（可选）</label>
              <select
                value={chartConfig.colorBy || ''}
                onChange={(e) => setChartConfig(prev => ({ ...prev, colorBy: e.target.value || undefined }))}
                className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                disabled={availableColorFields.length === 0}
              >
                <option value="">不分组</option>
                {availableColorFields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 聚合方式 */}
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-muted)]">聚合方式</label>
              <select
                value={chartConfig.aggregation}
                onChange={(e) => setChartConfig(prev => ({ ...prev, aggregation: e.target.value as any }))}
                className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="sum">求和</option>
                <option value="avg">平均值</option>
                <option value="count">计数</option>
                <option value="min">最小值</option>
                <option value="max">最大值</option>
              </select>
            </div>
            
            {/* 聚类分析（仅散点图） */}
            {chartConfig.type === 'scatter' && chartConfig.yAxis && (
              <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    聚类分析
                  </label>
                  <button
                    onClick={() => {
                      setEnableClustering(!enableClustering);
                      if (!enableClustering) {
                        runClustering();
                      } else {
                        setClusterResult(null);
                      }
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      enableClustering ? 'bg-[var(--neon-cyan)]' : 'bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      enableClustering ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {enableClustering && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-[var(--text-muted)]">聚类数量 (K)</span>
                        <span className="text-xs text-[var(--neon-cyan)]">{clusterK}</span>
                      </div>
                      <Slider
                        value={[clusterK]}
                        onValueChange={(value) => {
                          setClusterK(value[0]);
                          // 延迟执行聚类，避免频繁请求
                          setTimeout(() => runClustering(), 500);
                        }}
                        min={2}
                        max={8}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    {clusterLoading && (
                      <p className="text-xs text-[var(--neon-cyan)] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        聚类分析中...
                      </p>
                    )}
                    
                    {clusterResult && (
                      <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs space-y-1">
                        <p className="text-[var(--text-muted)]">
                          发现 <span className="text-[var(--neon-cyan)]">{clusterResult.n_clusters}</span> 个群体
                        </p>
                        {clusterResult.silhouette_score != null && (
                          <p className="text-[var(--text-muted)]">
                            聚类质量: <span className={
                              clusterResult.silhouette_score > 0.5 ? 'text-[var(--neon-green)]' :
                              clusterResult.silhouette_score > 0.25 ? 'text-[var(--neon-orange)]' :
                              'text-[var(--neon-pink)]'
                            }>
                              {clusterResult.silhouette_score?.toFixed?.(2) ?? 'N/A'}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {clusterResult.cluster_sizes.map((size: number, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              群体{i+1}: {size}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* 重置按钮 */}
            <Button 
              variant="outline" 
              className="w-full border-[var(--border-subtle)]"
              onClick={() => {
                setChartConfig({
                  type: 'bar',
                  aggregation: 'sum',
                  title: '数据可视化'
                });
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重置配置
            </Button>
          </CardContent>
        </Card>
        
        {/* 右侧图表区域 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Palette className="w-5 h-5 text-[var(--neon-cyan)]" />
              图表预览
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="border-[var(--neon-purple)] text-[var(--neon-purple)]"
                onClick={saveToDashboard}
                disabled={!canRenderChart()}
              >
                <Save className="w-4 h-4 mr-2" />
                保存到看板
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-[var(--neon-cyan)] text-[var(--neon-cyan)]"
                onClick={handleDownload}
                disabled={!chartInstanceRef.current || !canRenderChart()}
              >
                <Download className="w-4 h-4 mr-2" />
                下载图表
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDataset ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <Database className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                  <p className="text-[var(--text-muted)]">请先选择一个数据集</p>
                </div>
              </div>
            ) : dataLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[var(--neon-cyan)]/20 border-t-[var(--neon-cyan)] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[var(--text-muted)]">加载数据中...</p>
                </div>
              </div>
            ) : !canRenderChart() ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                  <p className="text-[var(--text-muted)]">
                    {chartConfig.type === 'histogram' 
                      ? '请选择 Y 轴字段（数值）' 
                      : chartConfig.type === 'scatter'
                      ? '请选择 Y 轴字段（数值）'
                      : '请选择 X 轴和 Y 轴字段'}
                  </p>
                </div>
              </div>
            ) : (
              <div 
                ref={chartContainerRef}
                className="w-full h-96"
                key={`chart-${chartConfig.type}-${chartConfig.xAxis}-${chartConfig.yAxis}`}
              />
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* 智能图表推荐 */}
      {selectedDataset && recommendations.length > 0 && (
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[var(--neon-cyan)]" />
              智能图表推荐
              <span className="text-xs text-[var(--text-muted)] font-normal ml-2">
                基于您的数据特点推荐
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.slice(0, 6).map((rec) => (
                <div
                  key={`${rec.type}-${rec.title}`}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    rec.suitable 
                      ? 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50' 
                      : 'bg-[var(--bg-secondary)]/50 border-[var(--border-subtle)]/50 opacity-70'
                  }`}
                  onClick={() => rec.suitable && applyRecommendation(rec)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${rec.suitable ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)]'}`}>
                      {rec.suitable ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{rec.title}</p>
                        {rec.suitable && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{rec.description}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)]">
                        <Info className="w-3 h-3" />
                        <span>{rec.reason}</span>
                      </div>
                      {rec.suitable && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="mt-2 h-7 text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyRecommendation(rec);
                          }}
                        >
                          一键应用
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 数据字段信息 */}
      {selectedDataset && fields.length > 0 && (
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--neon-cyan)]" />
              字段概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {fields.map((field) => (
                <div 
                  key={field.name}
                  className="p-2 rounded bg-[var(--bg-secondary)] text-center"
                >
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{field.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{field.type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
