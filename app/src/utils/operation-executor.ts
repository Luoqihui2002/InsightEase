/**
 * 操作执行器 - 纯 JavaScript 实现
 * 
 * 从 DataWorkshop 提取的执行逻辑，支持：
 * - JOIN 合并
 * - 条件筛选
 * - 数据透视
 * - 宽长转换
 * - 列处理
 * - 数据去重
 * - 随机抽样
 * - 衍生计算
 * - 格式化输出
 */

import type { DataTable } from '@/types/data-table';
import type { Operation, OperationType } from '@/types/operation';

// ===== 配置类型定义 =====

interface JoinConfig {
  leftTable: string;
  rightTable: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  leftKey: string;
  rightKey: string;
}

interface FilterConfig {
  conditions: Array<{
    column: string;
    operator: string;
    value: any;
  }>;
  logic: 'and' | 'or';
}

interface TransformConfig {
  actions: TransformAction[];
}

type TransformAction =
  | { type: 'rename'; mappings: Array<{ oldName: string; newName: string }> }
  | { type: 'split'; column: string; separator: string; newColumns: string[] }
  | { type: 'merge'; columns: string[]; separator: string; newColumn: string }
  | { type: 'format'; column: string; formatType: string; formatPattern: string }
  | { type: 'remove'; columns: string[] };

interface PivotConfig {
  rows: string[];
  columns: string[];
  values: Array<{
    column: string;
    aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min' | 'first' | 'last';
  }>;
  filters?: Array<{
    column: string;
    operator: string;
    value: any;
  }>;
}

interface ReshapeConfig {
  direction: 'melt' | 'pivot';
  idVars?: string[];
  valueVars?: string[];
  varName?: string;
  valueName?: string;
  index?: string;
  columns?: string;
  values?: string;
}

interface DedupConfig {
  columns: string[];
  keep: 'first' | 'last';
  caseSensitive: boolean;
}

interface SampleConfig {
  method: 'count' | 'percentage';
  count?: number;
  percentage?: number;
  seed?: number;
}

interface DeriveConfig {
  newColumn: string;
  formula: string;
}

// ===== 主执行函数 =====

export function executeOperation(table: DataTable, operation: Operation): DataTable {
  switch (operation.type) {
    case 'join':
      throw new Error('JOIN 操作需要多表支持，请在 DataWorkshop 中执行');
    case 'filter':
      return executeFilter(table, operation.config as FilterConfig);
    case 'transform':
      return executeTransform(table, operation.config as TransformConfig);
    case 'dedup':
      return executeDedup(table, operation.config as DedupConfig);
    case 'reshape':
      return executeReshape(table, operation.config as ReshapeConfig);
    case 'pivot':
      return executePivot(table, operation.config as PivotConfig);
    case 'derive':
      return executeDerive(table, operation.config as DeriveConfig);
    case 'sample':
      return executeSample(table, operation.config as SampleConfig);
    case 'output':
      return table; // 输出操作不修改数据
    default:
      throw new Error(`未知操作类型: ${operation.type}`);
  }
}

// ===== 各操作执行实现 =====

function executeFilter(table: DataTable, config: FilterConfig): DataTable {
  const { conditions, logic } = config;

  const filteredData = table.data.filter(row => {
    const results = conditions.map(cond => {
      const value = row[cond.column];
      const compareValue = cond.value;

      switch (cond.operator) {
        case 'eq': return String(value) === String(compareValue);
        case 'ne': return String(value) !== String(compareValue);
        case 'gt': return Number(value) > Number(compareValue);
        case 'gte': return Number(value) >= Number(compareValue);
        case 'lt': return Number(value) < Number(compareValue);
        case 'lte': return Number(value) <= Number(compareValue);
        case 'contains': return String(value).includes(String(compareValue));
        case 'startsWith': return String(value).startsWith(String(compareValue));
        case 'endsWith': return String(value).endsWith(String(compareValue));
        case 'isNull': return value == null || value === '';
        case 'isNotNull': return value != null && value !== '';
        default: return true;
      }
    });

    return logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  });

  return {
    ...table,
    data: filteredData,
    rowCount: filteredData.length,
  };
}

