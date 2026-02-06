import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  Database,
  FileSpreadsheet,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  Clock,
  LayoutDashboard,
  Grid3X3,
  Plus,
  X,
  Download,
  Eye,
  Settings2,
  Move,
  Trash2,
  Check,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Zap,
  Upload,
  History,
  Sparkles,
  BarChart2,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { datasetApi, analysisApi } from '@/api';
import { quickRequest } from '@/lib/request';
import type { Dataset, Analysis } from '@/types/api';
import gsap from 'gsap';
import * as echarts from 'echarts';
import { toast } from 'sonner';

// ============ Types ============
type DashboardView = 'overview' | 'custom';
type LayoutType = 'uniform' | 'mixed' | 'free';

interface DashboardWidget {
  id: string;
  type: 'chart' | 'visualization';
  analysisId?: string;
  analysisType?: string;
  datasetName?: string;
  vizConfig?: any; // 可视化配置
  vizData?: any;   // 可视化数据
  title: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

interface CustomDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layoutType: LayoutType; // 布局类型
}

// 已保存的可视化结果接口
interface SavedVisualization {
  id: string;
  name: string;
  datasetId: string;
  datasetName: string;
  config: any;
  data: any;
  createdAt: string;
}

// Analysis type icons
const typeIcons: Record<string, any> = {
  descriptive: BarChart3,
  correlation: Activity,
  clustering: Grid3X3,
  forecast: LineChart,
  attribution: TrendingUp,
  visualization: PieChart,
  comprehensive: Activity,
  smart_process: Settings2,
  statistics: BarChart3,
  time_series: LineChart,
  rfm: Grid3X3,
  funnel: TrendingUp,
  path: ArrowUpRight,
};

const typeLabels: Record<string, string> = {
  descriptive: '描述统计',
  correlation: '相关分析',
  clustering: '聚类分析',
  forecast: '时序预测',
  attribution: '归因分析',
  visualization: '可视化',
  comprehensive: '综合分析',
  smart_process: '智能处理',
  statistics: '统计分析',
  time_series: '时间序列',
  rfm: 'RFM分析',
  funnel: '漏斗分析',
  path: '路径分析',
};

// Color constants for ECharts (CSS variables don't work in Canvas)
const COLORS = {
  cyan: '#00f5ff',
  purple: '#b829f7',
  green: '#00ff9f',
  pink: '#ff006e',
  orange: '#ff6b35',
  yellow: '#ffd700',
  blue: '#3a86ff',
  indigo: '#8338ec',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  borderSubtle: 'rgba(148, 163, 184, 0.2)',
  bgPrimary: '#0a0e27',
  bgSecondary: '#151b3d',
};

