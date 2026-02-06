import { useState, useEffect, useRef } from 'react';
import { 
  Route, 
  Filter,
  ArrowRight,
  Play,
  Settings2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Share2,
  Download,
  RotateCcw,
  AlertCircle,
  Target,
  Layers,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatasetSelector } from '@/components/DatasetSelector';
import { DataTypeValidation } from '@/components/DataTypeValidation';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import * as echarts from 'echarts';

// 路径分析类型
type PathType = 'funnel' | 'path' | 'clustering' | 'key_path' | 'sequence_mining';

// 列信息
interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
  dtype: string;
  unique_count: number;
  sample_values: string[];
  suggestions: string[];
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

// 漏斗步骤
interface FunnelStep {
  step: number;
  name: string;
  users: number;
  conversion_rate: number;
  drop_off_rate: number;
  avg_time_from_prev: number;
}

// 路径节点
interface PathNode {
  name: string;
  in_degree: number;
  out_degree: number;
  unique_users: number;
}

// 路径
interface TopPath {
  path: string[];
  user_count: number;
  percentage: number;
}

export function PathAnalysis() {
  // 基础状态
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 分析配置
  const [pathType, setPathTypeState] = useState<PathType>('funnel');
  
  // 包装setPathType以处理状态变化
  const setPathType = (type: PathType) => {
    setPathTypeState(type);
  };
  const [userIdCol, setUserIdCol] = useState('');
  const [eventCol, setEventCol] = useState('');
  const [timestampCol, setTimestampCol] = useState('');
  
  // 漏斗配置
  const [funnelSteps, setFunnelSteps] = useState<string[]>(['']);
  const [timeWindow, setTimeWindow] = useState<number | null>(null);
  
  // 关键路径配置
  const [startEvent, setStartEvent] = useState('');
  const [endEvent, setEndEvent] = useState('');
  const [maxSteps, setMaxSteps] = useState(10);
  
  // 聚类配置
  const [nClusters, setNClusters] = useState(3);
  const [clusterMode, setClusterMode] = useState<'smart' | 'custom'>('smart');
  const [additionalEventCols, setAdditionalEventCols] = useState<string[]>([]);  // 联合分析的事件列（支持多选）
  const [selectedCustomColumns, setSelectedCustomColumns] = useState<string[]>([]);  // 自定义维度
  const [selectedSmartFeatures, setSelectedSmartFeatures] = useState<string[]>([]);  // 智能模式下选择的特征
  const [showFeatureSelector, setShowFeatureSelector] = useState(false);  // 是否显示特征选择器
  const [savingClusterResult, setSavingClusterResult] = useState(false);
  
  // 序列模式挖掘配置
  const [minSupport, setMinSupport] = useState(0.1);  // 最小支持度
  const [maxPatternLength, setMaxPatternLength] = useState(5);  // 最大模式长度
  const [minConfidence, setMinConfidence] = useState(0.5);  // 最小置信度
  const [sequenceAdditionalCols, setSequenceAdditionalCols] = useState<string[]>([]);  // 联合事件列（支持多选）
  
  // 可用的智能特征列表
  const availableSmartFeatures = [
    { key: 'total_events', name: '总事件数', category: '活跃度' },
    { key: 'unique_events', name: '唯一事件数', category: '多样性' },
    { key: 'combined_unique', name: '联合唯一事件数', category: '多样性' },
    { key: 'avg_time_between', name: '平均间隔时间', category: '时间' },
    { key: 'total_duration', name: '总时长', category: '时间' },
    { key: 'morning_activity', name: '上午活跃度', category: '时段' },
    { key: 'afternoon_activity', name: '下午活跃度', category: '时段' },
    { key: 'evening_activity', name: '晚上活跃度', category: '时段' },
    { key: 'night_activity', name: '夜间活跃度', category: '时段' },
    { key: 'n_sessions', name: '会话数', category: '会话' },
    { key: 'avg_session_length', name: '平均会话长度', category: '会话' },
    { key: 'path_depth', name: '路径深度', category: '深度' },
    { key: 'behavior_entropy', name: '行为熵', category: '多样性' },
    { key: 'combined_entropy', name: '联合事件熵', category: '多样性' },
    { key: 'has_repetition', name: '是否有重复', category: '重复' },
    { key: 'repetition_rate', name: '重复率', category: '重复' },
  ];
  
  // 通用配置
  const [maxPathLength, setMaxPathLength] = useState(10);
  const [minUserCount, setMinUserCount] = useState(5);
  
  // 结果
  const [result, setResult] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(true);
  
  // 图表引用
  const funnelChartRef = useRef<HTMLDivElement>(null);
  const sankeyChartRef = useRef<HTMLDivElement>(null);
  const graphChartRef = useRef<HTMLDivElement>(null);
  const funnelChartInstance = useRef<echarts.ECharts | null>(null);
  const sankeyChartInstance = useRef<echarts.ECharts | null>(null);
  const graphChartInstance = useRef<echarts.ECharts | null>(null);
  
  // 可视化类型选择
  const [vizType, setVizType] = useState<'sankey' | 'graph'>('sankey');
  
  // 加载数据集信息和列
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setColumns([]);
      setResult(null);
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      // 切换数据集时清空列信息和推荐，避免显示旧数据集的验证结果
      setColumns([]);
      setUserIdCol('');
      setEventCol('');
      setTimestampCol('');
      
      try {
        // 加载数据集详情
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data || res);
        
        // 加载适合路径分析的列
        const colRes = await analysisApi.getPathColumns(selectedDataset) as any;
        if (colRes.data?.columns) {
          setColumns(colRes.data.columns);
          
          // 自动推荐列
          if (colRes.data.suggested_user_id) {
            setUserIdCol(colRes.data.suggested_user_id);
          }
          if (colRes.data.suggested_event) {
            setEventCol(colRes.data.suggested_event);
          }
          if (colRes.data.suggested_timestamp) {
            setTimestampCol(colRes.data.suggested_timestamp);
          }
        }
      } catch (err: any) {
        console.error('Failed to load dataset:', err);
        const errorMessage = err?.response?.data?.detail || err?.message || '未知错误';
        const statusCode = err?.response?.status;
        
        let userFriendlyMessage = '加载数据集失败';
        if (statusCode === 500) {
          userFriendlyMessage = '该数据集暂不支持路径分析，可能缺少必要的列（用户ID、事件、时间戳）';
        } else if (statusCode === 404) {
          userFriendlyMessage = '数据集不存在或已被删除';
        } else if (statusCode === 403) {
          userFriendlyMessage = '没有权限访问该数据集';
        } else if (statusCode >= 400 && statusCode < 500) {
          userFriendlyMessage = `请求错误 (${statusCode}): ${errorMessage}`;
        } else if (statusCode >= 500) {
          userFriendlyMessage = `服务器错误 (${statusCode})，请稍后重试`;
        }
        
        // 清空列信息，确保不显示旧的验证结果
        setColumns([]);
        setUserIdCol('');
        setEventCol('');
        setTimestampCol('');
        
        setLoadError(userFriendlyMessage);
        toast.error(userFriendlyMessage, {
          description: `详细错误: ${errorMessage}`,
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedDataset]);
  
  // 渲染漏斗图
  useEffect(() => {
    if (result?.funnel_steps && funnelChartRef.current) {
      if (funnelChartInstance.current) {
        funnelChartInstance.current.dispose();
      }
      
      const instance = echarts.init(funnelChartRef.current);
      funnelChartInstance.current = instance;
      
      const data = result.funnel_steps.map((step: FunnelStep) => ({
        value: step.users,
        name: step.name
      }));
      
      const option = {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const step = result.funnel_steps[params.dataIndex];
            return `${params.name}<br/>
                    用户数: ${params.value.toLocaleString()}<br/>
                    转化率: ${step.conversion_rate}%<br/>
                    流失率: ${step.drop_off_rate}%`;
          }
        },
        series: [{
          type: 'funnel',
          left: '10%',
          top: 60,
          bottom: 60,
          width: '80%',
          min: 0,
          max: result.funnel_steps[0]?.users || 100,
          minSize: '0%',
          maxSize: '100%',
          sort: 'none',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}\n{c}人',
            color: '#fff'
          },
          itemStyle: {
            borderColor: '#0a0e27',
            borderWidth: 1
          },
          emphasis: {
            label: {
              fontSize: 14
            }
          },
          data: data,
          color: ['#00f5ff', '#00d4e6', '#00b3cc', '#0099b3', '#007a99', '#006080']
        }]
      };
      
      instance.setOption(option);
      
      const handleResize = () => instance.resize();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        instance.dispose();
      };
    }
  }, [result]);
  
  // 渲染桑基图
  useEffect(() => {
    if (vizType === 'sankey' && result?.sankey_data && sankeyChartRef.current) {
      if (sankeyChartInstance.current) {
        sankeyChartInstance.current.dispose();
      }
      
      try {
        const instance = echarts.init(sankeyChartRef.current);
        sankeyChartInstance.current = instance;
        
        const { nodes, links } = result.sankey_data;
        
        // 检查数据是否为空
        if (!nodes || nodes.length === 0 || !links || links.length === 0) {
          console.log('桑基图数据为空');
          return;
        }
        
        const option = {
          tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove'
          },
          series: [{
            type: 'sankey',
            layout: 'none',
            emphasis: {
              focus: 'adjacency'
            },
            data: nodes,
            links: links,
            lineStyle: {
              color: 'gradient',
              curveness: 0.5
            },
            itemStyle: {
              color: '#00f5ff',
              borderColor: '#0a0e27'
            },
            label: {
              color: '#e2e8f0'
            }
          }]
        };
        
        instance.setOption(option);
        
        const handleResize = () => instance.resize();
        window.addEventListener('resize', handleResize);
        return () => {
          window.removeEventListener('resize', handleResize);
          instance.dispose();
        };
      } catch (error) {
        console.error('桑基图渲染失败:', error);
        // 如果桑基图失败，自动切换到力导向图
        if (result.has_cycle_in_data) {
          setVizType('graph');
          toast.info('桑基图不支持循环路径，已自动切换到网络图');
        }
      }
    }
  }, [result, vizType]);
  
  // 渲染力导向图（支持循环）
  useEffect(() => {
    if (vizType === 'graph' && result?.graph_data && graphChartRef.current) {
      if (graphChartInstance.current) {
        graphChartInstance.current.dispose();
      }
      
      try {
        const instance = echarts.init(graphChartRef.current);
        graphChartInstance.current = instance;
        
        const { nodes, links } = result.graph_data;
        
        if (!nodes || nodes.length === 0) {
          console.log('网络图数据为空');
          return;
        }
        
        // 合并相同连接的权重
        const linkMap = new Map<string, number>();
        links.forEach((link: any) => {
          const key = `${link.source}->${link.target}`;
          linkMap.set(key, (linkMap.get(key) || 0) + link.value);
        });
        
        const mergedLinks = Array.from(linkMap.entries()).map(([key, value]) => {
          const [source, target] = key.split('->');
          return {
            source,
            target,
            value,
            lineStyle: {
              width: Math.max(1, Math.min(10, Math.log(value + 1) * 2)),
              curveness: 0.2
            }
          };
        });
        
        const option = {
          tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
              if (params.dataType === 'node') {
                return `${params.name}<br/>访问用户: ${params.value || 0}`;
              }
              return `${params.data.source} → ${params.data.target}<br/>流量: ${params.data.value}`;
            }
          },
          legend: {
            data: ['页面节点'],
            textStyle: { color: '#94a3b8' }
          },
          series: [{
            type: 'graph',
            layout: 'force',
            data: nodes.map((n: any) => ({
              ...n,
              itemStyle: {
                color: '#00f5ff',
                shadowBlur: 10,
                shadowColor: 'rgba(0, 245, 255, 0.5)'
              },
              label: {
                show: true,
                color: '#e2e8f0',
                fontSize: 12
              }
            })),
            links: mergedLinks,
            roam: true,
            label: {
              position: 'bottom',
              formatter: '{b}'
            },
            force: {
              repulsion: 300,
              gravity: 0.1,
              edgeLength: [50, 200],
              layoutAnimation: true
            },
            lineStyle: {
              color: 'source',
              curveness: 0.2,
              opacity: 0.6
            },
            emphasis: {
              focus: 'adjacency',
              lineStyle: {
                width: 4,
                opacity: 1
              }
            }
          }]
        };
        
        instance.setOption(option);
        
        const handleResize = () => instance.resize();
        window.addEventListener('resize', handleResize);
        return () => {
          window.removeEventListener('resize', handleResize);
          instance.dispose();
        };
      } catch (error) {
        console.error('网络图渲染失败:', error);
        toast.error('网络图渲染失败');
      }
    }
  }, [result, vizType]);
  
  // 下载图表
  const handleDownloadChart = (chartType: 'funnel' | 'sankey' | 'graph') => {
    let instance: echarts.ECharts | null = null;
    let filename = '';
    
    switch (chartType) {
      case 'funnel':
        instance = funnelChartInstance.current;
        filename = `漏斗分析_${datasetInfo?.filename || 'chart'}_${Date.now()}.png`;
        break;
      case 'sankey':
        instance = sankeyChartInstance.current;
        filename = `路径分析_桑基图_${datasetInfo?.filename || 'chart'}_${Date.now()}.png`;
        break;
      case 'graph':
        instance = graphChartInstance.current;
        filename = `路径分析_网络图_${datasetInfo?.filename || 'chart'}_${Date.now()}.png`;
        break;
    }
    
    if (instance) {
      try {
        const url = instance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#0a0e27'
        });
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        toast.success('图表已下载');
      } catch (err) {
        toast.error('下载失败');
      }
    }
  };
  
  // 下载数据为CSV
  const handleDownloadCSV = () => {
    if (!result || !pathType) return;
    
    const rows: any[] = [];
    const timestamp = new Date().toLocaleString();
    const datasetName = datasetInfo?.filename || 'data';
    
    // 添加报告头部
    rows.push(['路径分析报告']);
    rows.push(['生成时间', timestamp]);
    rows.push(['分析类型', pathType === 'funnel' ? '漏斗分析' : pathType === 'path' ? '路径分析' : pathType === 'clustering' ? '路径聚类' : pathType === 'key_path' ? '关键路径' : '序列模式挖掘']);
    rows.push(['数据集', datasetName]);
    rows.push([]);
    
    // 根据分析类型添加不同的数据
    if (pathType === 'funnel' && result.funnel_steps) {
      rows.push(['漏斗步骤详情']);
      rows.push(['步骤', '名称', '用户数', '转化率(%)', '流失率(%)', '平均耗时(秒)']);
      result.funnel_steps.forEach((step: FunnelStep) => {
        rows.push([step.step, step.name, step.users, step.conversion_rate, step.drop_off_rate, step.avg_time_from_prev]);
      });
      rows.push([]);
      rows.push(['汇总数据']);
      rows.push(['总用户数', result.total_users]);
      rows.push(['总体转化率(%)', result.overall_conversion_rate]);
      rows.push(['平均转化时长(秒)', result.avg_conversion_time]);
    } else if (pathType === 'path' && result.top_paths) {
      rows.push(['热门路径 TOP 10']);
      rows.push(['排名', '路径', '用户数', '占比(%)']);
      result.top_paths.forEach((path: TopPath, index: number) => {
        rows.push([index + 1, path.path.join(' → '), path.user_count, path.percentage]);
      });
      rows.push([]);
      if (result.node_details) {
        rows.push(['节点访问统计']);
        rows.push(['节点名称', '访问用户数', '出度']);
        result.node_details.forEach((node: PathNode) => {
          rows.push([node.name, node.unique_users, node.out_degree]);
        });
      }
    } else if (pathType === 'clustering' && result.clusters) {
      rows.push(['聚类结果']);
      rows.push(['聚类ID', '用户数', '占比(%)', '平均路径长度', '特征']);
      result.clusters.forEach((cluster: any) => {
        rows.push([cluster.cluster_id, cluster.user_count, cluster.percentage, cluster.avg_path_length, 
          cluster.characteristics?.join('; ') || '']);
      });
      rows.push([]);
      rows.push(['聚类汇总']);
      rows.push(['总用户数', result.total_users]);
      rows.push(['聚类数量', result.n_clusters]);
    } else if (pathType === 'key_path' && result.key_paths) {
      rows.push(['关键路径分析']);
      rows.push(['起点', result.start_event]);
      rows.push(['终点', result.end_event]);
      rows.push([]);
      rows.push(['TOP 关键路径']);
      rows.push(['排名', '路径', '用户占比(%)', '平均耗时(秒)', '转化率(%)']);
      result.key_paths.forEach((path: any, index: number) => {
        rows.push([index + 1, path.path.join(' → '), path.user_percentage, path.avg_time, path.conversion_rate]);
      });
    } else if (pathType === 'sequence_mining') {
      rows.push(['序列模式挖掘结果']);
      rows.push(['用户旅程数', result.total_sequences]);
      rows.push(['平均序列长度', result.avg_sequence_length]);
      rows.push(['转化率(%)', result.sequence_stats?.conversion_rate]);
      rows.push([]);
      if (result.frequent_patterns && result.frequent_patterns.length > 0) {
        rows.push(['频繁序列模式']);
        rows.push(['排名', '模式', '支持度', '出现次数', '置信度(%)']);
        result.frequent_patterns.slice(0, 20).forEach((pattern: any, index: number) => {
          rows.push([index + 1, pattern.pattern.join(' → '), pattern.support, pattern.count, (pattern.confidence * 100).toFixed(2)]);
        });
      }
      rows.push([]);
      if (result.association_rules && result.association_rules.length > 0) {
        rows.push(['关联规则']);
        rows.push(['排名', '前件', '后件', '置信度(%)', '提升度']);
        result.association_rules.slice(0, 20).forEach((rule: any, index: number) => {
          const antecedents = Array.isArray(rule.antecedent) ? rule.antecedent.join(', ') : rule.antecedent;
          rows.push([index + 1, antecedents, rule.consequent, (rule.confidence * 100).toFixed(2), rule.lift.toFixed(2)]);
        });
      }
      rows.push([]);
      if (result.high_conversion_patterns && result.high_conversion_patterns.length > 0) {
        rows.push(['高转化模式']);
        rows.push(['排名', '模式', '转化率(%)', '出现次数']);
        result.high_conversion_patterns.forEach((pattern: any, index: number) => {
          rows.push([index + 1, pattern.pattern.join(' → '), (pattern.conversion_rate * 100).toFixed(2), pattern.count]);
        });
      }
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `路径分析_${pathType}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV下载成功');
  };
  
  // 执行分析
  const handleAnalyze = async () => {
    if (!selectedDataset || !userIdCol || !eventCol || !timestampCol) {
      toast.error('请选择数据集和必要的列');
      return;
    }
    
    if (pathType === 'funnel' && funnelSteps.some(s => !s)) {
      toast.error('请填写所有漏斗步骤');
      return;
    }
    
    if (pathType === 'key_path' && (!startEvent || !endEvent)) {
      toast.error('请填写起点和终点事件');
      return;
    }
    
    setAnalyzing(true);
    setResult(null);
    
    try {
      const params: any = {
        user_id_col: userIdCol,
        event_col: eventCol,
        timestamp_col: timestampCol
      };
      
      if (pathType === 'funnel') {
        params.funnel_steps = funnelSteps.filter(s => s);
        if (timeWindow) params.time_window = timeWindow;
      } else if (pathType === 'path') {
        params.max_path_length = maxPathLength;
        params.min_user_count = minUserCount;
      } else if (pathType === 'clustering') {
        params.n_clusters = nClusters;
        params.max_path_length = maxPathLength;
        params.cluster_mode = clusterMode;
        if (clusterMode === 'custom' && selectedCustomColumns.length > 0) {
          params.cluster_custom_columns = selectedCustomColumns;
        }
        if (clusterMode === 'smart' && selectedSmartFeatures.length > 0) {
          params.selected_features = selectedSmartFeatures;
        }
        if (additionalEventCols.length > 0) {
          params.additional_event_cols = additionalEventCols;
        }
      } else if (pathType === 'key_path') {
        params.start_event = startEvent;
        params.end_event = endEvent;
        params.max_steps = maxSteps;
      } else if (pathType === 'sequence_mining') {
        params.min_support = minSupport;
        params.max_pattern_length = maxPatternLength;
        params.min_confidence = minConfidence;
        if (sequenceAdditionalCols.length > 0) params.additional_event_cols = sequenceAdditionalCols;
      }
      
      // 根据分析类型选择API
      let res;
      if (pathType === 'sequence_mining') {
        res = await analysisApi.quickSequenceMining({
          dataset_id: selectedDataset,
          ...params
        }) as any;
      } else {
        res = await analysisApi.quickPathAnalysis(
          selectedDataset,
          pathType,
          params
        ) as any;
      }
      
      if (res.data) {
        setResult(res.data);
        toast.success('分析完成！');
      }
    } catch (err: any) {
      toast.error(err.message || '分析失败');
    } finally {
      setAnalyzing(false);
    }
  };
  
  // 添加漏斗步骤
  const addFunnelStep = () => {
    setFunnelSteps([...funnelSteps, '']);
  };
  
  // 更新漏斗步骤
  const updateFunnelStep = (index: number, value: string) => {
    const newSteps = [...funnelSteps];
    newSteps[index] = value;
    setFunnelSteps(newSteps);
  };
  
  // 删除漏斗步骤
  const removeFunnelStep = (index: number) => {
    if (funnelSteps.length > 1) {
      setFunnelSteps(funnelSteps.filter((_, i) => i !== index));
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          路径分析
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          分析用户行为路径，优化转化漏斗，发现关键路径模式
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧配置面板 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setShowConfig(!showConfig)}
          >
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                分析配置
              </div>
              {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          
          {showConfig && (
            <CardContent className="space-y-4">
              {/* 数据集选择 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">选择数据集</label>
                <DatasetSelector 
                  value={selectedDataset}
                  onChange={setSelectedDataset}
                />
                {loading && (
                  <p className="text-xs text-[var(--neon-cyan)] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    加载中...
                  </p>
                )}
                {loadError && (
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">加载失败</p>
                        <p className="mt-1">{loadError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 分析类型 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">分析类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {pathType === 'funnel' ? (
                    <button onClick={() => setPathType('funnel')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"><Filter className="w-4 h-4"/>漏斗分析</button>
                  ) : (
                    <button onClick={() => setPathType('funnel')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50"><Filter className="w-4 h-4"/>漏斗分析</button>
                  )}
                  {pathType === 'path' ? (
                    <button onClick={() => setPathType('path')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"><Route className="w-4 h-4"/>路径分析</button>
                  ) : (
                    <button onClick={() => setPathType('path')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50"><Route className="w-4 h-4"/>路径分析</button>
                  )}
                  {pathType === 'clustering' ? (
                    <button onClick={() => setPathType('clustering')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"><Layers className="w-4 h-4"/>路径聚类</button>
                  ) : (
                    <button onClick={() => setPathType('clustering')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50"><Layers className="w-4 h-4"/>路径聚类</button>
                  )}
                  {pathType === 'key_path' ? (
                    <button onClick={() => setPathType('key_path')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"><Target className="w-4 h-4"/>关键路径</button>
                  ) : (
                    <button onClick={() => setPathType('key_path')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50"><Target className="w-4 h-4"/>关键路径</button>
                  )}
                  {pathType === 'sequence_mining' ? (
                    <button onClick={() => setPathType('sequence_mining')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"><Share2 className="w-4 h-4"/>序列模式</button>
                  ) : (
                    <button onClick={() => setPathType('sequence_mining')} className="p-2 rounded-lg border text-xs flex flex-col items-center gap-1 border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50"><Share2 className="w-4 h-4"/>序列模式</button>
                  )}
                </div>
              </div>
              
              {/* 模块级帮助说明 */}
              <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <details className="text-xs">
                  <summary className="cursor-pointer text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    路径分析使用指南
                  </summary>
                  <div className="mt-2 space-y-2 text-[var(--text-secondary)]">
                    <p className="text-[var(--neon-purple)] font-medium">分析类型说明：</p>
                    <p><span className="text-[var(--neon-cyan)]">漏斗分析：</span>追踪用户从进入到转化的流失情况，适用于注册、购买等关键流程优化。</p>
                    <p><span className="text-[var(--neon-cyan)]">路径分析：</span>可视化用户行为流转，发现高频路径和循环，适用于网站导航优化。</p>
                    <p><span className="text-[var(--neon-cyan)]">路径聚类：</span>将用户按行为模式分组，识别不同用户群体，适用于精细化运营。</p>
                    <p><span className="text-[var(--neon-cyan)]">关键路径：</span>分析从指定起点到终点的路径，发现最优转化路径，适用于特定流程优化。</p>
                    <p><span className="text-[var(--neon-cyan)]">序列模式：</span>挖掘频繁行为序列和关联规则，适用于推荐系统和行为预测。</p>
                    <p className="text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                      数据要求：每行代表一个用户事件，需包含用户ID、事件名称和时间戳。
                    </p>
                  </div>
                </details>
              </div>
              
              {columns.length > 0 && (
                <>
                  {/* 数据类型验证提示 */}
                  <DataTypeValidation 
                    columns={columns} 
                    analysisType={pathType} 
                  />
                  
                  {/* 配置参数说明 */}
                  <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--neon-cyan)] font-medium flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        配置参数说明
                      </summary>
                      <div className="mt-2 space-y-2 text-[var(--text-secondary)]">
                        <p><span className="text-[var(--neon-purple)]">用户ID列：</span>唯一标识用户的列，用于区分不同用户的行为序列。</p>
                        <p><span className="text-[var(--neon-purple)]">事件/页面列：</span>记录用户行为的列，如页面名称、事件类型、按钮点击等。</p>
                        <p><span className="text-[var(--neon-purple)]">时间戳列：</span>记录事件发生时间的列，支持datetime、string、date等格式。</p>
                        <p><span className="text-[var(--neon-purple)]">联合事件列（可选）：</span>可与主事件列组合，如将页面与区块类型组合为"首页_banner"。</p>
                        <p><span className="text-[var(--neon-purple)]">转化列（可选）：</span>标记是否发生转化的列（0/1或true/false），用于高转化模式挖掘。</p>
                      </div>
                    </details>
                  </div>
                  
                  {/* 列选择 */}
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">用户ID列</label>
                    <select
                      value={userIdCol}
                      onChange={(e) => setUserIdCol(e.target.value)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    >
                      <option value="">选择列</option>
                      {columns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">事件/页面列</label>
                    <select
                      value={eventCol}
                      onChange={(e) => setEventCol(e.target.value)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    >
                      <option value="">选择列</option>
                      {columns.filter(c => c.type === 'categorical').map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 序列模式挖掘时显示联合事件列选项 - 支持多选 */}
                  {pathType === 'sequence_mining' && (
                    <div className="space-y-2">
                      <label className="text-sm text-[var(--text-muted)]">联合事件列（可选，可多选）</label>
                      <div className="max-h-32 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded p-2 space-y-1">
                        {columns.filter(c => c.name !== eventCol && c.type === 'categorical').map(col => (
                          <label key={col.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-hover)] p-1 rounded">
                            <input
                              type="checkbox"
                              checked={sequenceAdditionalCols.includes(col.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSequenceAdditionalCols([...sequenceAdditionalCols, col.name]);
                                } else {
                                  setSequenceAdditionalCols(sequenceAdditionalCols.filter(c => c !== col.name));
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
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">时间戳列</label>
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
                </>
              )}
              
              {/* 漏斗分析配置 */}
              {pathType === 'funnel' && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  {/* 漏斗分析帮助 */}
                  <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs space-y-1">
                    <p className="text-[var(--neon-cyan)] font-medium">漏斗分析说明：</p>
                    <p className="text-[var(--text-muted)]">• 定义用户从进入到转化的关键步骤（如：首页→商品页→购物车→支付）</p>
                    <p className="text-[var(--text-muted)]">• 分析每步的转化率和流失率，找出优化点</p>
                    <p className="text-[var(--text-muted)]">• 时间窗口：限定完成整个漏斗的最长时间</p>
                  </div>
                  
                  <label className="text-sm text-[var(--text-muted)]">漏斗步骤</label>
                  {funnelSteps.map((step, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-xs text-[var(--text-muted)] w-6 pt-2">{index + 1}</span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => updateFunnelStep(index, e.target.value)}
                        placeholder="步骤名称"
                        className="flex-1 p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                      {funnelSteps.length > 1 && (
                        <button
                          onClick={() => removeFunnelStep(index)}
                          className="text-[var(--neon-pink)] hover:text-[var(--neon-pink)]/80"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-[var(--border-subtle)]"
                    onClick={addFunnelStep}
                  >
                    + 添加步骤
                  </Button>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">时间窗口（小时，可选）</label>
                    <input
                      type="number"
                      value={timeWindow || ''}
                      onChange={(e) => setTimeWindow(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="不限制"
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}
              
              {/* 关键路径配置 */}
              {pathType === 'key_path' && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  {/* 关键路径帮助 */}
                  <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs space-y-1">
                    <p className="text-[var(--neon-cyan)] font-medium">关键路径分析说明：</p>
                    <p className="text-[var(--text-muted)]">• 分析从起点事件到终点事件的完整用户路径</p>
                    <p className="text-[var(--text-muted)]">• 发现高频转化路径和最优路径</p>
                    <p className="text-[var(--text-muted)]">• 最大步数：限制路径长度，避免循环导致的无限路径</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">起点事件</label>
                    <input
                      type="text"
                      value={startEvent}
                      onChange={(e) => setStartEvent(e.target.value)}
                      placeholder="例如: 首页访问"
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">终点事件</label>
                    <input
                      type="text"
                      value={endEvent}
                      onChange={(e) => setEndEvent(e.target.value)}
                      placeholder="例如: 支付成功"
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">最大步数</label>
                    <input
                      type="number"
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(parseInt(e.target.value) || 10)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}
              
              {/* 序列模式挖掘配置 */}
              {pathType === 'sequence_mining' && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">最小支持度</label>
                    <input
                      type="number"
                      value={minSupport}
                      onChange={(e) => setMinSupport(parseFloat(e.target.value) || 0.1)}
                      min={0.01}
                      max={1}
                      step={0.01}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      模式至少出现在 {Math.round((minSupport || 0.1) * 100)}% 的用户旅程中
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">最大模式长度</label>
                    <input
                      type="number"
                      value={maxPatternLength}
                      onChange={(e) => setMaxPatternLength(parseInt(e.target.value) || 5)}
                      min={2}
                      max={10}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">最小置信度</label>
                    <input
                      type="number"
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(parseFloat(e.target.value) || 0.5)}
                      min={0.1}
                      max={1}
                      step={0.1}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      关联规则的最小可信度
                    </p>
                  </div>
                  
                  {/* 配置说明 */}
                  <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs space-y-1">
                    <p className="text-[var(--neon-cyan)]">序列模式挖掘说明：</p>
                    <p className="text-[var(--text-muted)]">• 频繁序列：发现最常出现的行为路径模式</p>
                    <p className="text-[var(--text-muted)]">• 关联规则：发现事件间的先后关联关系</p>
                    <p className="text-[var(--text-muted)]">• 高转化模式：识别导致转化的关键路径</p>
                  </div>
                </div>
              )}
              
              {/* 聚类配置 */}
              {pathType === 'clustering' && (
                <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
                  {/* 聚类分析帮助 */}
                  <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs space-y-1">
                    <p className="text-[var(--neon-cyan)] font-medium">路径聚类说明：</p>
                    <p className="text-[var(--text-muted)]">• 智能模式：自动提取行为特征（活跃度、时段偏好、路径深度等）进行聚类</p>
                    <p className="text-[var(--text-muted)]">• 自定义模式：选择数值列作为聚类维度，适合有特定业务指标的场景</p>
                    <p className="text-[var(--text-muted)]">• 聚类数量：建议3-5个，过多会导致样本过少，过少则区分度不够</p>
                  </div>
                  
                  {/* 聚类数量 */}
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">聚类数量</label>
                    <input
                      type="number"
                      value={nClusters}
                      onChange={(e) => setNClusters(parseInt(e.target.value) || 3)}
                      min={2}
                      max={10}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  
                  {/* 聚类模式 */}
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">聚类模式</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setClusterMode('smart')}
                        className={`p-2 rounded text-xs transition-colors ${
                          clusterMode === 'smart'
                            ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        智能行为特征
                      </button>
                      <button
                        onClick={() => setClusterMode('custom')}
                        className={`p-2 rounded text-xs transition-colors ${
                          clusterMode === 'custom'
                            ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        自由维度选择
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {clusterMode === 'smart' 
                        ? '自动提取行为特征：活跃度、时段、路径深度等' 
                        : '选择数值列作为聚类维度'}
                    </p>
                  </div>
                  
                  {/* 联合事件列（智能模式）- 支持多选 */}
                  {clusterMode === 'smart' && (
                    <div className="space-y-2">
                      <label className="text-sm text-[var(--text-muted)]">
                        联合分析列（可选，可多选）
                      </label>
                      <div className="max-h-32 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded p-2 space-y-1">
                        {columns
                          .filter(c => c.name !== eventCol && c.name !== userIdCol && c.name !== timestampCol)
                          .map(col => (
                            <label key={col.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-hover)] p-1 rounded">
                              <input
                                type="checkbox"
                                checked={additionalEventCols.includes(col.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAdditionalEventCols([...additionalEventCols, col.name]);
                                  } else {
                                    setAdditionalEventCols(additionalEventCols.filter(c => c !== col.name));
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
                  )}
                  
                  {/* 智能特征选择（智能模式） */}
                  {clusterMode === 'smart' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-[var(--text-muted)]">
                          选择特征（可选）
                        </label>
                        <button
                          onClick={() => setShowFeatureSelector(!showFeatureSelector)}
                          className="text-xs text-[var(--neon-cyan)] hover:underline"
                        >
                          {showFeatureSelector ? '收起' : '展开选择'}
                        </button>
                      </div>
                      
                      {!showFeatureSelector && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {selectedSmartFeatures.length > 0 
                            ? `已选择 ${selectedSmartFeatures.length} 个特征`
                            : '使用全部特征（点击展开选择）'}
                        </p>
                      )}
                      
                      {showFeatureSelector && (
                        <div className="max-h-48 overflow-y-auto space-y-2 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                          {['活跃度', '多样性', '时间', '时段', '会话', '深度', '重复'].map(category => {
                            const categoryFeatures = availableSmartFeatures.filter(f => f.category === category);
                            if (categoryFeatures.length === 0) return null;
                            return (
                              <div key={category} className="space-y-1">
                                <p className="text-[10px] text-[var(--neon-cyan)] font-medium">{category}</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {categoryFeatures.map(feature => (
                                    <label key={feature.key} className="flex items-center gap-1 text-xs cursor-pointer hover:bg-[var(--bg-tertiary)] p-1 rounded">
                                      <input
                                        type="checkbox"
                                        checked={selectedSmartFeatures.includes(feature.key)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedSmartFeatures([...selectedSmartFeatures, feature.key]);
                                          } else {
                                            setSelectedSmartFeatures(selectedSmartFeatures.filter(k => k !== feature.key));
                                          }
                                        }}
                                        className="rounded border-[var(--border-subtle)]"
                                      />
                                      <span className="text-[var(--text-secondary)]">{feature.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          
                          <div className="pt-2 border-t border-[var(--border-subtle)] flex gap-2">
                            <button
                              onClick={() => setSelectedSmartFeatures(availableSmartFeatures.map(f => f.key))}
                              className="text-[10px] text-[var(--neon-cyan)] hover:underline"
                            >
                              全选
                            </button>
                            <button
                              onClick={() => setSelectedSmartFeatures([])}
                              className="text-[10px] text-[var(--text-muted)] hover:underline"
                            >
                              清空
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 自定义维度（自定义模式） */}
                  {clusterMode === 'custom' && (
                    <div className="space-y-2">
                      <label className="text-sm text-[var(--text-muted)]">
                        选择聚类维度（可多选）
                      </label>
                      <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                        {columns
                          .filter(c => c.dtype.includes('int') || c.dtype.includes('float') || c.dtype.includes('number') || c.dtype.includes('double'))
                          .map(col => (
                            <label key={col.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-tertiary)] p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedCustomColumns.includes(col.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCustomColumns([...selectedCustomColumns, col.name]);
                                  } else {
                                    setSelectedCustomColumns(selectedCustomColumns.filter(c => c !== col.name));
                                  }
                                }}
                                className="rounded border-[var(--border-subtle)]"
                              />
                              <span className="text-[var(--text-secondary)]">{col.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">({col.dtype})</span>
                            </label>
                          ))}
                        {columns.filter(c => c.dtype.includes('int') || c.dtype.includes('float') || c.dtype.includes('number') || c.dtype.includes('double')).length === 0 && (
                          <p className="text-xs text-[var(--text-muted)] py-2">暂无数值列</p>
                        )}
                      </div>
                      {selectedCustomColumns.length > 0 && (
                        <p className="text-[10px] text-[var(--neon-cyan)]">
                          已选择 {selectedCustomColumns.length} 个维度
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* 通用配置 */}
              {(pathType === 'path' || pathType === 'clustering') && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--text-muted)]">最大路径长度</label>
                    <input
                      type="number"
                      value={maxPathLength}
                      onChange={(e) => setMaxPathLength(parseInt(e.target.value) || 10)}
                      className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  {pathType === 'path' && (
                    <div className="space-y-2">
                      <label className="text-sm text-[var(--text-muted)]">最小用户数</label>
                      <input
                        type="number"
                        value={minUserCount}
                        onChange={(e) => setMinUserCount(parseInt(e.target.value) || 5)}
                        className="w-full p-2 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* 分析按钮 */}
              <Button
                className="w-full bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                onClick={handleAnalyze}
                disabled={analyzing || !selectedDataset}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    开始分析
                  </>
                )}
              </Button>
              
              {result && (
                <Button
                  variant="outline"
                  className="w-full border-[var(--border-subtle)]"
                  onClick={() => {
                    setResult(null);
                    setFunnelSteps(['']);
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重新配置
                </Button>
              )}
            </CardContent>
          )}
        </Card>
        
        {/* 右侧结果区 */}
        <div className="lg:col-span-3 space-y-6">
          {!result && !analyzing && (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Route className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">配置分析参数并启动分析</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  支持漏斗分析、路径分析、路径聚类和关键路径分析
                </p>
              </div>
            </Card>
          )}
          
          {analyzing && (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[var(--neon-cyan)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">正在分析路径数据...</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">这可能需要一些时间</p>
              </div>
            </Card>
          )}
          
          {result && (
            <div className="space-y-6">
              {/* 下载工具栏 */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-[var(--bg-primary)]"
                  onClick={handleDownloadCSV}
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载CSV
                </Button>
              </div>
              
              {/* 漏斗分析结果 */}
              {pathType === 'funnel' && result.funnel_steps && (
                <>
                  {/* 概览卡片 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">总用户数</p>
                        <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {result.total_users?.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">总体转化率</p>
                        <p className="text-2xl font-bold text-[var(--neon-green)]">
                          {result.overall_conversion_rate}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">步骤数</p>
                        <p className="text-2xl font-bold text-[var(--neon-purple)]">
                          {result.funnel_steps.length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 漏斗图 */}
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                        <Filter className="w-5 h-5 text-[var(--neon-cyan)]" />
                        转化漏斗
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[var(--neon-cyan)] text-[var(--neon-cyan)]"
                        onClick={() => handleDownloadChart('funnel')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div ref={funnelChartRef} className="w-full h-96" />
                    </CardContent>
                  </Card>
                  
                  {/* 步骤详情表 */}
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardHeader>
                      <CardTitle className="text-lg text-[var(--text-primary)]">
                        步骤详情
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-subtle)]">
                              <th className="text-left py-2 text-[var(--text-muted)]">步骤</th>
                              <th className="text-right py-2 text-[var(--text-muted)]">用户数</th>
                              <th className="text-right py-2 text-[var(--text-muted)]">转化率</th>
                              <th className="text-right py-2 text-[var(--text-muted)]">流失率</th>
                              <th className="text-right py-2 text-[var(--text-muted)]">平均耗时</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.funnel_steps.map((step: FunnelStep) => (
                              <tr key={step.step} className="border-b border-[var(--border-subtle)]/50">
                                <td className="py-3">
                                  <span className="text-[var(--text-primary)]">{step.name}</span>
                                </td>
                                <td className="text-right py-3 text-[var(--neon-cyan)]">
                                  {step.users.toLocaleString()}
                                </td>
                                <td className="text-right py-3 text-[var(--neon-green)]">
                                  {step.conversion_rate}%
                                </td>
                                <td className="text-right py-3 text-[var(--neon-pink)]">
                                  {step.drop_off_rate}%
                                </td>
                                <td className="text-right py-3 text-[var(--text-secondary)]">
                                  {step.avg_time_from_prev > 0 ? `${step.avg_time_from_prev.toFixed(1)}h` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              
              {/* 路径分析结果 */}
              {pathType === 'path' && result.top_paths && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">总用户数</p>
                        <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {result.total_users?.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">不同路径数</p>
                        <p className="text-2xl font-bold text-[var(--neon-purple)]">
                          {result.total_paths?.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">最大路径长度</p>
                        <p className="text-2xl font-bold text-[var(--neon-orange)]">
                          {result.max_path_length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 循环路径警告 */}
                  {result.has_cycle_in_data && (
                    <div className="p-3 rounded-lg bg-[var(--neon-orange)]/10 border border-[var(--neon-orange)]/30">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-[var(--neon-orange)] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text-secondary)] mb-2">
                            检测到用户路径中存在循环行为（如 A→B→A），桑基图无法直接展示循环。
                            建议使用下方的<span className="text-[var(--neon-cyan)]">网络图</span>查看完整路径（包含循环）。
                          </p>
                          {result.cycle_details && result.cycle_details.length > 0 && (
                            <div className="text-xs text-[var(--text-muted)] space-y-1">
                              <p>循环示例（前3个）：</p>
                              {result.cycle_details.slice(0, 3).map((cycle: any, idx: number) => (
                                <p key={idx} className="truncate">
                                  • {cycle.path.join(' → ')} ({cycle.user_count}人)
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 可视化切换 */}
                  {result.sankey_data?.nodes?.length > 0 && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                          <Share2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                          用户流转图
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">视图:</span>
                          <button
                            onClick={() => setVizType('sankey')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${
                              vizType === 'sankey'
                                ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            桑基图
                          </button>
                          <button
                            onClick={() => setVizType('graph')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${
                              vizType === 'graph'
                                ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            网络图
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-2 border-[var(--neon-cyan)] text-[var(--neon-cyan)]"
                            onClick={() => handleDownloadChart(vizType)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            下载
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {vizType === 'sankey' ? (
                          <div ref={sankeyChartRef} className="w-full h-96" />
                        ) : (
                          <div ref={graphChartRef} className="w-full h-96" />
                        )}
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                          {vizType === 'sankey' 
                            ? '桑基图：清晰展示流量转化，但无法显示循环路径'
                            : '网络图：力导向布局，支持循环路径，可拖拽节点调整位置'}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* 热门路径 */}
                  <Card className="glass border-[var(--border-subtle)]">
                    <CardHeader>
                      <CardTitle className="text-lg text-[var(--text-primary)]">
                        热门路径 TOP 10
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.top_paths.map((path: TopPath, index: number) => (
                        <div 
                          key={index}
                          className="p-3 rounded-lg bg-[var(--bg-secondary)]"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--neon-cyan)]">排名 {index + 1}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {path.user_count.toLocaleString()} 人 ({path.percentage}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {path.path.map((event, i) => (
                              <span key={i} className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)]">
                                  {event}
                                </span>
                                {i < path.path.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  
                  {/* 节点详情 */}
                  {result.node_details && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--text-primary)]">
                          节点访问统计
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {result.node_details.slice(0, 12).map((node: PathNode) => (
                            <div 
                              key={node.name}
                              className="p-3 rounded-lg bg-[var(--bg-secondary)]"
                            >
                              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {node.name}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className="text-[var(--neon-cyan)]">
                                  <Users className="w-3 h-3 inline mr-1" />
                                  {node.unique_users.toLocaleString()}
                                </span>
                                <span className="text-[var(--text-muted)]">
                                  <ArrowRight className="w-3 h-3 inline mr-1" />
                                  {node.out_degree}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
              
              {/* 序列模式挖掘结果 */}
              {pathType === 'sequence_mining' && result.frequent_patterns && (
                <>
                  {/* 统计概览 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">用户旅程数</p>
                        <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {result.total_sequences?.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">平均序列长度</p>
                        <p className="text-2xl font-bold text-[var(--neon-purple)]">
                          {result.avg_sequence_length?.toFixed(1)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">频繁模式数</p>
                        <p className="text-2xl font-bold text-[var(--neon-green)]">
                          {result.frequent_patterns?.length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">转化率</p>
                        <p className="text-2xl font-bold text-[var(--neon-orange)]">
                          {result.sequence_stats?.conversion_rate}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 频繁序列模式 */}
                  {result.frequent_patterns && result.frequent_patterns.length > 0 && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--text-primary)]">
                          频繁序列模式 TOP 20
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.frequent_patterns.slice(0, 20).map((pattern: any, index: number) => (
                          <div 
                            key={index}
                            className="p-3 rounded-lg bg-[var(--bg-secondary)]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[var(--neon-cyan)]">排名 {index + 1}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-[var(--text-muted)]">
                                  支持度: <span className="text-[var(--neon-cyan)]">{(pattern.support * 100).toFixed(1)}%</span>
                                </span>
                                {pattern.conversion_rate !== undefined && (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    转化率: <span className={pattern.conversion_rate > 0.5 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-orange)]'}>
                                      {(pattern.conversion_rate * 100).toFixed(1)}%
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {pattern.pattern.map((event: string, i: number) => (
                                <span key={i} className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded bg-[var(--neon-cyan)]/10 text-xs text-[var(--neon-cyan)]">
                                    {event}
                                  </span>
                                  {i < pattern.pattern.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                  )}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              出现次数: {pattern.support_count} 次
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* 关联规则网络图 */}
                  {result.association_rules && result.association_rules.length > 0 && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--text-primary)]">
                          关联规则网络图
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <AssociationRuleGraph rules={result.association_rules.slice(0, 20)} />
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* 关联规则表格 */}
                  {result.association_rules && result.association_rules.length > 0 && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--text-primary)]">
                          关联规则 TOP 15
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[var(--border-subtle)]">
                                <th className="text-left p-2 text-[var(--text-muted)]">规则</th>
                                <th className="text-left p-2 text-[var(--text-muted)]">支持度</th>
                                <th className="text-left p-2 text-[var(--text-muted)]">置信度</th>
                                <th className="text-left p-2 text-[var(--text-muted)]">提升度</th>
                                <th className="text-left p-2 text-[var(--text-muted)]">类型</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.association_rules.slice(0, 15).map((rule: any, index: number) => (
                                <tr key={index} className="border-b border-[var(--border-subtle)]">
                                  <td className="p-2">
                                    <span className="text-[var(--neon-cyan)]">{rule.antecedent_str || rule.antecedent}</span>
                                    <span className="text-[var(--text-muted)] mx-2">→</span>
                                    <span className="text-[var(--neon-purple)]">{rule.consequent}</span>
                                  </td>
                                  <td className="p-2 text-[var(--text-secondary)]">{(rule.support * 100).toFixed(1)}%</td>
                                  <td className="p-2 text-[var(--text-secondary)]">{(rule.confidence * 100).toFixed(1)}%</td>
                                  <td className="p-2">
                                    <span className={rule.lift > 1 ? 'text-[var(--neon-green)]' : 'text-[var(--neon-orange)]'}>
                                      {rule.lift.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      rule.rule_type === '多前项' 
                                        ? 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]' 
                                        : 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                                    }`}>
                                      {rule.rule_type || '单前项'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* 高转化模式 */}
                  {result.high_conversion_patterns && result.high_conversion_patterns.length > 0 && (
                    <Card className="glass border-[var(--neon-green)]/30">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--neon-green)]">
                          高转化序列模式
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.high_conversion_patterns.map((pattern: any, index: number) => (
                          <div 
                            key={index}
                            className="p-3 rounded-lg bg-[var(--neon-green)]/5 border border-[var(--neon-green)]/20"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[var(--neon-green)]">转化率 {(pattern.conversion_rate * 100).toFixed(1)}%</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                支持度: {(pattern.support * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {pattern.pattern.map((event: string, i: number) => (
                                <span key={i} className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded bg-[var(--neon-green)]/10 text-xs text-[var(--neon-green)]">
                                    {event}
                                  </span>
                                  {i < pattern.pattern.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
              
              {/* 聚类分析结果 */}
              {pathType === 'clustering' && result.clusters && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">总用户数</p>
                        <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {result.total_users?.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">聚类数</p>
                        <p className="text-2xl font-bold text-[var(--neon-purple)]">
                          {result.n_clusters}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 保存结果按钮 */}
                  <Card className="glass border-[var(--neon-cyan)]/50 bg-[var(--neon-cyan)]/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            保存聚类结果
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            将用户群体标签写入数据集，生成新的数据集用于后续分析
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-[var(--bg-primary)]"
                          onClick={async () => {
                            if (!result?.user_cluster_mapping) {
                              toast.error('没有可保存的聚类结果');
                              return;
                            }
                            setSavingClusterResult(true);
                            try {
                              const res = await analysisApi.saveClusterResult({
                                source_dataset_id: selectedDataset,
                                user_cluster_mapping: result.user_cluster_mapping,
                                user_id_col: userIdCol,
                                cluster_descriptions: result.clusters?.map((c: any) => c.description || '')
                              }) as any;
                              if (res.data) {
                                toast.success(`已保存为新数据集：${res.data.filename}`);
                              }
                            } catch (err) {
                              toast.error('保存失败');
                            } finally {
                              setSavingClusterResult(false);
                            }
                          }}
                          disabled={savingClusterResult}
                        >
                          {savingClusterResult ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              保存结果
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* 聚类卡片 */}
                  <div className="grid grid-cols-1 gap-4">
                    {result.clusters.map((cluster: any) => (
                      <Card key={cluster.cluster_id} className="glass border-[var(--border-subtle)]">
                        <CardHeader>
                          <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                            <span>用户群体 {cluster.cluster_id + 1}</span>
                            <span className="text-sm text-[var(--neon-cyan)]">
                              {cluster.percentage}%
                            </span>
                          </CardTitle>
                          {cluster.description && (
                            <p className="text-xs text-[var(--neon-purple)] mt-1">
                              {cluster.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-[var(--neon-cyan)]">
                                {cluster.user_count.toLocaleString()}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">用户</p>
                            </div>
                            <div className="flex-1">
                              {cluster.feature_stats ? (
                                <div className="text-xs text-[var(--text-secondary)]">
                                  <p className="text-[var(--text-muted)] mb-1">特征均值：</p>
                                  {Object.entries(cluster.feature_stats)
                                    .slice(0, 4)
                                    .map(([key, stats]: [string, any]) => (
                                      <span key={key} className="inline-block mr-3">
                                        {key}: {stats.mean}
                                      </span>
                                    ))}
                                </div>
                              ) : cluster.most_common_path ? (
                                <>
                                  <p className="text-sm text-[var(--text-muted)] mb-2">典型路径：</p>
                                  <p className="text-sm text-[var(--text-primary)]">
                                    {cluster.most_common_path}
                                  </p>
                                </>
                              ) : null}
                            </div>
                          </div>
                          
                          {cluster.top_paths && cluster.top_paths.length > 1 && (
                            <div className="pt-3 border-t border-[var(--border-subtle)]">
                              <p className="text-xs text-[var(--text-muted)] mb-2">常见路径：</p>
                              <div className="space-y-1">
                                {cluster.top_paths.slice(0, 3).map((p: any, i: number) => (
                                  <p key={i} className="text-xs text-[var(--text-secondary)] truncate">
                                    {i + 1}. {p.path} ({p.count}人)
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
              
              {/* 关键路径结果 */}
              {pathType === 'key_path' && result.complete_path_count !== undefined && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">完整路径数</p>
                        <p className="text-2xl font-bold text-[var(--neon-cyan)]">
                          {result.complete_path_count.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">平均步数</p>
                        <p className="text-2xl font-bold text-[var(--neon-purple)]">
                          {result.avg_steps}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">平均耗时</p>
                        <p className="text-2xl font-bold text-[var(--neon-green)]">
                          {(result.avg_duration_seconds / 3600).toFixed(1)}h
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* 最优路径 */}
                  {result.optimal_paths && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="glass border-[var(--border-subtle)]">
                        <CardHeader>
                          <CardTitle className="text-lg text-[var(--neon-green)]">
                            最短路径（步数最少）
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 flex-wrap mb-4">
                            {result.optimal_paths.min_steps.path.map((event: string, i: number) => (
                              <span key={i} className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-[var(--neon-green)]/10 text-xs text-[var(--neon-green)]">
                                  {event}
                                </span>
                                {i < result.optimal_paths.min_steps.path.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                )}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-[var(--text-muted)]">
                              步数: <span className="text-[var(--neon-cyan)]">{result.optimal_paths.min_steps.steps}</span>
                            </span>
                            <span className="text-[var(--text-muted)]">
                              耗时: <span className="text-[var(--neon-cyan)]">{(result.optimal_paths.min_steps.duration_seconds / 3600).toFixed(1)}h</span>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="glass border-[var(--border-subtle)]">
                        <CardHeader>
                          <CardTitle className="text-lg text-[var(--neon-cyan)]">
                            最快路径（耗时最短）
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 flex-wrap mb-4">
                            {result.optimal_paths.min_duration.path.map((event: string, i: number) => (
                              <span key={i} className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-[var(--neon-cyan)]/10 text-xs text-[var(--neon-cyan)]">
                                  {event}
                                </span>
                                {i < result.optimal_paths.min_duration.path.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                )}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-[var(--text-muted)]">
                              步数: <span className="text-[var(--neon-cyan)]">{result.optimal_paths.min_duration.steps}</span>
                            </span>
                            <span className="text-[var(--text-muted)]">
                              耗时: <span className="text-[var(--neon-cyan)]">{(result.optimal_paths.min_duration.duration_seconds / 3600).toFixed(1)}h</span>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  {/* 常见路径 */}
                  {result.top_paths && result.top_paths.length > 0 && (
                    <Card className="glass border-[var(--border-subtle)]">
                      <CardHeader>
                        <CardTitle className="text-lg text-[var(--text-primary)]">
                          常见路径 TOP 10
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.top_paths.map((p: any, index: number) => (
                          <div 
                            key={index}
                            className="p-3 rounded-lg bg-[var(--bg-secondary)]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[var(--neon-cyan)]">排名 {index + 1}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {p.count.toLocaleString()} 人 ({p.percentage}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {p.path.map((event: string, i: number) => (
                                <span key={i} className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)]">
                                    {event}
                                  </span>
                                  {i < p.path.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 关联规则网络图组件
function AssociationRuleGraph({ rules }: { rules: any[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !rules || rules.length === 0) return;

    // 清理旧实例
    chartInstance.current?.dispose();
    chartInstance.current = echarts.init(chartRef.current);

    // 构建节点和边
    const nodes = new Set<string>();
    const edges: any[] = [];
    const nodeWeights: Record<string, number> = {};

    rules.forEach((rule) => {
      const antecedents = Array.isArray(rule.antecedent) ? rule.antecedent : [rule.antecedent];
      const consequent = rule.consequent;

      // 添加所有节点
      antecedents.forEach((a: string) => {
        nodes.add(a);
        nodeWeights[a] = (nodeWeights[a] || 0) + rule.confidence;
      });
      nodes.add(consequent);
      nodeWeights[consequent] = (nodeWeights[consequent] || 0) + rule.confidence;

      // 添加边
      edges.push({
        source: antecedents.join(' + '),
        target: consequent,
        value: rule.confidence,
        lineStyle: {
          width: Math.max(1, rule.confidence * 5),
          curveness: 0.2,
          color: rule.lift > 1 ? '#00ff9d' : rule.lift < 1 ? '#ff0080' : '#ffaa00'
        },
        label: {
          show: true,
          formatter: `${(rule.confidence * 100).toFixed(0)}%`,
          fontSize: 10,
          color: '#94a3b8'
        }
      });
    });

    // 构建节点数据
    const nodeData = Array.from(nodes).map(name => ({
      id: name,
      name,
      symbolSize: Math.max(20, Math.min(60, (nodeWeights[name] || 0.5) * 40)),
      itemStyle: {
        color: nodeWeights[name] > 0.7 ? '#00f5ff' : nodeWeights[name] > 0.4 ? '#b829f7' : '#3b82f6'
      },
      label: {
        show: true,
        fontSize: 11,
        color: '#e2e8f0'
      }
    }));

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(21, 27, 61, 0.95)',
        borderColor: 'rgba(0, 245, 255, 0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            const rule = rules[params.dataIndex];
            return `${rule.antecedent_str || rule.antecedent.join(' + ')} → ${rule.consequent}<br/>
                    置信度: ${(rule.confidence * 100).toFixed(1)}%<br/>
                    提升度: ${rule.lift.toFixed(2)}`;
          }
          return params.name;
        }
      },
      legend: {
        data: ['强关联', '弱关联'],
        textStyle: { color: '#94a3b8' },
        bottom: 0
      },
      series: [{
        type: 'graph',
        layout: 'force',
        animation: true,
        roam: true,
        draggable: true,
        data: nodeData,
        edges: edges,
        force: {
          repulsion: 300,
          edgeLength: [80, 150],
          gravity: 0.1
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 8 }
        }
      }]
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [rules]);

  return (
    <div className="space-y-4">
      <div ref={chartRef} className="w-full h-80" />
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#00f5ff]" />
          <span className="text-[var(--text-muted)]">高频节点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#b829f7]" />
          <span className="text-[var(--text-muted)]">中频节点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-0.5 bg-[#00ff9d]" />
          <span className="text-[var(--text-muted)]">lift &gt; 1（正相关）</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-0.5 bg-[#ff0080]" />
          <span className="text-[var(--text-muted)]">lift &lt; 1（负相关）</span>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center">
        提示：可拖拽节点调整布局，滚轮缩放，点击节点查看关联
      </p>
    </div>
  );
}
