/**
 * 引擎选择器 - 根据数据规模和操作复杂度智能选择处理引擎
 * 
 * 双引擎策略：
 * - JS Engine: 简单操作、中小数据量，零加载开销
 * - DuckDB-WASM: 复杂操作、大数据量，12MB 懒加载
 */

import type { Operation, OperationType } from '@/types/operation';
import type { DataTable } from '@/types/data-table';

export type EngineType = 'js' | 'duckdb';
export type OperationComplexity = 'simple' | 'moderate' | 'complex';

export interface EngineDecision {
  engine: EngineType;
  reason: string;
  estimatedTime: string;
  complexity: OperationComplexity;
  rowCount: number;
  densityScore: number;
}

// 阈值配置（可根据设备性能动态调整）
interface ThresholdConfig {
  // 简单操作阈值（filter, dedup, sample, derive）
  simpleMaxRows: number;
  
  // 中等复杂度阈值（transform, reshape）
  moderateMaxRows: number;
  
  // 数据密度阈值（行 × 列 / 1000）
  maxDensityScore: number;
}

// 默认阈值
const DEFAULT_THRESHOLDS: ThresholdConfig = {
  simpleMaxRows: 200000,      // 20万行
  moderateMaxRows: 50000,     // 5万行
  maxDensityScore: 1000,      // 100万单元格
};

class EngineSelector {
  private thresholds: ThresholdConfig;

  constructor(thresholds: Partial<ThresholdConfig> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 评估操作复杂度
   */
  assessComplexity(operation: Operation): OperationComplexity {
    switch (operation.type) {
      // 简单操作：O(n) 或 O(n log n)，内存友好
      case 'filter':
      case 'dedup':
      case 'sample':
      case 'derive':
        return 'simple';
      
      // 中等复杂度：涉及列变换，可能有临时内存开销
      case 'transform':
      case 'reshape':
        return 'moderate';
      
      // 复杂操作：需要 SQL 引擎支持
      case 'pivot':       // 分组聚合 + 行列转换
      case 'join':        // 多表关联
        return 'complex';
      
      case 'output':
        return 'simple';  // 纯格式化，无计算
      
      default:
        return 'moderate';
    }
  }

  /**
   * 计算数据密度分
   * 密度分 = 行数 × 列数 / 1000
   * 用于评估内存压力
   */
  private calculateDensityScore(table: DataTable): number {
    return (table.rowCount * table.columns.length) / 1000;
  }

  /**
   * 动态选择引擎
   */
  choose(table: DataTable, operation: Operation): EngineDecision {
    const rowCount = table.rowCount;
    const densityScore = this.calculateDensityScore(table);
    const complexity = this.assessComplexity(operation);

    // 复杂操作：必须用 DuckDB
    if (complexity === 'complex') {
      return {
        engine: 'duckdb',
        reason: `复杂操作「${this.getOperationLabel(operation.type)}」需要 SQL 引擎支持`,
        estimatedTime: rowCount > 100000 ? '3-5秒' : '1-2秒',
        complexity,
        rowCount,
        densityScore,
      };
    }

    // 简单操作 + 小数据量：用纯 JS
    if (complexity === 'simple' && 
        rowCount <= this.thresholds.simpleMaxRows && 
        densityScore <= this.thresholds.maxDensityScore) {
      return {
        engine: 'js',
        reason: `简单操作，${this.formatNumber(rowCount)}行数据纯 JS 处理即可`,
        estimatedTime: rowCount < 50000 ? '< 1秒' : '1-2秒',
        complexity,
        rowCount,
        densityScore,
      };
    }

    // 中等复杂度 + 中小数据量：用纯 JS
    if (complexity === 'moderate' && 
        rowCount <= this.thresholds.moderateMaxRows && 
        densityScore <= this.thresholds.maxDensityScore) {
      return {
        engine: 'js',
        reason: `中等复杂度，数据量适中`,
        estimatedTime: '1-2秒',
        complexity,
        rowCount,
        densityScore,
      };
    }

    // 默认 fallback 到 DuckDB
    const reasonParts: string[] = [];
    if (rowCount > this.thresholds.simpleMaxRows) {
      reasonParts.push(`数据量大(${this.formatNumber(rowCount)}行)`);
    }
    if (densityScore > this.thresholds.maxDensityScore) {
      reasonParts.push(`数据密度高`);
    }
    if (complexity === 'moderate') {
      reasonParts.push(`操作较复杂`);
    }

    return {
      engine: 'duckdb',
      reason: reasonParts.join(' + ') + '，使用高性能引擎',
      estimatedTime: '2-4秒',
      complexity,
      rowCount,
      densityScore,
    };
  }

  /**
   * 预测多操作链的最佳引擎
   * 如果链中任一操作需要 DuckDB，则整个链用 DuckDB
   */
  chooseForChain(table: DataTable, operations: Operation[]): EngineDecision {
    if (operations.length === 0) {
      return {
        engine: 'js',
        reason: '无操作',
        estimatedTime: '0秒',
        complexity: 'simple',
        rowCount: table.rowCount,
        densityScore: this.calculateDensityScore(table),
      };
    }

    // 检查每个操作
    const decisions = operations.map(op => this.choose(table, op));
    
    // 如果任一操作需要 DuckDB，推荐整个链用 DuckDB
    const needsDuckDB = decisions.some(d => d.engine === 'duckdb');
    
    if (needsDuckDB) {
      const duckDBOps = decisions
        .filter(d => d.engine === 'duckdb')
        .map(d => d.complexity === 'complex' ? '复杂操作' : '大数据量');
      
      return {
        engine: 'duckdb',
        reason: `操作链包含${[...new Set(duckDBOps)].join('、')}，统一使用高性能引擎`,
        estimatedTime: `${operations.length * 1}-${operations.length * 2}秒`,
        complexity: 'complex',
        rowCount: table.rowCount,
        densityScore: this.calculateDensityScore(table),
      };
    }

    // 否则用 JS
    const maxTime = decisions.reduce((max, d) => {
      const time = parseFloat(d.estimatedTime.replace(/[^0-9.-]/g, ''));
      return Math.max(max, time);
    }, 0);

    return {
      engine: 'js',
      reason: `操作链均为简单操作，共${operations.length}步`,
      estimatedTime: `${maxTime}-${maxTime + operations.length * 0.5}秒`,
      complexity: 'simple',
      rowCount: table.rowCount,
      densityScore: this.calculateDensityScore(table),
    };
  }

  /**
   * 获取操作类型中文标签
   */
  private getOperationLabel(type: OperationType): string {
    const labels: Record<OperationType, string> = {
      join: 'JOIN合并',
      filter: '条件筛选',
      pivot: '数据透视',
      reshape: '宽长转换',
      transform: '列处理',
      dedup: '数据去重',
      sample: '随机抽样',
      derive: '衍生计算',
      output: '格式化输出',
    };
    return labels[type] || type;
  }

  /**
   * 格式化数字显示
   */
  private formatNumber(n: number): string {
    if (n >= 10000) {
      return (n / 10000).toFixed(1) + '万';
    }
    return n.toString();
  }

  /**
   * 更新阈值配置（用于根据设备性能调优）
   */
  updateThresholds(thresholds: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 获取当前阈值
   */
  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }
}

// 导出单例
export const engineSelector = new EngineSelector();

// 导出类（用于自定义实例）
export { EngineSelector };

// 导出类型定义
export type { ThresholdConfig };
