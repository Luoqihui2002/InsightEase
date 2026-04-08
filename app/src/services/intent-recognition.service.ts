/**
 * AI 意图识别服务
 * 
 * 功能：
 * - 自然语言 → 分析类型识别
 * - 自动提取分析参数
 * - 智能推荐分析维度
 */

import { aiApi } from '@/api/ai';

// 分析类型定义
export type AnalysisType = 
  | 'descriptive'      // 描述性统计
  | 'correlation'      // 相关性分析
  | 'distribution'     // 分布分析
  | 'outlier'          // 异常值检测
  | 'visualization'    // 可视化分析
  | 'forecast'         // 趋势预测
  | 'comprehensive'    // 综合分析
  | 'smart_process'    // 智能数据处理
  | 'path'             // 路径分析
  | 'attribution'      // 归因分析
  | 'sequence_mining'  // 序列模式挖掘
  | 'clustering'       // 聚类分析
  | 'chat';            // 普通对话

// 意图识别结果
export interface IntentResult {
  type: AnalysisType;
  confidence: number;  // 0-1 置信度
  description: string; // AI 对意图的理解描述
  params: AnalysisParams;
  suggestedDatasets?: string[];  // 推荐的数据集
  suggestedColumns?: string[];   // 推荐的列
  reasoning: string;   // AI 的推理过程
}

// 分析参数
export interface AnalysisParams {
  // 通用参数
  columns?: string[];
  column?: string;
  
  // 预测参数
  value_column?: string;
  date_column?: string;
  periods?: number;
  model?: 'prophet' | 'lightgbm' | 'auto';
  
  // 可视化参数
  chart_type?: 'auto' | 'histogram' | 'scatter' | 'heatmap' | 'boxplot' | 'line' | 'bar' | 'pie';
  x_column?: string;
  y_column?: string;
  
  // 路径分析参数
  path_type?: 'funnel' | 'path' | 'clustering' | 'key_path';
  user_id_col?: string;
  event_col?: string;
  timestamp_col?: string;
  funnel_steps?: string[];
  time_window?: number;
  
  // 归因分析参数
  touchpoint_col?: string;
  conversion_col?: string;
  models?: string[];
  
  // 聚类参数
  n_clusters?: number;
  
  // 智能处理参数
  missing_strategy?: 'none' | 'drop' | 'mean' | 'median' | 'mode' | 'fill';
  duplicate_strategy?: 'none' | 'drop' | 'keep_first' | 'keep_last';
  outlier_strategy?: 'none' | 'drop' | 'clip' | 'mark';
  standardization?: 'none' | 'zscore' | 'minmax' | 'log';
  
  // 其他自定义参数
  [key: string]: any;
}

// 数据集 Schema 信息
export interface DatasetSchema {
  id: string;
  name: string;
  columns: {
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'other';
    dtype: string;
    unique_count: number;
    sample_values: any[];
  }[];
  row_count: number;
}

/**
 * 意图识别服务
 */
class IntentRecognitionService {
  /**
   * 识别用户意图
   * @param message 用户输入
   * @param datasets 可选的数据集列表
   * @param currentDataset 当前选中的数据集
   */
  async recognizeIntent(
    message: string,
    datasets?: DatasetSchema[],
    currentDataset?: DatasetSchema | null
  ): Promise<IntentResult> {
    // 首先使用本地关键词匹配（快速且无需 API）
    const localMatch = this.quickMatch(message);
    
    // 如果置信度很高（>1），直接返回本地匹配结果
    if (localMatch.length > 0 && localMatch[0].score >= 2) {
      const matchedType = localMatch[0].type;
      return {
        type: matchedType,
        confidence: Math.min(localMatch[0].score * 0.3, 0.9),
        description: this.getTypeDescription(matchedType),
        params: this.inferParams(message, matchedType, currentDataset),
        suggestedDatasets: currentDataset ? [currentDataset.id] : datasets?.map(d => d.id),
        suggestedColumns: this.inferColumns(message, currentDataset),
        reasoning: `通过关键词匹配识别为「${this.getTypeDescription(matchedType)}」`
      };
    }

    // 尝试使用 AI 进行意图识别
    const prompt = this.buildPrompt(message, datasets, currentDataset);
    
    return new Promise((resolve, reject) => {
      let resultText = '';
      let hasError = false;
      
      aiApi.chatStream(
        prompt,
        (chunk, fullText) => {
          resultText = fullText;
        },
        {
          onFinish: () => {
            if (hasError) return;
            
            try {
              const result = this.parseResult(resultText);
              resolve(result);
            } catch (error) {
              // 如果解析失败，使用本地匹配结果作为 fallback
              resolve(this.getFallbackResult(localMatch, message, currentDataset, datasets));
            }
          },
          onError: (error) => {
            hasError = true;
            // AI 服务不可用，使用本地匹配作为 fallback
            resolve(this.getFallbackResult(localMatch, message, currentDataset, datasets));
          }
        }
      );
    });
  }