function executeTransform(table: DataTable, config: TransformConfig): DataTable {
  let newData = [...table.data];
  let newColumns = [...table.columns];

  for (const action of config.actions) {
    switch (action.type) {
      case 'rename': {
        for (const mapping of action.mappings) {
          if (!mapping.oldName || !mapping.newName) continue;
          
          newData = newData.map(row => {
            const newRow = { ...row };
            newRow[mapping.newName] = newRow[mapping.oldName];
            delete newRow[mapping.oldName];
            return newRow;
          });

          const colIndex = newColumns.indexOf(mapping.oldName);
          if (colIndex !== -1) {
            newColumns[colIndex] = mapping.newName;
          }
        }
        break;
      }

      case 'split': {
        const { column, separator, newColumns: splitCols } = action;
        newData = newData.map(row => {
          const value = String(row[column] ?? '');
          const parts = value.split(separator);
          const newRow = { ...row };
          splitCols.forEach((col, idx) => {
            newRow[col] = parts[idx] ?? '';
          });
          return newRow;
        });

        const insertIndex = newColumns.indexOf(column) + 1;
        newColumns.splice(insertIndex, 0, ...splitCols);
        break;
      }

      case 'merge': {
        const { columns, separator, newColumn } = action;
        newData = newData.map(row => ({
          ...row,
          [newColumn]: columns.map(col => row[col]).join(separator),
        }));

        const lastColIndex = Math.max(...columns.map(c => newColumns.indexOf(c)));
        newColumns.splice(lastColIndex + 1, 0, newColumn);
        break;
      }

      case 'format': {
        const { column, formatType, formatPattern } = action;
        newData = newData.map(row => {
          const value = row[column];
          let formattedValue = value;

          if (formatType === 'date' && value) {
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                const sep = formatPattern.includes('/') ? '/' : '-';
                formattedValue = date.toISOString().split('T')[0].replace(/-/g, sep);
              }
            } catch {}
          } else if (formatType === 'number' && !isNaN(Number(value))) {
            const num = Number(value);
            switch (formatPattern) {
              case '0': formattedValue = Math.round(num); break;
              case '0.00': formattedValue = num.toFixed(2); break;
              case '0.0000': formattedValue = num.toFixed(4); break;
              case '0%': formattedValue = Math.round(num * 100) + '%'; break;
              case '0.00%': formattedValue = (num * 100).toFixed(2) + '%'; break;
              case '0,000': formattedValue = Math.round(num).toLocaleString(); break;
              case '0,000.00': formattedValue = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); break;
            }
          } else if (formatType === 'text' && typeof value === 'string') {
            switch (formatPattern) {
              case 'upper': formattedValue = value.toUpperCase(); break;
              case 'lower': formattedValue = value.toLowerCase(); break;
              case 'trim': formattedValue = value.trim(); break;
              case 'capitalize': formattedValue = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); break;
            }
          }

          return { ...row, [column]: formattedValue };
        });
        break;
      }

      case 'remove': {
        const colsToRemove = new Set(action.columns);
        newColumns = newColumns.filter(col => !colsToRemove.has(col));
        newData = newData.map(row => {
          const newRow: Record<string, any> = {};
          for (const col of newColumns) {
            newRow[col] = row[col];
          }
          return newRow;
        });
        break;
      }
    }
  }

  return {
    ...table,
    columns: newColumns,
    data: newData,
    rowCount: newData.length,
    colCount: newColumns.length,
  };
}

function executeDedup(table: DataTable, config: DedupConfig): DataTable {
  const { columns, keep, caseSensitive } = config;

  const getRowKey = (row: Record<string, any>): string => {
    if (columns.length === 0) {
      return JSON.stringify(row);
    }
    const values = columns.map(col => {
      const val = row[col];
      if (typeof val === 'string' && !caseSensitive) {
        return val.toLowerCase();
      }
      return val;
    });
    return JSON.stringify(values);
  };

  const seen = new Map<string, Record<string, any>>();
  const order: string[] = [];

  for (const row of table.data) {
    const key = getRowKey(row);
    if (!seen.has(key)) {
      seen.set(key, row);
      order.push(key);
    } else if (keep === 'last') {
      seen.set(key, row);
    }
  }

  const dedupedData = order.map(key => seen.get(key)!);

  return {
    ...table,
    data: dedupedData,
    rowCount: dedupedData.length,
    _dedupInfo: {
      removedCount: table.rowCount - dedupedData.length,
      originalCount: table.rowCount,
    },
  } as DataTable;
}

