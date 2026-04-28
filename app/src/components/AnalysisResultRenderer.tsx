/**
 * 分析结果渲染器
 * 
 * 支持展示：
 * - 图表（使用 ECharts）
 * - 数据表格
 * - 指标卡片
 * - 文本描述
 */


import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart, ScatterChart, Scatter
} from 'recharts';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, TrendingUp, 
  AlertCircle, CheckCircle, Info, Download
} from 'lucide-react';

import type { AnalysisResult, VisualizationItem } from '@/services/analysis-execution.service';

interface AnalysisResultRendererProps {
  result: AnalysisResult;
  loading?: boolean;
}

// 颜色配置
const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

export function AnalysisResultRenderer({ result, loading }: AnalysisResultRendererProps) {
  if (loading) {
    return <ResultSkeleton />;
  }

  if (result.status === 'failed') {
    return <ErrorDisplay message={result.errorMsg || '分析失败'} />;
  }

  const { summary, visualizations = [], data } = result;

  return (
    <div className="space-y-6 p-4">
      {/* 结果摘要 */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30"
        >
          <CheckCircle className="w-5 h-5 text-[var(--neon-cyan)]" />
          <span className="text-[var(--text-primary)]">{summary}</span>
        </motion.div>
      )}

      {/* 可视化列表 */}
      <div className="space-y-6">
        {visualizations.map((item, index) => (
          <VisualizationItem 
            key={`${item.title}-${index}`} 
            item={item} 
            index={index}
          />
        ))}
      </div>

      {/* 原始数据展示（如果可视化不足） */}
      {visualizations.length === 0 && data && (
        <RawDataDisplay data={data} />
      )}
    </div>
  );
}

/**
 * 单个可视化项
 */