  /**
   * 获取 fallback 结果（当 AI 服务不可用时）
   */
  private getFallbackResult(
    localMatch: Array<{ type: AnalysisType; score: number }>,
    message: string,
    currentDataset?: DatasetSchema | null,
    datasets?: DatasetSchema[]
  ): IntentResult {
    if (localMatch.length > 0) {
      const matchedType = localMatch[0].type;
      return {
        type: matchedType,
        confidence: Math.min(localMatch[0].score * 0.2, 0.7),
        description: this.getTypeDescription(matchedType),
        params: this.inferParams(message, matchedType, currentDataset),
        suggestedDatasets: currentDataset ? [currentDataset.id] : datasets?.map(d => d.id),
        suggestedColumns: this.inferColumns(message, currentDataset),
        reasoning: `AI 服务暂不可用，通过关键词匹配识别为「${this.getTypeDescription(matchedType)}」`
      };
    }

    return {
      type: 'chat',
      confidence: 0.5,
      description: '普通对话',
      params: {},
      reasoning: '无法识别具体意图，作为普通对话处理'
    };
  }

  /**
   * 获取分析类型描述
   */
  private getTypeDescription(type: AnalysisType): string {
    const descriptions: Record<AnalysisType, string> = {
      descriptive: '描述性统计分析',
      correlation: '相关性分析',
      distribution: '分布分析',
      outlier: '异常值检测',
      visualization: '可视化分析',
      forecast: '趋势预测',
      comprehensive: '综合分析',
      smart_process: '智能数据处理',
      path: '路径分析',
      attribution: '归因分析',
      sequence_mining: '序列模式挖掘',
      clustering: '聚类分析',
      chat: '普通对话'
    };
    return descriptions[type] || '未知分析类型';
  }

  /**
   * 根据消息和类型推断参数
   */
  private inferParams(
    message: string,
    type: AnalysisType,
    currentDataset?: DatasetSchema | null
  ): AnalysisParams {
    const params: AnalysisParams = {};
    const lowerMsg = message.toLowerCase();

    // 如果是预测类型，尝试推断周期数
    if (type === 'forecast') {
      const periodMatch = message.match(/(\d+)\s*(天|周|月|年|期)/);
      if (periodMatch) {
        params.periods = parseInt(periodMatch[1]);
      } else {
        params.periods = 30; // 默认30天
      }

      // 尝试识别日期列和数值列
      if (currentDataset?.columns) {
        const dateCol = currentDataset.columns.find(c => c.type === 'datetime');
        const numericCol = currentDataset.columns.find(c => c.type === 'numeric');
        if (dateCol) params.date_column = dateCol.name;
        if (numericCol) params.value_column = numericCol.name;
      }
    }

    // 如果是可视化类型，尝试推断图表类型
    if (type === 'visualization') {
      if (lowerMsg.includes('折线') || lowerMsg.includes('趋势') || lowerMsg.includes('线')) {
        params.chart_type = 'line';
      } else if (lowerMsg.includes('柱状') || lowerMsg.includes('条形') || lowerMsg.includes('柱')) {
        params.chart_type = 'bar';
      } else if (lowerMsg.includes('饼') || lowerMsg.includes('占比') || lowerMsg.includes('比例')) {
        params.chart_type = 'pie';
      } else if (lowerMsg.includes('散点')) {
        params.chart_type = 'scatter';
      } else {
        params.chart_type = 'auto';
      }
    }

    // 路径分析默认参数
    if (type === 'path') {
      params.path_type = 'funnel';
    }

    return params;
  }