function executeReshape(table: DataTable, config: ReshapeConfig): DataTable {
  const { direction } = config;

  if (direction === 'melt') {
    const { idVars = [], valueVars = [], varName = 'variable', valueName = 'value' } = config;
    const meltColumns = valueVars.length > 0 ? valueVars : table.columns.filter(col => !idVars.includes(col));

    const newData: Record<string, any>[] = [];

    for (const row of table.data) {
      for (const col of meltColumns) {
        const newRow: Record<string, any> = {};
        for (const idVar of idVars) {
          newRow[idVar] = row[idVar];
        }
        newRow[varName] = col;
        newRow[valueName] = row[col];
        newData.push(newRow);
      }
    }

    const newColumns = [...idVars, varName, valueName];

    return {
      ...table,
      columns: newColumns,
      data: newData,
      rowCount: newData.length,
      colCount: newColumns.length,
    };
  } else {
    const { index, columns, values } = config;
    if (!index || !columns || !values) {
      throw new Error('长表转宽表需要指定 index、columns 和 values');
    }

    const indexValues = [...new Set(table.data.map(row => row[index]))];
    const columnValues = [...new Set(table.data.map(row => row[columns]))];

    const newData: Record<string, any>[] = [];

    for (const idxVal of indexValues) {
      const newRow: Record<string, any> = { [index]: idxVal };
      for (const colVal of columnValues) {
        const matchingRow = table.data.find(
          row => row[index] === idxVal && row[columns] === colVal
        );
        newRow[colVal] = matchingRow ? matchingRow[values] : null;
      }
      newData.push(newRow);
    }

    const newColumns = [index, ...columnValues];

    return {
      ...table,
      columns: newColumns,
      data: newData,
      rowCount: newData.length,
      colCount: newColumns.length,
    };
  }
}

function executePivot(table: DataTable, config: PivotConfig): DataTable {
  const { rows, columns, values, filters } = config;

  // 应用过滤器
  let filteredData = table.data;
  if (filters && filters.length > 0) {
    filteredData = filteredData.filter(row => {
      return filters.every(filter => {
        const rowValue = row[filter.column];
        const filterValue = filter.value;
        switch (filter.operator) {
          case 'eq': return String(rowValue) === String(filterValue);
          case 'ne': return String(rowValue) !== String(filterValue);
          case 'gt': return Number(rowValue) > Number(filterValue);
          case 'gte': return Number(rowValue) >= Number(filterValue);
          case 'lt': return Number(rowValue) < Number(filterValue);
          case 'lte': return Number(rowValue) <= Number(filterValue);
          case 'contains': return String(rowValue).includes(String(filterValue));
          default: return true;
        }
      });
    });
  }

  // 聚合函数
  const aggregate = (group: Record<string, any>[], aggType: string, valueCol: string): number => {
    const vals = group.map(r => r[valueCol]).filter(v => v !== null && v !== undefined && v !== '');
    const nums = vals.map(v => Number(v)).filter(v => !isNaN(v));

    switch (aggType) {
      case 'sum': return nums.reduce((a, b) => a + b, 0);
      case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      case 'count': return vals.length;
      case 'max': return nums.length ? Math.max(...nums) : 0;
      case 'min': return nums.length ? Math.min(...nums) : 0;
      case 'first': return vals[0] ?? 0;
      case 'last': return vals[vals.length - 1] ?? 0;
      default: return 0;
    }
  };

  // 按 rows 分组
  const groups = new Map<string, Record<string, any>[]>();
  for (const row of filteredData) {
    const rowKey = rows.map(r => row[r]).join('_|_');
    if (!groups.has(rowKey)) {
      groups.set(rowKey, []);
    }
    groups.get(rowKey)!.push(row);
  }

  // 获取列维度值
  const uniqueColValues = [...new Set(filteredData.map(row => 
    columns.map(c => row[c]).join('_|_')
  ))];

  // 构建结果
  const newData: Record<string, any>[] = [];
  for (const [rowKey, group] of groups) {
    const newRow: Record<string, any> = {};
    rows.forEach((r, i) => {
      newRow[r] = rowKey.split('_|_')[i];
    });

    for (const colKey of uniqueColValues) {
      const colGroup = group.filter(r => 
        columns.map(c => r[c]).join('_|_') === colKey
      );

      for (const valConfig of values) {
        const aggValue = aggregate(colGroup, valConfig.aggregation, valConfig.column);
        const colName = columns.length > 0
          ? `${colKey}_${valConfig.column}_${valConfig.aggregation}`
          : `${valConfig.column}_${valConfig.aggregation}`;
        newRow[colName] = aggValue;
      }
    }
    newData.push(newRow);
  }

  const newColumns = [...rows, ...uniqueColValues.flatMap(cv =>
    values.map(v => columns.length > 0
      ? `${cv}_${v.column}_${v.aggregation}`
      : `${v.column}_${v.aggregation}`
    )
  )];

  return {
    ...table,
    columns: newColumns,
    data: newData,
    rowCount: newData.length,
    colCount: newColumns.length,
  };
}