function VisualizationItem({ item, index }: { item: VisualizationItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="bg-[var(--bg-tertiary)]/50 border-[var(--border-subtle)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {item.type === 'chart' && <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)]" />}
            {item.type === 'table' && <Info className="w-4 h-4 text-[var(--neon-purple)]" />}
            {item.type === 'metric' && <TrendingUp className="w-4 h-4 text-[var(--neon-green)]" />}
            {item.title}
          </CardTitle>
          {item.description && (
            <CardDescription>{item.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {item.type === 'chart' && <ChartRenderer config={item.config} />}
          {item.type === 'table' && <TableRenderer data={item.data} />}
          {item.type === 'metric' && <MetricRenderer data={item.data} />}
          {item.type === 'text' && <TextRenderer content={item.data} />}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * 图表渲染器
 */
function ChartRenderer({ config }: { config: any }) {
  const [containerHeight] = useState(300);

  console.log('ChartRenderer 配置:', config);
  
  if (!config) {
    console.warn('ChartRenderer: 配置为空');
    return <div className="text-[var(--text-muted)]">图表配置为空</div>;
  }

  // 如果后端返回了 base64 图片，直接显示并添加下载按钮
  if (config.image_base64) {
    return (
      <div className="flex flex-col items-center gap-3">
        <img 
          src={`data:image/png;base64,${config.image_base64}`} 
          alt={config.title || '图表'}
          className="max-w-full h-auto rounded-lg"
          style={{ maxHeight: containerHeight }}
        />
        <DownloadButton 
          base64Data={config.image_base64} 
          filename={`${config.title || 'chart'}.png`}
        />
      </div>
    );
  }

  const chartType = config.type || 'bar';
  const data = config.data || [];
  const actualData = config.actual || [];

  console.log('图表类型:', chartType, '数据长度:', data.length);

  // 统一数据格式
  const normalizedData = Array.isArray(data) ? data : [];
  
  if (normalizedData.length === 0) {
    console.warn('图表数据为空');
    return <div className="text-[var(--text-muted)]">暂无图表数据</div>;
  }

  // 根据图表类型渲染
  switch (chartType) {
    case 'line':
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={containerHeight}>
          <AreaChart data={normalizedData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis 
              dataKey="ds" 
              stroke="var(--text-muted)"
              fontSize={12}
              tickFormatter={(value) => {
                if (typeof value === 'string' && value.includes('-')) {
                  return value.slice(0, 10);
                }
                return value;
              }}
            />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {actualData.length > 0 && (
              <Area 
                type="monotone" 
                dataKey="y" 
                data={actualData}
                stroke={COLORS[1]} 
                fill={COLORS[1]}
                fillOpacity={0.3}
                name="实际值"
              />
            )}
            <Area 
              type="monotone" 
              dataKey="yhat" 
              stroke={COLORS[0]} 
              fill="url(#colorValue)"
              name="预测值"
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'bar':
    case 'bar_chart':
      // 自动检测数据字段
      if (normalizedData.length > 0) {
        const keys = Object.keys(normalizedData[0]);
        const xKey = keys.find(k => k.includes('name') || k.includes('label') || k.includes('column') || k === 'bin') || keys[0];
        const yKey = keys.find(k => k.includes('value') || k.includes('count') || k === 'count') || keys[1];
        
        return (
          <ResponsiveContainer width="100%" height={containerHeight}>
            <BarChart data={normalizedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey={xKey} stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey={yKey} fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      return <div className="text-[var(--text-muted)]">柱状图数据格式不正确</div>;

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={containerHeight}>
          <PieChart>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Pie
              data={normalizedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {normalizedData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );

    case 'scatter':
    case 'scatter_plot':
      return (
        <ResponsiveContainer width="100%" height={containerHeight}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name={config.x_column || 'X'} 
              stroke="var(--text-muted)"
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name={config.y_column || 'Y'} 
              stroke="var(--text-muted)"
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px'
              }}
            />
            <Scatter data={normalizedData} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'heatmap':
    case 'correlation_heatmap':
      // 简化热力图展示
      return <HeatmapRenderer data={normalizedData} />;
    
    case 'histogram':
      return (
        <ResponsiveContainer width="100%" height={containerHeight}>
          <BarChart data={normalizedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="bin" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="count" fill={COLORS[0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    
    case 'boxplot':
    case 'box':
      // 箱线图用散点图近似展示
      return (
        <ResponsiveContainer width="100%" height={containerHeight}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="column" name="列" stroke="var(--text-muted)" />
            <YAxis dataKey="value" name="值" stroke="var(--text-muted)" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px'
              }}
            />
            <Scatter data={normalizedData} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      // 尝试用柱状图作为默认展示
      if (normalizedData.length > 0 && typeof normalizedData[0] === 'object') {
        const keys = Object.keys(normalizedData[0]);
        const xKey = keys.find(k => k.includes('name') || k.includes('label') || k.includes('x')) || keys[0];
        const yKey = keys.find(k => k.includes('value') || k.includes('count') || k.includes('y')) || keys[1];
        
        if (xKey && yKey) {
          return (
            <ResponsiveContainer width="100%" height={containerHeight}>
              <BarChart data={normalizedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey={xKey} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey={yKey} fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        }
      }
      return <div className="text-[var(--text-muted)]">暂不支持此图表类型: {chartType}</div>;
  }
}

/**
 * 热力图渲染器
 */
function HeatmapRenderer({ data }: { data: any[] }) {
  console.log('HeatmapRenderer 数据:', data);
  
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('HeatmapRenderer: 数据为空');
    return <div className="text-[var(--text-muted)]">热力图数据为空</div>;
  }

  // 计算相关性矩阵
  const firstRow = data[0] || {};
  const columns = Object.keys(firstRow).filter(k => k !== 'column');
  
  console.log('热力图列:', columns);
  
  if (columns.length === 0) {
    console.warn('HeatmapRenderer: 没有列数据');
    return <div className="text-[var(--text-muted)]">热力图列数据为空</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-[var(--text-muted)]"></th>
            {columns.map(col => (
              <th key={col} className="p-2 text-center text-[var(--text-muted)] text-xs">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="p-2 text-[var(--text-muted)] text-xs">{row.column || columns[i]}</td>
              {columns.map(col => {
                const value = row[col];
                const intensity = Math.abs(value || 0);
                const color = value > 0 
                  ? `rgba(6, 182, 212, ${intensity})`  // 正相关 - 青色
                  : `rgba(239, 68, 68, ${intensity})`; // 负相关 - 红色
                
                return (
                  <td 
                    key={col} 
                    className="p-2 text-center text-xs font-mono"
                    style={{ backgroundColor: color }}
                  >
                    {(value || 0).toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 表格渲染器
 */
function TableRenderer({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-[var(--text-muted)]">无数据</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {columns.map(col => (
              <TableHead key={col} className="text-[var(--text-muted)] whitespace-nowrap">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i} className="border-[var(--border-subtle)]">
              {columns.map(col => (
                <TableCell key={col} className="text-[var(--text-primary)] whitespace-nowrap">
                  {formatCellValue(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 指标渲染器
 */
function MetricRenderer({ data }: { data: Record<string, number> }) {
  if (!data || typeof data !== 'object') return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Object.entries(data).map(([key, value]) => (
        <div 
          key={key}
          className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
        >
          <div className="text-xs text-[var(--text-muted)] mb-1">{formatMetricName(key)}</div>
          <div className="text-2xl font-bold text-[var(--neon-cyan)]">
            {typeof value === 'number' ? value.toFixed(4) : value}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 文本渲染器
 */
function TextRenderer({ content }: { content: string }) {
  return (
    <div className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
      {content}
    </div>
  );
}

/**
 * 原始数据展示
 */
function RawDataDisplay({ data }: { data: any }) {
  return (
    <Card className="bg-[var(--bg-tertiary)]/50 border-[var(--border-subtle)]">
      <CardHeader>
        <CardTitle className="text-sm">原始数据</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs text-[var(--text-muted)] overflow-auto max-h-96 p-4 rounded-lg bg-[var(--bg-secondary)]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

/**
 * 错误展示
 */
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-red-400 mb-2">分析失败</h3>
      <p className="text-[var(--text-muted)] max-w-md">{message}</p>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function ResultSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

/**
 * 格式化单元格值
 */
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 50);
  return String(value).slice(0, 100);
}

/**
 * 格式化指标名称
 */
function formatMetricName(name: string): string {
  const nameMap: Record<string, string> = {
    'mae': '平均绝对误差',
    'mse': '均方误差',
    'rmse': '均方根误差',
    'mape': '平均绝对百分比误差',
    'r2': 'R² 决定系数',
    'accuracy': '准确率',
    'precision': '精确率',
    'recall': '召回率',
    'f1': 'F1 分数'
  };
  return nameMap[name.toLowerCase()] || name;
}

/**
 * 下载按钮组件
 */
function DownloadButton({ base64Data, filename }: { base64Data: string; filename: string }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)]/50 transition-colors"
      title="下载图片"
    >
      <Download className="w-3.5 h-3.5" />
      <span>下载图片</span>
    </button>
  );
}
