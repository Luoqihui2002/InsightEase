/**
 * 分析执行服务
 * 
 * 功能：
 * - 封装后端分析 API 调用
 * - 处理异步任务状态轮询
 * - 错误处理和重试机制
 * - 结果缓存
 */

import { analysisApi } from '@/api/analysis';
import type { IntentResult, AnalysisParams, AnalysisType } from './intent-recognition.service';
import type { Analysis } from '@/types/api';

// 分析执行选项
export interface ExecutionOptions {
  datasetId: string;
  onProgress?: (status: string, progress?: number) => void;
  onSuccess?: (result: AnalysisResult) => void;
  onError?: (error: string) => void;
  pollInterval?: number;  // 轮询间隔（毫秒）
  maxRetries?: number;    // 最大重试次数
}

// 分析结果
export interface AnalysisResult {
  analysisId: string;
  type: AnalysisType;
  status: 'completed' | 'failed';
  data: any;
  summary?: string;
  visualizations?: VisualizationItem[];
  errorMsg?: string;
  completedAt?: Date;
}

// 可视化项
export interface VisualizationItem {
  type: 'chart' | 'table' | 'metric' | 'text';
  title: string;
  description?: string;
  config?: any;  // ECharts 配置或其他配置
  data?: any;    // 表格数据或指标值
}

// 分析任务状态
export interface TaskStatus {
  analysisId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: AnalysisResult;
  errorMsg?: string;
}

/**
 * 分析执行服务
 */
class AnalysisExecutionService {
  private activeTasks: Map<string, { abort: () => void }> = new Map();