function executeDerive(table: DataTable, config: DeriveConfig): DataTable {
  const { newColumn, formula } = config;

  const evaluateFormula = (row: Record<string, any>, expr: string): any => {
    let processedExpr = expr;
    
    // 替换列引用
    table.columns.forEach(col => {
      const value = row[col];
      const safeValue = typeof value === 'string' ? `"${value}"` : value;
      processedExpr = processedExpr.replace(new RegExp(`\\b${col}\\b`, 'g'), String(safeValue ?? 'null'));
    });

    try {
      const func = new Function(
        'UPPER', 'LOWER', 'TRIM', 'LEN', 'SUBSTR', 'REPLACE', 'CONCAT', 'IF', 'AND', 'OR', 'NOT',
        `return ${processedExpr}`
      );

      return func(
        (s: string) => String(s).toUpperCase(),
        (s: string) => String(s).toLowerCase(),
        (s: string) => String(s).trim(),
        (s: string) => String(s).length,
        (s: string, start: number, len?: number) => String(s).substr(start, len),
        (s: string, search: string, replace: string) => String(s).replace(search, replace),
        (...args: any[]) => args.join(''),
        (cond: boolean, t: any, f: any) => cond ? t : f,
        (...args: boolean[]) => args.every(a => a),
        (...args: boolean[]) => args.some(a => a),
        (a: boolean) => !a
      );
    } catch (e) {
      return null;
    }
  };

  const newData = table.data.map(row => ({
    ...row,
    [newColumn]: evaluateFormula(row, formula),
  }));

  const newColumns = [...table.columns];
  if (!newColumns.includes(newColumn)) {
    newColumns.push(newColumn);
  }

  return {
    ...table,
    columns: newColumns,
    data: newData,
    rowCount: newData.length,
    colCount: newColumns.length,
  };
}

function executeSample(table: DataTable, config: SampleConfig): DataTable {
  const { method, count, percentage, seed } = config;

  // 伪随机数生成器
  const seededRandom = (() => {
    let s = seed ?? Date.now();
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();

  // Fisher-Yates 洗牌
  const data = [...table.data];
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }

  // 计算抽样数量
  let sampleCount: number;
  if (method === 'count') {
    sampleCount = Math.min(count ?? 100, table.rowCount);
  } else {
    sampleCount = Math.floor(table.rowCount * (percentage ?? 10) / 100);
  }

  const sampledData = data.slice(0, sampleCount);

  return {
    ...table,
    data: sampledData,
    rowCount: sampledData.length,
    _sampleInfo: {
      originalCount: table.rowCount,
      sampledCount: sampleCount,
      method,
      seed,
    },
  } as DataTable;
}

// ===== 批量执行 =====

export function executeOperations(
  table: DataTable,
  operations: Operation[],
  onProgress?: (current: number, total: number, operationName: string) => void
): DataTable {
  let result = { ...table };

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    
    if (onProgress) {
      onProgress(i + 1, operations.length, op.name);
    }

    result = executeOperation(result, op);
  }

  return result;
}