  /**
   * 推断涉及的列
   */
  private inferColumns(message: string, currentDataset?: DatasetSchema | null): string[] {
    if (!currentDataset?.columns) return [];
    
    const mentionedColumns: string[] = [];
    const lowerMsg = message.toLowerCase();

    for (const col of currentDataset.columns) {
      if (lowerMsg.includes(col.name.toLowerCase())) {
        mentionedColumns.push(col.name);
      }
    }

    return mentionedColumns;
  }

  /**
   * 构建意图识别 Prompt
   */
  private buildPrompt(
    message: string,
    datasets?: DatasetSchema[],
    currentDataset?: DatasetSchema | null
  ): string {
    const analysisTypes = [
      { type: 'descriptive', desc: '描述性统计分析', examples: ['统计一下', '描述数据', '基本统计'] },
      { type: 'correlation', desc: '相关性分析', examples: ['相关性', '关联', '相关系数'] },
      { type: 'distribution', desc: '分布分析', examples: ['分布', '直方图', '密度'] },
      { type: 'outlier', desc: '异常值检测', examples: ['异常值', '离群点', '异常检测'] },
      { type: 'visualization', desc: '可视化分析', examples: ['可视化', '画图', '图表', '展示'] },
      { type: 'forecast', desc: '趋势预测', examples: ['预测', '趋势', '未来', 'forecast'] },
      { type: 'comprehensive', desc: '综合分析', examples: ['综合分析', '全面分析', '完整报告'] },
      { type: 'smart_process', desc: '智能数据处理', examples: ['清洗', '处理', '清理', '标准化'] },
      { type: 'path', desc: '路径分析', examples: ['路径', '漏斗', '转化', '用户路径'] },
      { type: 'attribution', desc: '归因分析', examples: ['归因', '贡献', '渠道分析'] },
      { type: 'sequence_mining', desc: '序列模式挖掘', examples: ['序列', '模式', '频繁模式'] },
      { type: 'clustering', desc: '聚类分析', examples: ['聚类', '分组', '分群', 'cluster'] },
      { type: 'chat', desc: '普通对话', examples: ['你好', '帮助', '说明'] }
    ];

    let prompt = `你是一个数据分析意图识别助手。请分析用户的输入，识别出数据分析意图。

## 支持的意图类型
${analysisTypes.map(t => `- ${t.type}: ${t.desc} (示例: ${t.examples.join(', ')})`).join('\n')}

## 参数说明
- columns: 涉及的列名数组
- column: 单个列名
- value_column: 预测目标列（数值型）
- date_column: 日期列
- periods: 预测周期数
- chart_type: 图表类型 (auto/histogram/scatter/heatmap/boxplot/line/bar/pie)
- x_column/y_column: X/Y轴列
- path_type: 路径类型 (funnel/path/clustering/key_path)
- user_id_col: 用户ID列
- event_col: 事件列
- timestamp_col: 时间戳列
- funnel_steps: 漏斗步骤数组
- n_clusters: 聚类数量
- missing_strategy: 缺失值处理策略
- duplicate_strategy: 重复值处理策略
- outlier_strategy: 异常值处理策略
- standardization: 标准化方法

`;

    // 添加数据集信息
    if (datasets && datasets.length > 0) {
      prompt += `\n## 可用数据集\n`;
      datasets.forEach((ds, idx) => {
        prompt += `\n[${idx + 1}] ${ds.name} (ID: ${ds.id})\n`;
        prompt += `行数: ${ds.row_count}, 列数: ${ds.columns.length}\n`;
        prompt += `列信息:\n`;
        ds.columns.forEach(col => {
          prompt += `  - ${col.name} (${col.type}, ${col.dtype})\n`;
        });
      });
    }

    // 添加当前数据集
    if (currentDataset) {
      prompt += `\n## 当前选中数据集\n`;
      prompt += `名称: ${currentDataset.name} (ID: ${currentDataset.id})\n`;
      prompt += `行数: ${currentDataset.row_count}, 列数: ${currentDataset.columns.length}\n`;
      prompt += `可用列:\n`;
      currentDataset.columns.forEach(col => {
        prompt += `  - ${col.name} (${col.type}) 示例值: ${col.sample_values.slice(0, 3).join(', ')}\n`;
      });
    }

    prompt += `\n## 用户输入\n"${message}"\n\n`;

    prompt += `请严格按照以下 JSON 格式输出分析结果（不要包含其他内容）：
\`\`\`json
{
  "type": "意图类型",
  "confidence": 0.95,
  "description": "对用户意图的简要描述",
  "params": {
    // 根据意图类型填充相关参数
  },
  "suggestedDatasets": ["推荐的数据集ID"],
  "suggestedColumns": ["推荐的列名"],
  "reasoning": "推理过程说明"
}
\`\`\`

注意：
1. type 必须是支持的意图类型之一
2. confidence 范围 0-1，表示置信度
3. 根据用户输入和数据集信息智能推荐列名
4. 如果无法确定具体参数，params 可以为空对象
5. 如果只是普通对话，type 填 "chat"`;

    return prompt;
  }