  /**
   * 根据意图执行分析
   * @param intent 意图识别结果
   * @param options 执行选项
   */
  async executeByIntent(
    intent: IntentResult,
    options: ExecutionOptions
  ): Promise<AnalysisResult> {
    const { datasetId, onProgress, onSuccess, onError } = options;

    try {
      onProgress?.('准备分析...', 10);

      // 根据意图类型构建分析参数
      const analysisParams = this.buildAnalysisParams(intent, datasetId);
      
      onProgress?.('创建分析任务...', 20);

      // 创建分析任务
      const createRes = await analysisApi.create(analysisParams);
      console.log('创建分析任务响应:', createRes);
      
      // 解析分析ID（拦截器已解包）
      const analysisId = createRes?.code === 200 ? createRes.data?.id : createRes?.id;
      
      if (!analysisId) {
        console.error('无效响应:', createRes);
        throw new Error('创建分析任务失败：服务器未返回有效的分析ID');
      }

      onProgress?.('开始分析...', 30);

      // 轮询任务状态
      const result = await this.pollTaskStatus(analysisId, {
        ...options,
        pollInterval: options.pollInterval || 2000,
      });

      if (result.status === 'completed') {
        onSuccess?.(result);
      } else {
        onError?.(result.errorMsg || '分析失败');
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '执行分析时出错';
      onError?.(errorMsg);
      throw error;
    }
  }

  /**
   * 直接执行特定类型的分析
   * @param type 分析类型
   * @param datasetId 数据集ID
   * @param params 分析参数
   * @param options 执行选项
   */
  async execute(
    type: AnalysisType,
    datasetId: string,
    params: AnalysisParams,
    options: Pick<ExecutionOptions, 'onProgress' | 'onSuccess' | 'onError' | 'pollInterval'>
  ): Promise<AnalysisResult> {
    const intent: IntentResult = {
      type,
      confidence: 1,
      description: `执行 ${type} 分析`,
      params,
      reasoning: '直接执行指定分析类型'
    };

    return this.executeByIntent(intent, { datasetId, ...options });
  }

  /**
   * 构建分析参数
   */
  private buildAnalysisParams(intent: IntentResult, datasetId: string): {
    dataset_id: string;
    analysis_type: string;
    params: Record<string, any>;
  } {
    const { type, params } = intent;

    // 基础参数
    const baseParams: Record<string, any> = {
      ...params,
    };

    // 根据分析类型调整参数
    switch (type) {
      case 'descriptive':
        return {
          dataset_id: datasetId,
          analysis_type: 'descriptive',
          params: {}
        };

      case 'correlation':
        return {
          dataset_id: datasetId,
          analysis_type: 'correlation',
          params: {
            columns: params.columns
          }
        };

      case 'distribution':
        return {
          dataset_id: datasetId,
          analysis_type: 'distribution',
          params: {
            column: params.column
          }
        };

      case 'outlier':
        return {
          dataset_id: datasetId,
          analysis_type: 'outlier',
          params: {
            column: params.column
          }
        };

      case 'visualization':
        return {
          dataset_id: datasetId,
          analysis_type: 'visualization',
          params: {
            chart_type: params.chart_type || 'auto',
            column: params.column,
            x_column: params.x_column,
            y_column: params.y_column
          }
        };

      case 'forecast':
        return {
          dataset_id: datasetId,
          analysis_type: 'forecast',
          params: {
            value_column: params.value_column,
            date_column: params.date_column,
            periods: params.periods || 30,
            model: params.model || 'prophet'
          }
        };

      case 'comprehensive':
        return {
          dataset_id: datasetId,
          analysis_type: 'comprehensive',
          params: {}
        };

      case 'smart_process':
        return {
          dataset_id: datasetId,
          analysis_type: 'smart_process',
          params: {
            missingValueStrategy: params.missing_strategy || 'mean',
            duplicateStrategy: params.duplicate_strategy || 'drop',
            outlierStrategy: params.outlier_strategy || 'none',
            standardization: params.standardization || 'none'
          }
        };

      case 'path':
        return {
          dataset_id: datasetId,
          analysis_type: 'path',
          params: {
            path_type: params.path_type || 'funnel',
            user_id_col: params.user_id_col,
            event_col: params.event_col,
            timestamp_col: params.timestamp_col,
            funnel_steps: params.funnel_steps,
            time_window: params.time_window
          }
        };

      case 'attribution':
        return {
          dataset_id: datasetId,
          analysis_type: 'attribution',
          params: {
            user_id_col: params.user_id_col,
            touchpoint_col: params.touchpoint_col,
            timestamp_col: params.timestamp_col,
            conversion_col: params.conversion_col,
            models: params.models || ['first_touch', 'last_touch', 'linear']
          }
        };

      case 'sequence_mining':
        return {
          dataset_id: datasetId,
          analysis_type: 'sequence_mining',
          params: {
            user_id_col: params.user_id_col,
            event_col: params.event_col,
            timestamp_col: params.timestamp_col,
            min_support: params.min_support || 0.1,
            max_pattern_length: params.max_pattern_length || 5
          }
        };

      case 'clustering':
        // 聚类分析使用单独的 API
        return {
          dataset_id: datasetId,
          analysis_type: 'clustering',
          params: {
            columns: params.columns,
            n_clusters: params.n_clusters || 3
          }
        };

      default:
        throw new Error(`不支持的分析类型: ${type}`);
    }
  }

  /**
   * 轮询任务状态
   */
  private async pollTaskStatus(
    analysisId: string,
    options: ExecutionOptions
  ): Promise<AnalysisResult> {
    const { onProgress, pollInterval = 3000, maxRetries = 30 } = options;  // 增加轮询间隔，减少最大重试次数
    
    let retries = 0;
    
    return new Promise((resolve, reject) => {
      const abortController = { aborted: false };
      
      // 保存取消函数
      this.activeTasks.set(analysisId, {
        abort: () => {
          abortController.aborted = true;
          reject(new Error('任务已取消'));
        }
      });

      const checkStatus = async () => {
        if (abortController.aborted) return;

        try {
          const res = await analysisApi.getResult(analysisId);
          console.log('轮询结果:', res);
          
          // 解析响应数据（拦截器已解包）
          const analysis = res?.code === 200 ? res.data : res;
          
          if (!analysis) {
            console.error('无法获取分析结果，响应:', res);
            retries++;
            if (retries > maxRetries) {
              this.activeTasks.delete(analysisId);
              reject(new Error('获取分析结果失败'));
              return;
            }
            setTimeout(checkStatus, pollInterval);
            return;
          }
          
          const status = analysis.status;
          console.log('分析状态:', status);

          // 计算进度
          let progress = 30;
          if (status === 'running') progress = 50 + Math.min(retries * 2, 40);
          if (status === 'completed') progress = 100;
          if (status === 'failed') progress = 0;

          onProgress?.(this.getStatusText(status), progress);

          if (status === 'completed') {
            this.activeTasks.delete(analysisId);
            const result = this.transformResult(analysis);
            resolve(result);
          } else if (status === 'failed') {
            this.activeTasks.delete(analysisId);
            const result: AnalysisResult = {
              analysisId,
              type: analysis.type as AnalysisType,
              status: 'failed',
              data: null,
              errorMsg: analysis.error_msg || '分析失败',
              completedAt: analysis.completed_at ? new Date(analysis.completed_at) : undefined
            };
            resolve(result);
          } else {
            // 继续轮询
            retries++;
            if (retries > maxRetries) {
              this.activeTasks.delete(analysisId);
              reject(new Error('分析超时，请稍后查看结果'));
              return;
            }
            setTimeout(checkStatus, pollInterval);
          }
        } catch (error) {
          retries++;
          if (retries > maxRetries || abortController.aborted) {
            this.activeTasks.delete(analysisId);
            reject(error);
          } else {
            setTimeout(checkStatus, pollInterval);
          }
        }
      };

      checkStatus();
    });
  }

  /**
   * 转换分析结果
   */
  private transformResult(analysis: Analysis): AnalysisResult {
    const resultData = analysis.result_data || {};
    
    return {
      analysisId: analysis.id,
      type: analysis.type as AnalysisType,
      status: 'completed',
      data: resultData,
      summary: this.generateSummary(analysis.type, resultData),
      visualizations: this.extractVisualizations(analysis.type, resultData),
      completedAt: analysis.completed_at ? new Date(analysis.completed_at) : undefined
    };
  }

  /**
   * 生成结果摘要
   */
  private generateSummary(type: string, data: any): string {
    switch (type) {
      case 'descriptive':
        const colStats = data?.column_stats || [];
        return `完成 ${colStats.length} 个字段的描述性统计分析`;

      case 'correlation':
        const corrMatrix = data?.correlation_matrix || [];
        return `分析了 ${corrMatrix.length} 个字段的相关性`;

      case 'forecast':
        const forecastData = data?.forecast || [];
        return `预测了未来 ${forecastData.length} 个周期的趋势`;

      case 'comprehensive':
        return '完成综合分析，包含描述统计、相关性分析和可视化';

      case 'smart_process':
        const removed = data?.removed_rows || 0;
        const fixed = data?.fixed_nulls || 0;
        return `数据处理完成：清理 ${removed} 行，修复 ${fixed} 个缺失值`;

      default:
        return '分析完成';
    }
  }

  /**
   * 提取可视化配置
   */
  private extractVisualizations(type: string, data: any): VisualizationItem[] {
    const visualizations: VisualizationItem[] = [];
    
    console.log('提取可视化, 类型:', type, '数据键:', Object.keys(data || {}));

    // 描述性统计 - 展示关键指标
    if (type === 'descriptive' && data?.column_stats) {
      visualizations.push({
        type: 'table',
        title: '描述性统计结果',
        data: data.column_stats.map((stat: any) => ({
          字段: stat.column,
          类型: stat.dtype,
          非空值: stat.non_null,
          均值: stat.mean?.toFixed(2) || '-',
          标准差: stat.std?.toFixed(2) || '-',
          最小值: stat.min?.toFixed(2) || '-',
          最大值: stat.max?.toFixed(2) || '-',
        }))
      });
    }

    // 相关性分析 - 热力图
    if (type === 'correlation' && data?.correlation_matrix) {
      // 将嵌套字典格式转换为数组格式
      const matrixData = this.convertCorrelationMatrix(data.correlation_matrix);
      visualizations.push({
        type: 'chart',
        title: '相关性热力图',
        config: {
          type: 'heatmap',
          data: matrixData
        }
      });
    }

    // 可视化分析 - 自动生成的图表
    if (type === 'visualization') {
      const charts = data?.charts || data?.result_data?.charts || [];
      console.log('可视化图表数量:', charts.length);
      
      if (charts.length > 0) {
        charts.forEach((chart: any, idx: number) => {
          console.log(`图表 ${idx}:`, chart.type, chart.title);
          
          // 处理图表数据转换
          let config = { ...chart };
          
          // 相关性热力图：转换嵌套字典为数组
          if (chart.type === 'correlation_heatmap' && chart.correlation_matrix) {
            config.data = this.convertCorrelationMatrix(chart.correlation_matrix);
          }
          
          // 柱状图：转换字典为数组
          if (chart.type === 'bar_chart' && chart.data && !Array.isArray(chart.data)) {
            config.data = this.convertDictToArray(chart.data, 'name', 'value');
          }
          
          // 直方图：转换字典为数组
          if (chart.type === 'histogram' && chart.data && !Array.isArray(chart.data)) {
            config.data = this.convertHistogramData(chart.data);
          }
          
          visualizations.push({
            type: 'chart',
            title: chart.title || `图表 ${idx + 1}`,
            config: config
          });
        });
      } else {
        console.warn('没有图表数据');
      }
    }

    // 预测结果
    if (type === 'forecast' && data?.forecast) {
      visualizations.push({
        type: 'chart',
        title: '趋势预测',
        config: {
          type: 'line',
          data: data.forecast,
          actual: data.actual
        }
      });

      // 预测指标
      if (data.metrics) {
        visualizations.push({
          type: 'metric',
          title: '预测指标',
          data: data.metrics
        });
      }
    }

    // 综合分析 - 包含多个可视化
    if (type === 'comprehensive') {
      if (data?.descriptive?.column_stats) {
        visualizations.push({
          type: 'table',
          title: '描述性统计',
          data: data.descriptive.column_stats.slice(0, 5).map((stat: any) => ({
            字段: stat.column,
            均值: stat.mean?.toFixed(2) || '-',
            标准差: stat.std?.toFixed(2) || '-',
          }))
        });
      }

      if (data?.visualizations?.charts) {
        data.visualizations.charts.slice(0, 2).forEach((chart: any, idx: number) => {
          visualizations.push({
            type: 'chart',
            title: chart.title || `可视化 ${idx + 1}`,
            config: chart
          });
        });
      }
    }

    return visualizations;
  }

  /**
   * 转换相关性矩阵为数组格式
   * 后端返回: { col1: { col1: 1, col2: 0.5 }, col2: { col1: 0.5, col2: 1 } }
   * 前端期望: [ { column: 'col1', col1: 1, col2: 0.5 }, { column: 'col2', col1: 0.5, col2: 1 } ]
   */
  private convertCorrelationMatrix(matrix: Record<string, Record<string, number>>): any[] {
    if (!matrix || typeof matrix !== 'object') {
      console.warn('相关性矩阵格式不正确:', matrix);
      return [];
    }

    const columns = Object.keys(matrix);
    
    return columns.map(col => {
      const row: Record<string, any> = { column: col };
      columns.forEach(otherCol => {
        row[otherCol] = matrix[col]?.[otherCol] ?? 0;
      });
      return row;
    });
  }

  /**
   * 将字典转换为数组格式
   * 后端返回: { 'A': 10, 'B': 20 }
   * 前端期望: [ { name: 'A', value: 10 }, { name: 'B', value: 20 } ]
   */
  private convertDictToArray(dict: Record<string, number>, keyName: string, valueName: string): any[] {
    if (!dict || typeof dict !== 'object') {
      return [];
    }
    
    return Object.entries(dict).map(([key, value]) => ({
      [keyName]: key,
      [valueName]: value
    }));
  }

  /**
   * 转换直方图数据
   * 后端返回格式可能为: { 'bin_edges': [...], 'counts': [...] } 或 { '10-20': 5, '20-30': 10 }
   */
  private convertHistogramData(data: any): any[] {
    if (!data) return [];
    
    // 如果是数组，直接返回
    if (Array.isArray(data)) return data;
    
    // 如果有 bin_edges 和 counts，组合成数组
    if (data.bin_edges && data.counts) {
      return data.counts.map((count: number, i: number) => ({
        bin: `${data.bin_edges[i].toFixed(1)}-${data.bin_edges[i+1].toFixed(1)}`,
        count: count
      }));
    }
    
    // 否则按字典处理
    return this.convertDictToArray(data, 'bin', 'count');
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '等待执行...',
      'running': '分析进行中...',
      'completed': '分析完成',
      'failed': '分析失败'
    };
    return statusMap[status] || status;
  }

  /**
   * 取消正在执行的任务
   */
  cancelTask(analysisId: string): boolean {
    const task = this.activeTasks.get(analysisId);
    if (task) {
      task.abort();
      this.activeTasks.delete(analysisId);
      return true;
    }
    return false;
  }

  /**
   * 取消所有任务
   */
  cancelAll(): void {
    this.activeTasks.forEach((task) => task.abort());
    this.activeTasks.clear();
  }
}

// 导出单例
export const analysisExecutionService = new AnalysisExecutionService();