// ============ Main Component ============
export function Dashboard() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [customDashboards, setCustomDashboards] = useState<CustomDashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>('');
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [editingLayout, setEditingLayout] = useState(false);
  
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [savedVisualizations, setSavedVisualizations] = useState<SavedVisualization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState('');
  const [usingCache, setUsingCache] = useState(false);

  const chartInstancesRef = useRef<Map<string, echarts.ECharts>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Load data with timeout and cache fallback
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadingSlow(false);
        setError('');
        setUsingCache(false);

        // Set a timer to show "loading slow" message after 2 seconds
        const slowTimer = setTimeout(() => {
          setLoadingSlow(true);
        }, 2000);

        // Helper function to wrap promises with timeout
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
              setTimeout(() => reject(new Error('请求超时')), timeoutMs)
            )
          ]);
        };

        // Try to fetch data with 5 second timeout
        let datasetsItems: Dataset[] = [];
        let analysesItems: Analysis[] = [];
        let fetchSuccess = false;

        try {
          const [datasetsRes, analysesRes] = await withTimeout(
            Promise.all([
              quickRequest.get('/datasets', { params: { page: 1, page_size: 20 } }),
              quickRequest.get('/analyses', { params: { page: 1, page_size: 20 } })
            ]),
            5000
          );
          
          const datasetsData = datasetsRes as any;
          const analysesData = analysesRes as any;
          datasetsItems = datasetsData.items || datasetsData.data?.items || [];
          analysesItems = analysesData.items || analysesData.data?.items || [];
          fetchSuccess = true;

          // Cache successful results to localStorage
          localStorage.setItem('insightease_cached_datasets', JSON.stringify(datasetsItems));
          localStorage.setItem('insightease_cached_analyses', JSON.stringify(analysesItems));
        } catch (fetchErr: any) {
          console.warn('API fetch failed or timed out:', fetchErr);
          
          // Try to load from cache
          const cachedDatasets = localStorage.getItem('insightease_cached_datasets');
          const cachedAnalyses = localStorage.getItem('insightease_cached_analyses');
          
          if (cachedDatasets || cachedAnalyses) {
            datasetsItems = cachedDatasets ? JSON.parse(cachedDatasets) : [];
            analysesItems = cachedAnalyses ? JSON.parse(cachedAnalyses) : [];
            setUsingCache(true);
            toast.info('使用本地缓存数据（API暂时不可用）');
          } else {
            throw new Error(fetchErr.message || '加载数据失败，且无缓存数据可用');
          }
        }
        
        setDatasets(datasetsItems);
        setAnalyses(analysesItems.filter((a: Analysis) => a.status === 'completed'));
        
        // Load saved visualizations from localStorage
        const savedViz = localStorage.getItem('insightease_visualizations');
        if (savedViz) {
          setSavedVisualizations(JSON.parse(savedViz));
        }
        
        // Load custom dashboards from localStorage
        const saved = localStorage.getItem('insightease_dashboards');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // 向后兼容：转换旧数据格式
            const migrated = parsed.map((d: any) => ({
              ...d,
              layoutType: d.layoutType || 'uniform', // 默认统一布局
              widgets: (d.widgets || []).map((w: any) => ({
                ...w,
                size: w.size || { w: 1, h: 1 }, // 默认大小
                position: w.position || { x: 0, y: 0 }
              }))
            }));
            setCustomDashboards(migrated);
            if (migrated.length > 0 && !activeDashboardId) {
              setActiveDashboardId(migrated[0].id);
            }
          } catch (e) {
            // 数据损坏，创建默认看板
            console.error('Failed to parse dashboards:', e);
            const defaultDashboard: CustomDashboard = {
              id: 'default',
              name: '我的看板',
              widgets: [],
              layoutType: 'uniform'
            };
            setCustomDashboards([defaultDashboard]);
            setActiveDashboardId('default');
          }
        } else {
          const defaultDashboard: CustomDashboard = {
            id: 'default',
            name: '我的看板',
            widgets: [],
            layoutType: 'uniform'
          };
          setCustomDashboards([defaultDashboard]);
          setActiveDashboardId('default');
        }

        clearTimeout(slowTimer);
      } catch (err: any) {
        setError(err.message || '加载数据失败');
      } finally {
        setLoading(false);
        setLoadingSlow(false);
      }
    };
    
    loadData();
  }, []);

  // Save dashboards to localStorage
  useEffect(() => {
    if (customDashboards.length > 0) {
      localStorage.setItem('insightease_dashboards', JSON.stringify(customDashboards));
    }
  }, [customDashboards]);

  // Cleanup chart instances
  useEffect(() => {
    return () => {
      chartInstancesRef.current.forEach(instance => instance.dispose());
      chartInstancesRef.current.clear();
    };
  }, []);

  const activeDashboard = customDashboards.find(d => d.id === activeDashboardId);

  const createDashboard = () => {
    const newDashboard: CustomDashboard = {
      id: `dashboard_${Date.now()}`,
      name: `看板 ${customDashboards.length + 1}`,
      widgets: [],
      layoutType: 'uniform'
    };
    setCustomDashboards(prev => [...prev, newDashboard]);
    setActiveDashboardId(newDashboard.id);
    toast.success('新看板已创建');
  };

  const deleteDashboard = (id: string) => {
    setCustomDashboards(prev => prev.filter(d => d.id !== id));
    if (activeDashboardId === id) {
      const remaining = customDashboards.filter(d => d.id !== id);
      setActiveDashboardId(remaining.length > 0 ? remaining[0].id : '');
    }
    toast.success('看板已删除');
  };

  const addWidget = (item: Analysis | SavedVisualization, type: 'analysis' | 'visualization') => {
    if (!activeDashboard) return;
    
    let newWidget: DashboardWidget;
    
    if (type === 'analysis') {
      const analysis = item as Analysis;
      const dataset = datasets.find(d => d.id === analysis.dataset_id);
      newWidget = {
        id: `widget_${Date.now()}`,
        type: 'chart',
        analysisId: analysis.id,
        analysisType: analysis.type,
        datasetName: dataset?.filename || '未知数据集',
        title: `${typeLabels[analysis.type] || analysis.type} - ${dataset?.filename || '未知'}`,
        position: { x: 0, y: 0 },
        size: { w: 1, h: 1 }
      };
    } else {
      const viz = item as SavedVisualization;
      newWidget = {
        id: `widget_${Date.now()}`,
        type: 'visualization',
        vizConfig: viz.config,
        vizData: viz.data,
        title: viz.name,
        position: { x: 0, y: 0 },
        size: { w: 1, h: 1 }
      };
    }

    setCustomDashboards(prev => prev.map(d => 
      d.id === activeDashboardId 
        ? { ...d, widgets: [...d.widgets, newWidget] }
        : d
    ));
    setShowWidgetSelector(false);
    toast.success('图表已添加');
  };

  const removeWidget = (widgetId: string) => {
    setCustomDashboards(prev => prev.map(d => 
      d.id === activeDashboardId 
        ? { ...d, widgets: d.widgets.filter(w => w.id !== widgetId) }
        : d
    ));
    const instance = chartInstancesRef.current.get(widgetId);
    if (instance) {
      instance.dispose();
      chartInstancesRef.current.delete(widgetId);
    }
  };

  // 删除保存的可视化结果
  const deleteVisualization = (vizId: string) => {
    setSavedVisualizations(prev => {
      const updated = prev.filter(v => v.id !== vizId);
      localStorage.setItem('insightease_visualizations', JSON.stringify(updated));
      return updated;
    });
    toast.success('可视化结果已删除');
  };

  // Render chart for widget
  const renderChart = useCallback((widget: DashboardWidget, container: HTMLDivElement | null) => {
    if (!container) return;
    
    const oldInstance = chartInstancesRef.current.get(widget.id);
    if (oldInstance) oldInstance.dispose();

    const instance = echarts.init(container);
    chartInstancesRef.current.set(widget.id, instance);

    let option: echarts.EChartsOption;
    
    if (widget.type === 'visualization' && widget.vizConfig && widget.vizData) {
      // 渲染可视化结果
      option = generateVizOption(widget.vizConfig, widget.vizData);
    } else {
      // 渲染分析结果
      const analysis = analyses.find(a => a.id === widget.analysisId);
      if (!analysis?.result_data) return;
      option = generateChartOption(analysis.type, analysis.result_data);
    }
    
    instance.setOption(option);

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [analyses]);

  // 布局辅助函数
  const getLayoutClass = (layoutType: LayoutType): string => {
    switch (layoutType) {
      case 'uniform':
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
      case 'mixed':
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min';
      case 'free':
        return 'grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
    }
  };

  const getWidgetClass = (layoutType: LayoutType, index: number): string => {
    const baseClass = 'relative group ';
    switch (layoutType) {
      case 'uniform':
        return baseClass;
      case 'mixed':
        // 混合布局：让某些图表更大，创建视觉层次
        // 第1、5、9...个占据2列，其他占据1列
        if (index % 4 === 0) {
          return baseClass + 'md:col-span-2 xl:col-span-2'; // 大图
        } else if (index % 4 === 2) {
          return baseClass + 'xl:col-span-2'; // 中等图（只在xl屏幕）
        }
        return baseClass; // 小图
      case 'free':
        return baseClass;
      default:
        return baseClass;
    }
  };
  
  // 获取混合布局下widget的高度
  const getWidgetHeight = (layoutType: LayoutType, index: number): string => {
    if (layoutType === 'mixed') {
      if (index % 4 === 0) {
        return '320px'; // 大图更高
      }
    }
    return '200px';
  };

  // 调整 widget 大小
  const resizeWidget = (widgetId: string, action: 'enlarge' | 'shrink') => {
    setCustomDashboards(prev => prev.map(d => {
      if (d.id !== activeDashboardId) return d;
      return {
        ...d,
        widgets: d.widgets.map(w => {
          if (w.id !== widgetId) return w;
          if (action === 'enlarge') {
            return { ...w, size: { w: Math.min(w.size.w + 1, 3), h: Math.min(w.size.h + 1, 3) } };
          } else {
            return { ...w, size: { w: Math.max(w.size.w - 1, 1), h: Math.max(w.size.h - 1, 1) } };
          }
        })
      };
    }));
  };

  // Export functions
  const exportDashboard = async (format: 'png' | 'json') => {
    if (!activeDashboard || activeDashboard.widgets.length === 0) {
      toast.error('看板为空');
      return;
    }

    if (format === 'json') {
      const data = {
        name: activeDashboard.name,
        exportTime: new Date().toISOString(),
        widgets: activeDashboard.widgets.map(w => ({
          ...w,
          analysisData: analyses.find(a => a.id === w.analysisId)?.result_data
        }))
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${activeDashboard.name}.json`);
      toast.success('看板配置已导出');
    } else {
      toast.info('正在生成图片...');
      for (const widget of activeDashboard.widgets) {
        const instance = chartInstancesRef.current.get(widget.id);
        if (instance) {
          const url = instance.getDataURL({ type: 'png', pixelRatio: 2 });
          const link = document.createElement('a');
          link.download = `${widget.title}.png`;
          link.href = url;
          link.click();
          await new Promise(r => setTimeout(r, 300));
        }
      }
      toast.success('所有图表已导出');
    }
  };

  const exportSingleChart = (widgetId: string) => {
    const instance = chartInstancesRef.current.get(widgetId);
    if (!instance) return;
    
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2 });
    const widget = activeDashboard?.widgets.find(w => w.id === widgetId);
    
    // 生成文件名：数据集_图表名称
    let filename: string;
    if (widget?.type === 'visualization') {
      const vizData = widget.vizConfig;
      const datasetName = widget.datasetName || 'unknown';
      const chartType = vizData?.type || 'chart';
      filename = `${datasetName}_${chartType}`;
    } else if (widget?.datasetName) {
      const analysisType = typeLabels[widget.analysisType || ''] || widget.analysisType || 'analysis';
      filename = `${widget.datasetName}_${analysisType}`;
    } else {
      filename = widget?.title || 'chart';
    }
    
    // 清理文件名中的非法字符
    filename = filename.replace(/[\\/:*?"<>|]/g, '_');
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = url;
    link.click();
    toast.success('图表已导出');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--neon-cyan)]" />
        <div className="text-center">
          <p className="text-[var(--text-secondary)]">
            {loadingSlow ? '加载较慢，请稍候...' : '加载中...'}
          </p>
          {loadingSlow && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              数据量较大或网络延迟
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--neon-pink)] gap-4">
        <AlertCircle className="w-12 h-12" />
        <p>{error}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline" className="border-[var(--neon-pink)] text-[var(--neon-pink)]">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-1 text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-[var(--text-secondary)] mt-1">数据概览与自定义看板</p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <button
            onClick={() => setCurrentView('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              currentView === 'overview'
                ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            概览
          </button>
          <button
            onClick={() => setCurrentView('custom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              currentView === 'custom'
                ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            自定义看板
          </button>
        </div>
      </div>

      {/* Overview Dashboard */}
      {currentView === 'overview' && (
        <OverviewDashboard datasets={datasets} analyses={analyses} />
      )}

      {/* Custom Dashboard */}
      {currentView === 'custom' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <select
                value={activeDashboardId}
                onChange={(e) => setActiveDashboardId(e.target.value)}
                className="px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
              >
                {customDashboards.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              
              <Button size="sm" variant="ghost" onClick={createDashboard} className="text-[var(--neon-cyan)]">
                <Plus className="w-4 h-4 mr-1" />
                新建
              </Button>
              
              {activeDashboard && customDashboards.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => deleteDashboard(activeDashboardId)} className="text-[var(--neon-pink)]">
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 布局模式选择 */}
              {activeDashboard && (
                <select
                  value={activeDashboard.layoutType}
                  onChange={(e) => {
                    const newLayoutType = e.target.value as LayoutType;
                    setCustomDashboards(prev => prev.map(d => 
                      d.id === activeDashboardId 
                        ? { ...d, layoutType: newLayoutType }
                        : d
                    ));
                    toast.success(`已切换到${newLayoutType === 'uniform' ? '统一布局' : newLayoutType === 'mixed' ? '混合布局' : '自由布局'}`);
                  }}
                  className="px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
                >
                  <option value="uniform">统一布局</option>
                  <option value="mixed">混合布局</option>
                  <option value="free">自由布局</option>
                </select>
              )}
              
              <Button size="sm" variant="outline" onClick={() => setEditingLayout(!editingLayout)} className={editingLayout ? 'border-[var(--neon-cyan)] text-[var(--neon-cyan)]' : ''}>
                <Move className="w-4 h-4 mr-1" />
                {editingLayout ? '完成' : '调整布局'}
              </Button>
              
              <Button size="sm" onClick={() => setShowWidgetSelector(true)} className="bg-[var(--neon-cyan)] text-[var(--bg-primary)]">
                <Plus className="w-4 h-4 mr-1" />
                添加图表
              </Button>

              {activeDashboard && activeDashboard.widgets.length > 0 && (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border-subtle)]">
                  <Button size="sm" variant="ghost" onClick={() => exportDashboard('png')} title="导出所有图表">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportDashboard('json')} title="导出看板配置">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Dashboard Content */}
          {activeDashboard && (
            <>
              {activeDashboard.widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-lg border-2 border-dashed border-[var(--border-subtle)]">
                  <Grid3X3 className="w-16 h-16 text-[var(--text-muted)] mb-4" />
                  <p className="text-[var(--text-secondary)] mb-2">看板为空</p>
                  <p className="text-sm text-[var(--text-muted)] mb-4">添加图表来创建您的自定义看板</p>
                  <Button onClick={() => setShowWidgetSelector(true)} className="bg-[var(--neon-cyan)] text-[var(--bg-primary)]">
                    <Plus className="w-4 h-4 mr-2" />
                    添加图表
                  </Button>
                </div>
              ) : (
                <div className={getLayoutClass(activeDashboard.layoutType)}>
                  {activeDashboard.widgets.map((widget, index) => (
                    <div 
                      key={widget.id} 
                      className={getWidgetClass(activeDashboard.layoutType, index)}
                      style={{ 
                        animationDelay: `${index * 0.1}s`,
                        ...(activeDashboard.layoutType === 'free' ? {
                          gridColumn: widget.size.w > 1 ? `span ${widget.size.w}` : undefined,
                          gridRow: widget.size.h > 1 ? `span ${widget.size.h}` : undefined,
                        } : {})
                      }}
                    >
                      <Card className="glass border-[var(--border-subtle)] overflow-hidden h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-[var(--text-primary)] truncate">{widget.title}</CardTitle>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {editingLayout && activeDashboard.layoutType === 'free' && (
                                <>
                                  <button 
                                    onClick={() => resizeWidget(widget.id, 'enlarge')} 
                                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--neon-cyan)] hover:bg-[var(--bg-tertiary)]" 
                                    title="放大"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={() => resizeWidget(widget.id, 'shrink')} 
                                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--neon-orange)] hover:bg-[var(--bg-tertiary)]" 
                                    title="缩小"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => exportSingleChart(widget.id)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--neon-cyan)] hover:bg-[var(--bg-tertiary)]" title="导出图片">
                                <ImageIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeWidget(widget.id)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--neon-pink)] hover:bg-[var(--bg-tertiary)]" title="移除">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">{typeLabels[widget.analysisType] || widget.analysisType || '可视化'} · {widget.datasetName}</p>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex-1">
                          <div 
                            ref={(el) => renderChart(widget, el)} 
                            className="w-full h-full" 
                            style={{ 
                              height: activeDashboard.layoutType === 'free' && widget.size.h > 1 
                                ? `${widget.size.h * 250}px` 
                                : getWidgetHeight(activeDashboard.layoutType, index)
                            }} 
                          />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Widget Selector Modal */}
      {showWidgetSelector && (
        <WidgetSelector 
          analyses={analyses} 
          datasets={datasets} 
          visualizations={savedVisualizations}
          onSelect={addWidget} 
          onClose={() => setShowWidgetSelector(false)} 
          onDeleteViz={deleteVisualization}
        />
      )}
    </div>
  );
}

// ============ Overview Dashboard Component ============
function OverviewDashboard({ datasets, analyses }: { datasets: Dataset[]; analyses: Analysis[] }) {
  const navigate = useNavigate();
  const cardsRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const storageChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const typeChartRef = useRef<HTMLDivElement>(null);
  const bottomSectionRef = useRef<HTMLDivElement>(null);
  
  const storageChartInstance = useRef<echarts.ECharts | null>(null);
  const trendChartInstance = useRef<echarts.ECharts | null>(null);
  const typeChartInstance = useRef<echarts.ECharts | null>(null);

  const totalDatasets = datasets.length;
  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);
  const totalAnalyses = analyses.length;
  const completedAnalyses = analyses.filter(a => a.status === 'completed').length;
  
  // 获取最近的活动（数据集和分析）
  const recentActivities = [
    ...datasets.slice(0, 3).map(d => ({ type: 'dataset' as const, name: d.filename, date: d.created_at, id: d.id })),
    ...analyses.slice(0, 3).map(a => ({ type: 'analysis' as const, name: typeLabels[a.type] || a.type, date: a.created_at, id: a.id, status: a.status }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  useEffect(() => {
    if (!datasets.length) return;

    // Storage pie chart
    if (storageChartRef.current) {
      storageChartInstance.current = echarts.init(storageChartRef.current);
      const storageData = datasets.slice(0, 8).map(d => ({
        name: d.filename.length > 15 ? d.filename.substring(0, 15) + '...' : d.filename,
        value: d.file_size || 0
      }));
      
      storageChartInstance.current.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => `${params.name}: ${formatBytes(params.value)}`
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          itemStyle: { borderRadius: 8, borderColor: COLORS.bgPrimary, borderWidth: 2 },
          label: { color: COLORS.textSecondary, fontSize: 10 },
          data: storageData.map((d, i) => ({
            ...d,
            itemStyle: { color: [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.orange, COLORS.yellow, COLORS.pink, COLORS.indigo, COLORS.blue][i % 8] }
          }))
        }]
      });
    }

    // Trend line chart
    if (trendChartRef.current) {
      trendChartInstance.current = echarts.init(trendChartRef.current);
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });
      const dailyCounts = last7Days.map(date => analyses.filter(a => a.created_at?.startsWith(date)).length);
      
      trendChartInstance.current.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.cyan, textStyle: { color: COLORS.textPrimary } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
        xAxis: { type: 'category', data: last7Days.map(d => d.slice(5)), axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
        yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
        series: [{
          data: dailyCounts,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: COLORS.cyan, width: 3 },
          itemStyle: { color: COLORS.cyan },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 245, 255, 0.3)' }, { offset: 1, color: 'rgba(0, 245, 255, 0)' }]) }
        }]
      });
    }

    // Type bar chart
    if (typeChartRef.current) {
      typeChartInstance.current = echarts.init(typeChartRef.current);
      const typeCount: Record<string, number> = {};
      analyses.forEach(a => { typeCount[a.type] = (typeCount[a.type] || 0) + 1; });
      const types = Object.keys(typeCount);
      const counts = Object.values(typeCount);
      
      typeChartInstance.current.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.purple, textStyle: { color: COLORS.textPrimary } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
        xAxis: { type: 'category', data: types.map(t => typeLabels[t] || t), axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10, rotate: types.length > 4 ? 30 : 0 } },
        yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
        series: [{
          data: counts,
          type: 'bar',
          barWidth: '60%',
          itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLORS.purple }, { offset: 1, color: 'rgba(184, 41, 247, 0.3)' }]) }
        }]
      });
    }

    const handleResize = () => {
      storageChartInstance.current?.resize();
      trendChartInstance.current?.resize();
      typeChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      storageChartInstance.current?.dispose();
      trendChartInstance.current?.dispose();
      typeChartInstance.current?.dispose();
    };
  }, [datasets, analyses]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardsRef.current?.children || [], { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out' });
      gsap.fromTo(chartsRef.current?.children || [], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out', delay: 0.4 });
      gsap.fromTo(bottomSectionRef.current?.children || [], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.8 });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Database} label="数据集" value={totalDatasets} color="cyan" />
        <StatCard icon={FileSpreadsheet} label="总数据行数" value={totalRows.toLocaleString()} color="purple" />
        <StatCard icon={Activity} label="分析任务" value={totalAnalyses} color="green" />
        <StatCard icon={Clock} label="已完成" value={completedAnalyses} color="pink" />
      </div>

      {/* Charts */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader><CardTitle className="text-base text-[var(--text-primary)]">存储分布</CardTitle></CardHeader>
          <CardContent><div ref={storageChartRef} className="h-64" /></CardContent>
        </Card>
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader><CardTitle className="text-base text-[var(--text-primary)]">分析趋势 (7天)</CardTitle></CardHeader>
          <CardContent><div ref={trendChartRef} className="h-64" /></CardContent>
        </Card>
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader><CardTitle className="text-base text-[var(--text-primary)]">分析类型分布</CardTitle></CardHeader>
          <CardContent><div ref={typeChartRef} className="h-64" /></CardContent>
        </Card>
      </div>
      
      {/* Bottom Section: Quick Actions & Recent Activity */}
      <div ref={bottomSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base text-[var(--text-primary)] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--neon-cyan)]" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button 
              onClick={() => navigate('/app/upload')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/30 transition-colors">
                <Upload className="w-5 h-5 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">上传数据</p>
                <p className="text-xs text-[var(--text-muted)]">导入 CSV / Excel 文件</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/app/smart-analysis')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--neon-purple)]/50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-purple)]/20 flex items-center justify-center group-hover:bg-[var(--neon-purple)]/30 transition-colors">
                <Sparkles className="w-5 h-5 text-[var(--neon-purple)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">智能分析</p>
                <p className="text-xs text-[var(--text-muted)]">AI 驱动的数据分析</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/app/visualization')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--neon-green)]/50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center group-hover:bg-[var(--neon-green)]/30 transition-colors">
                <BarChart2 className="w-5 h-5 text-[var(--neon-green)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">可视化</p>
                <p className="text-xs text-[var(--text-muted)]">创建图表和看板</p>
              </div>
            </button>
          </CardContent>
        </Card>
        
        {/* Recent Activity */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-[var(--text-primary)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--neon-purple)]" />
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p>暂无活动记录</p>
                <p className="text-sm mt-1">开始上传数据或创建分析</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        activity.type === 'dataset' 
                          ? 'bg-[var(--neon-cyan)]/20' 
                          : activity.status === 'completed'
                          ? 'bg-[var(--neon-green)]/20'
                          : activity.status === 'failed'
                          ? 'bg-[var(--neon-pink)]/20'
                          : 'bg-[var(--neon-orange)]/20'
                      }`}>
                        {activity.type === 'dataset' ? (
                          <Database className="w-4 h-4 text-[var(--neon-cyan)]" />
                        ) : activity.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--neon-green)]" />
                        ) : activity.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-[var(--neon-pink)]" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-[var(--neon-orange)] animate-spin" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{activity.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {activity.type === 'dataset' ? '数据集' : '分析任务'} · {new Date(activity.date).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => navigate(activity.type === 'dataset' ? '/app/datasets' : '/app/history')}
                      className="text-[var(--text-muted)] hover:text-[var(--neon-cyan)]"
                    >
                      查看
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ Stat Card Component ============
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: 'cyan' | 'purple' | 'green' | 'pink' }) {
  const colorMap = {
    cyan: 'text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/20',
    purple: 'text-[var(--neon-purple)] bg-[var(--neon-purple)]/20',
    green: 'text-[var(--neon-green)] bg-[var(--neon-green)]/20',
    pink: 'text-[var(--neon-pink)] bg-[var(--neon-pink)]/20',
  };
  
  return (
    <Card className="glass border-[var(--border-subtle)]">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mono">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Widget Selector Component ============
function WidgetSelector({ analyses, datasets, visualizations, onSelect, onClose, onDeleteViz }: { analyses: Analysis[]; datasets: Dataset[]; visualizations: SavedVisualization[]; onSelect: (item: any, type: 'analysis' | 'visualization') => void; onClose: () => void; onDeleteViz?: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'visualization'>('analysis');
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const completedAnalyses = analyses.filter(a => a.status === 'completed');
  const analysisTypes = ['all', ...new Set(completedAnalyses.map(a => a.type))];
  
  const filteredAnalyses = completedAnalyses.filter(a => {
    const matchesType = selectedType === 'all' || a.type === selectedType;
    const dataset = datasets.find(d => d.id === a.dataset_id);
    const matchesFilter = !filter || (typeLabels[a.type] || a.type).toLowerCase().includes(filter.toLowerCase()) || dataset?.filename.toLowerCase().includes(filter.toLowerCase());
    return matchesType && matchesFilter;
  });
  
  const filteredVisualizations = visualizations.filter(v => 
    !filter || v.name.toLowerCase().includes(filter.toLowerCase()) || v.datasetName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">选择要展示的图表</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {activeTab === 'analysis' ? `${completedAnalyses.length} 个分析结果` : `${visualizations.length} 个可视化结果`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        
        {/* Tab Switch */}
        <div className="flex border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === 'analysis'
                ? 'text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            分析结果
          </button>
          <button
            onClick={() => setActiveTab('visualization')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === 'visualization'
                ? 'text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <PieChart className="w-4 h-4 inline mr-2" />
            可视化结果
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border-subtle)] space-y-3">
          <input 
            type="text" 
            placeholder={activeTab === 'analysis' ? "搜索分析或数据集..." : "搜索可视化..."} 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)} 
            className="w-full px-4 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" 
          />
          {activeTab === 'analysis' && (
            <div className="flex flex-wrap gap-2">
              {analysisTypes.map(type => (
                <button key={type} onClick={() => setSelectedType(type)} className={`px-3 py-1 rounded-full text-xs transition-all ${selectedType === type ? 'bg-[var(--neon-cyan)] text-[var(--bg-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                  {type === 'all' ? '全部' : (typeLabels[type] || type)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'analysis' ? (
            filteredAnalyses.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]"><p>没有找到匹配的分析结果</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAnalyses.map(analysis => {
                  const Icon = typeIcons[analysis.type] || BarChart3;
                  const dataset = datasets.find(d => d.id === analysis.dataset_id);
                  return (
                    <button key={analysis.id} onClick={() => onSelect(analysis, 'analysis')} className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left">
                      <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-[var(--neon-cyan)]" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">{typeLabels[analysis.type] || analysis.type}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{dataset?.filename || '未知数据集'}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">{new Date(analysis.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                      <Plus className="w-4 h-4 text-[var(--neon-green)] flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            filteredVisualizations.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <p>暂无保存的可视化结果</p>
                <p className="text-sm mt-2">在「可视化分析」页面创建并保存图表</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredVisualizations.map(viz => (
                  <div key={viz.id} className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] group">
                    <button 
                      onClick={() => onSelect(viz, 'visualization')} 
                      className="flex items-start gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[var(--neon-purple)]/20 flex items-center justify-center flex-shrink-0"><PieChart className="w-5 h-5 text-[var(--neon-purple)]" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">{viz.name}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{viz.datasetName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">{new Date(viz.createdAt).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </button>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => onSelect(viz, 'visualization')}
                        className="p-2 rounded-lg text-[var(--neon-green)] hover:bg-[var(--neon-green)]/20 transition-colors"
                        title="添加到看板"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {onDeleteViz && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteViz(viz.id);
                          }}
                          className="p-2 rounded-lg text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Chart Option Generator ============
function generateChartOption(type: string, result: any): echarts.EChartsOption {
  const baseOption: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.cyan, textStyle: { color: COLORS.textPrimary } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true }
  };

  switch (type) {
    case 'statistics':
    case 'descriptive':
      if (result.histogram || result.distribution) {
        const data = result.histogram || result.distribution;
        return {
          ...baseOption,
          xAxis: { type: 'category', data: data.map((d: any) => d.bin || d.range || d.label), axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          series: [{ type: 'bar', data: data.map((d: any) => d.count || d.value || d.frequency), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLORS.cyan }, { offset: 1, color: 'rgba(0, 245, 255, 0.3)' }]), borderRadius: [4, 4, 0, 0] } }]
        };
      }
      break;

    case 'time_series':
    case 'forecast':
      if (result.forecast || result.trend || result.data) {
        const data = result.forecast || result.trend || result.data;
        const dates = data.map((d: any) => d.date || d.timestamp || d.time).slice(-30);
        const values = data.map((d: any) => d.value || d.prediction || d.actual).slice(-30);
        return {
          ...baseOption,
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          series: [{ type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: COLORS.cyan, width: 2 }, itemStyle: { color: COLORS.cyan }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 245, 255, 0.3)' }, { offset: 1, color: 'rgba(0, 245, 255, 0)' }]) } }]
        };
      }
      break;

    case 'clustering':
      if (result.clusters || result.labels) {
        const uniqueClusters = [...new Set(result.labels || [])];
        return {
          ...baseOption,
          tooltip: { trigger: 'item' },
          xAxis: { type: 'value', axisLine: { lineStyle: { color: COLORS.borderSubtle } }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          yAxis: { type: 'value', axisLine: { lineStyle: { color: COLORS.borderSubtle } }, splitLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          series: uniqueClusters.map((clusterId, idx) => ({
            type: 'scatter',
            name: `Cluster ${clusterId}`,
            data: (result.clusters || []).filter((c: any) => c.cluster === clusterId || c.label === clusterId).map((c: any) => [c.x || c[0], c.y || c[1]]),
            symbolSize: 10,
            itemStyle: { color: [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.pink, COLORS.orange][idx % 5] }
          }))
        };
      }
      break;

    case 'path':
      if (result.paths || result.flows || result.nodes) {
        const nodes = result.nodes || [];
        const links = result.links || result.flows || [];
        return {
          ...baseOption,
          tooltip: { trigger: 'item', triggerOn: 'mousemove' },
          series: [{
            type: 'sankey',
            layout: 'none',
            emphasis: { focus: 'adjacency' },
            data: nodes.map((n: any) => ({ name: n.name || n.id || n })),
            links: links.map((l: any) => ({ source: typeof l.source === 'string' ? l.source : nodes[l.source]?.name, target: typeof l.target === 'string' ? l.target : nodes[l.target]?.name, value: l.value || l.count || l.weight })),
            lineStyle: { color: 'gradient', curveness: 0.5 },
            itemStyle: { color: COLORS.cyan },
            label: { color: COLORS.textSecondary, fontSize: 10 }
          }]
        };
      }
      break;

    case 'correlation':
      if (result.correlation_matrix || result.matrix) {
        const matrix = result.correlation_matrix || result.matrix;
        const variables = result.variables || Object.keys(matrix);
        const heatmapData: [number, number, number][] = [];
        variables.forEach((var1: string, i: number) => {
          variables.forEach((var2: string, j: number) => {
            heatmapData.push([i, j, matrix[var1][var2] || matrix[i][j] || 0]);
          });
        });
        return {
          ...baseOption,
          tooltip: { position: 'top', formatter: (params: any) => `${variables[params.data[0]]} vs ${variables[params.data[1]]}: ${params.data[2].toFixed(2)}` },
          xAxis: { type: 'category', data: variables, axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10, rotate: 45 } },
          yAxis: { type: 'category', data: variables, axisLine: { lineStyle: { color: COLORS.borderSubtle } }, axisLabel: { color: COLORS.textMuted, fontSize: 10 } },
          visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%', inRange: { color: [COLORS.pink, '#ffffff', COLORS.green] }, textStyle: { color: COLORS.textMuted } },
          series: [{ type: 'heatmap', data: heatmapData, label: { show: true, formatter: (params: any) => params.data[2].toFixed(1), fontSize: 9 } }]
        };
      }
      break;

    case 'funnel':
      if (result.stages || result.funnel) {
        const stages = result.stages || result.funnel || [];
        return {
          ...baseOption,
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{
            type: 'funnel',
            left: '10%', top: 20, bottom: 20, width: '80%',
            min: 0, max: stages[0]?.value || stages[0]?.count || 100,
            minSize: '0%', maxSize: '100%',
            sort: 'descending', gap: 2,
            label: { show: true, position: 'inside', formatter: '{b}', color: '#fff', fontSize: 10 },
            itemStyle: { borderColor: COLORS.bgPrimary, borderWidth: 1 },
            data: stages.map((s: any, i: number) => ({ value: s.value || s.count || s.users, name: s.stage || s.name || `Stage ${i + 1}`, itemStyle: { color: [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.pink, COLORS.orange][i % 5] } }))
          }]
        };
      }
      break;
  }

  // Default pie chart
  if (Array.isArray(result) && result.length > 0) {
    return {
      ...baseOption,
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        itemStyle: { borderRadius: 8, borderColor: COLORS.bgPrimary, borderWidth: 2 },
        label: { color: COLORS.textSecondary, fontSize: 10 },
        data: result.slice(0, 8).map((d: any, i: number) => ({ name: d.name || d.label || d.category || `Item ${i + 1}`, value: d.value || d.count || d.frequency || 1, itemStyle: { color: [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.pink, COLORS.orange, COLORS.yellow, COLORS.pink, COLORS.indigo][i % 8] } }))
      }]
    };
  }

  // Empty fallback
  return { ...baseOption, title: { show: true, text: '暂无数据', left: 'center', textStyle: { color: COLORS.textMuted, fontSize: 14 } }, xAxis: { type: 'category', data: [], show: false }, yAxis: { type: 'value', show: false }, series: [{ type: 'bar', data: [] }] };
}

// Generate chart option for saved visualization
function generateVizOption(config: any, data: any): echarts.EChartsOption {
  const baseOption: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.cyan, textStyle: { color: COLORS.textPrimary } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true }
  };

  const chartType = config.type || 'bar';
  const xField = config.xAxis;
  const yField = config.yAxis;
  
  // Process data based on chart type
  switch (chartType) {
    case 'bar':
    case 'line':
      return {
        ...baseOption,
        xAxis: { 
          type: 'category', 
          data: data.map((d: any) => d[xField]), 
          axisLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        yAxis: { 
          type: 'value', 
          axisLine: { show: false }, 
          splitLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        series: [{
          type: chartType,
          data: data.map((d: any) => d[yField]),
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLORS.cyan }, { offset: 1, color: 'rgba(0, 245, 255, 0.3)' }]), 
            borderRadius: [4, 4, 0, 0] 
          },
          lineStyle: { color: COLORS.cyan, width: 2 },
          areaStyle: chartType === 'line' ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 245, 255, 0.3)' }, { offset: 1, color: 'rgba(0, 245, 255, 0)' }]) } : undefined
        }]
      };
      
    case 'pie':
      // Aggregate data for pie chart
      const pieData: Record<string, number> = {};
      data.forEach((d: any) => {
        const key = d[xField];
        pieData[key] = (pieData[key] || 0) + (parseFloat(d[yField]) || 0);
      });
      return {
        ...baseOption,
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          itemStyle: { borderRadius: 8, borderColor: COLORS.bgPrimary, borderWidth: 2 },
          label: { color: COLORS.textSecondary, fontSize: 10 },
          data: Object.entries(pieData).map(([name, value], i) => ({ 
            name, 
            value, 
            itemStyle: { color: [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.pink, COLORS.orange, COLORS.yellow, COLORS.indigo, COLORS.blue][i % 8] } 
          }))
        }]
      };
      
    case 'scatter':
      return {
        ...baseOption,
        tooltip: { trigger: 'item' },
        xAxis: { 
          type: 'value', 
          axisLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          splitLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        yAxis: { 
          type: 'value', 
          axisLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          splitLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        series: [{
          type: 'scatter',
          data: data.map((d: any) => [d[xField], d[yField]]),
          symbolSize: 10,
          itemStyle: { color: COLORS.cyan }
        }]
      };
      
    case 'histogram':
      // For histogram, use yField values
      const values = data.map((d: any) => parseFloat(d[yField]) || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bins = 10;
      const step = (max - min) / bins;
      const histogram = new Array(bins).fill(0);
      values.forEach((v: number) => {
        const idx = Math.min(Math.floor((v - min) / step), bins - 1);
        histogram[idx]++;
      });
      return {
        ...baseOption,
        xAxis: { 
          type: 'category', 
          data: histogram.map((_, i) => `${(min + i * step).toFixed(1)}-${(min + (i + 1) * step).toFixed(1)}`), 
          axisLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        yAxis: { 
          type: 'value', 
          axisLine: { show: false }, 
          splitLine: { lineStyle: { color: COLORS.borderSubtle } }, 
          axisLabel: { color: COLORS.textMuted, fontSize: 10 } 
        },
        series: [{
          type: 'bar',
          data: histogram,
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLORS.purple }, { offset: 1, color: 'rgba(184, 41, 247, 0.3)' }]), 
            borderRadius: [4, 4, 0, 0] 
          }
        }]
      };
      
    default:
      return { 
        ...baseOption, 
        title: { show: true, text: '不支持的图表类型', left: 'center', textStyle: { color: COLORS.textMuted, fontSize: 14 } }, 
        xAxis: { type: 'category', data: [], show: false }, 
        yAxis: { type: 'value', show: false }, 
        series: [{ type: 'bar', data: [] }] 
      };
  }
}

// Format bytes
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