  /**
   * 解析 AI 返回的结果
   */
  private parseResult(text: string): IntentResult {
    // 尝试提取 JSON 部分
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                      text.match(/\{[\s\S]*\}/);
    
    let jsonStr = '';
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    } else {
      jsonStr = text;
    }

    // 清理可能的 markdown 标记
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(jsonStr);

    return {
      type: parsed.type || 'chat',
      confidence: parsed.confidence || 0.5,
      description: parsed.description || '',
      params: parsed.params || {},
      suggestedDatasets: parsed.suggestedDatasets,
      suggestedColumns: parsed.suggestedColumns,
      reasoning: parsed.reasoning || ''
    };
  }

  /**
   * 快速关键词匹配（用于本地预判）
   * @returns 可能的意图类型列表（按可能性排序）
   */
  quickMatch(message: string): Array<{ type: AnalysisType; score: number }> {
    const lowerMsg = message.toLowerCase();
    
    const keywords: Record<AnalysisType, string[]> = {
      descriptive: ['统计', '描述', '均值', '平均', '最大', '最小', '标准差', 'summary', 'describe'],
      correlation: ['相关', '关联', '相关系数', 'correlation', 'relation'],
      distribution: ['分布', '直方图', '密度', 'histogram', 'distribution'],
      outlier: ['异常', '离群', '异常值', 'outlier', 'anomaly'],
      visualization: ['可视化', '画图', '图表', 'chart', 'plot', 'graph', 'visual'],
      forecast: ['预测', '趋势', '未来', 'forecast', 'predict', 'trend'],
      comprehensive: ['综合', '全面', '完整', 'comprehensive', 'full'],
      smart_process: ['清洗', '处理', '清理', '标准化', 'clean', 'process', 'normalize'],
      path: ['路径', '漏斗', '转化', 'path', 'funnel', 'conversion', 'journey'],
      attribution: ['归因', '贡献', '渠道', 'attribution', 'contribution'],
      sequence_mining: ['序列', '模式', '频繁', 'sequence', 'pattern', 'mining'],
      clustering: ['聚类', '分组', '分群', 'cluster', 'segment', 'group'],
      chat: []
    };

    const scores: Array<{ type: AnalysisType; score: number }> = [];

    for (const [type, words] of Object.entries(keywords)) {
      let score = 0;
      for (const word of words) {
        if (lowerMsg.includes(word.toLowerCase())) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.push({ type: type as AnalysisType, score });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }
}

// 导出单例
export const intentRecognitionService = new IntentRecognitionService();
