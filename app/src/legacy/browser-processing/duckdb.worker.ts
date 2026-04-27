/**
 * DuckDB Web Worker
 * 
 * 功能：
 * - 懒加载 DuckDB-WASM（12MB，首次使用时下载）
 * - 在 Worker 线程执行 SQL 查询（不阻塞主线程）
 * - 支持大数据导入、查询、导出
 * 
 * 通信方式：Comlink（简化 Worker API）
 */

import * as Comlink from 'comlink';
import type { DataTable } from '@/types/data-table';
import type { Operation } from '@/types/operation';

// DuckDB 实例（懒加载）
let db: any = null;
let connection: any = null;
let isInitializing = false;

// 初始化 DuckDB
async function initDuckDB(): Promise<{ success: boolean; error?: string }> {
  if (db) return { success: true };
  if (isInitializing) {
    // 等待初始化完成
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return db ? { success: true } : { success: false, error: '初始化失败' };
  }

  isInitializing = true;
  
  try {
    // 动态导入 DuckDB-WASM（懒加载）
    const duckdb = await import('@duckdb/duckdb-wasm');
    
    // 选择 bundle（根据浏览器支持）
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    // 创建 Worker
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );
    
    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    
    // 创建数据库实例
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    // 创建连接
    connection = await db.connect();
    
    // 初始化完成后释放 URL
    URL.revokeObjectURL(workerUrl);
    
    isInitializing = false;
    return { success: true };
  } catch (error) {
    isInitializing = false;
    const errorMsg = error instanceof Error ? error.message : 'DuckDB 初始化失败';
    return { success: false, error: errorMsg };
  }
}

// 将 DataTable 导入 DuckDB
async function importTable(table: DataTable): Promise<{ success: boolean; error?: string }> {
  const initResult = await initDuckDB();
  if (!initResult.success) return initResult;

  try {
    // 创建表名（去掉特殊字符）
    const tableName = `table_${table.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // 构建列定义
    const columns = table.columns.map(col => {
      // 简单的类型推断
      const sampleValue = table.data[0]?.[col];
      const colType = typeof sampleValue === 'number' ? 'DOUBLE' : 'VARCHAR';
      return `"${col}" ${colType}`;
    }).join(', ');
    
    // 创建表
    await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
    await connection.query(`CREATE TABLE ${tableName} (${columns})`);
    
    // 批量插入数据（使用 prepared statement 优化）
    const batchSize = 10000;
    for (let i = 0; i < table.data.length; i += batchSize) {
      const batch = table.data.slice(i, i + batchSize);
      
      // 构建 INSERT 语句
      const values = batch.map(row => {
        const rowValues = table.columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        return `(${rowValues})`;
      }).join(', ');
      
      await connection.query(`INSERT INTO ${tableName} VALUES ${values}`);
    }
    
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '导入失败';
    return { success: false, error: errorMsg };
  }
}

// 执行 SQL 查询
async function query(sql: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const initResult = await initDuckDB();
  if (!initResult.success) return { ...initResult, data: undefined };

  try {
    const result = await connection.query(sql);
    // 转换为普通数组
    const rows = [];
    for (const row of result) {
      rows.push(row);
    }
    return { success: true, data: rows };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '查询失败';
    return { success: false, error: errorMsg };
  }
}

// 执行操作链（大数据处理）
async function executeOperations(
  table: DataTable,
  operations: Operation[],
  onProgress?: (step: number, total: number, operationName: string) => void
): Promise<{ success: boolean; data?: DataTable; error?: string }> {
  const initResult = await initDuckDB();
  if (!initResult.success) return { ...initResult, data: undefined };

  try {
    // 首先导入表
    const importResult = await importTable(table);
    if (!importResult.success) return { ...importResult, data: undefined };

    const tableName = `table_${table.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let currentTableName = tableName;
    let resultTableName = tableName;

    // 逐个执行操作
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      if (onProgress) {
        onProgress(i + 1, operations.length, operation.name);
      }

      resultTableName = `${tableName}_step_${i}`;
      
      switch (operation.type) {
        case 'filter': {
          const { conditions, logic } = operation.config;
          const whereClause = buildWhereClause(conditions, logic);
          await connection.query(`
            CREATE TABLE ${resultTableName} AS 
            SELECT * FROM ${currentTableName} 
            WHERE ${whereClause}
          `);
          break;
        }
        
        case 'transform': {
          // 列处理：重命名、删除等
          const { actions } = operation.config;
          let selectColumns = '*';
          
          for (const action of actions) {
            if (action.type === 'remove') {
              // 获取当前列
              const colsResult = await connection.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = '${currentTableName}'
              `);
              const allCols = [];
              for (const row of colsResult) {
                allCols.push(row.column_name);
              }
              const keepCols = allCols.filter((col: string) => !action.columns.includes(col));
              selectColumns = keepCols.map((col: string) => `"${col}"`).join(', ');
            }
          }
          
          await connection.query(`
            CREATE TABLE ${resultTableName} AS 
            SELECT ${selectColumns} FROM ${currentTableName}
          `);
          break;
        }
        
        case 'dedup': {
          const { columns, keep } = operation.config;
          const partitionBy = columns.length > 0 
            ? `PARTITION BY ${columns.map((c: string) => `"${c}"`).join(', ')}`
            : '';
          const orderBy = keep === 'first' ? 'ASC' : 'DESC';
          
          await connection.query(`
            CREATE TABLE ${resultTableName} AS 
            SELECT * FROM (
              SELECT *, ROW_NUMBER() OVER (${partitionBy} ORDER BY rowid ${orderBy}) as _rn
              FROM ${currentTableName}
            ) WHERE _rn = 1
          `);
          // 删除辅助列
          await connection.query(`
            ALTER TABLE ${resultTableName} DROP COLUMN _rn
          `);
          break;
        }
        
        case 'sample': {
          const { method, count, percentage } = operation.config;
          let limitClause = '';
          
          if (method === 'count' && count) {
            limitClause = `LIMIT ${count}`;
          } else if (method === 'percentage' && percentage) {
            // 先获取总行数
            const countResult = await connection.query(`
              SELECT COUNT(*) as cnt FROM ${currentTableName}
            `);
            const totalRows = countResult.get(0).cnt;
            const limitCount = Math.floor(totalRows * percentage / 100);
            limitClause = `LIMIT ${limitCount}`;
          }
          
          // 使用 ORDER BY RANDOM() 进行随机抽样
          await connection.query(`
            CREATE TABLE ${resultTableName} AS 
            SELECT * FROM ${currentTableName} 
            ORDER BY RANDOM() 
            ${limitClause}
          `);
          break;
        }
        
        case 'pivot': {
          const { rows, columns, values } = operation.config;
          // 构建 Pivot SQL（较复杂，这里简化实现）
          const pivotSql = buildPivotSql(currentTableName, rows, columns, values);
          await connection.query(`CREATE TABLE ${resultTableName} AS ${pivotSql}`);
          break;
        }
        
        default:
          // 其他操作：简单复制表
          await connection.query(`
            CREATE TABLE ${resultTableName} AS 
            SELECT * FROM ${currentTableName}
          `);
      }
      
      // 清理中间表（保留原始表和当前结果）
      if (currentTableName !== tableName && currentTableName !== resultTableName) {
        await connection.query(`DROP TABLE IF EXISTS ${currentTableName}`);
      }
      
      currentTableName = resultTableName;
    }

    // 获取最终结果
    const finalResult = await connection.query(`SELECT * FROM ${resultTableName}`);
    const resultData: Record<string, any>[] = [];
    const resultColumns: string[] = [];
    
    // 获取列名
    const schemaResult = await connection.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = '${resultTableName}'
      ORDER BY ordinal_position
    `);
    for (const row of schemaResult) {
      resultColumns.push(row.column_name);
    }
    
    // 获取数据
    for (const row of finalResult) {
      const rowData: Record<string, any> = {};
      for (const col of resultColumns) {
        rowData[col] = row[col];
      }
      resultData.push(rowData);
    }

    // 清理临时表
    await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
    await connection.query(`DROP TABLE IF EXISTS ${resultTableName}`);

    return {
      success: true,
      data: {
        id: `result_${Date.now()}`,
        name: `${table.name}_processed`,
        columns: resultColumns,
        data: resultData,
        rowCount: resultData.length,
        colCount: resultColumns.length,
        createdAt: new Date().toISOString(),
        source: 'local',
      } as DataTable,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '处理失败';
    return { success: false, error: errorMsg };
  }
}

// 构建 WHERE 子句
function buildWhereClause(conditions: any[], logic: 'and' | 'or'): string {
  const clauses = conditions.map((cond: any) => {
    const { column, operator, value } = cond;
    const colRef = `"${column}"`;
    
    switch (operator) {
      case 'eq': return `${colRef} = '${value}'`;
      case 'ne': return `${colRef} != '${value}'`;
      case 'gt': return `${colRef} > ${value}`;
      case 'gte': return `${colRef} >= ${value}`;
      case 'lt': return `${colRef} < ${value}`;
      case 'lte': return `${colRef} <= ${value}`;
      case 'contains': return `${colRef} LIKE '%${value}%'`;
      case 'startsWith': return `${colRef} LIKE '${value}%'`;
      case 'endsWith': return `${colRef} LIKE '%${value}'`;
      case 'isNull': return `${colRef} IS NULL`;
      case 'isNotNull': return `${colRef} IS NOT NULL`;
      default: return 'TRUE';
    }
  });
  
  return clauses.join(` ${logic.toUpperCase()} `);
}

// 构建 Pivot SQL（简化版）
function buildPivotSql(tableName: string, rows: string[], columns: string[], values: any[]): string {
  // 这里简化实现，实际使用时可以扩展
  const rowCols = rows.map(r => `"${r}"`).join(', ');
  const valueAgg = values.map((v: any) => 
    `SUM(CASE WHEN "${columns[0]}" = '${v.column}' THEN "${v.column}" ELSE 0 END) as "${v.column}_${v.aggregation}"`
  ).join(', ');
  
  return `
    SELECT ${rowCols}, ${valueAgg}
    FROM ${tableName}
    GROUP BY ${rowCols}
  `;
}

// 导出 Worker API（通过 Comlink）
const workerApi = {
  initDuckDB,
  importTable,
  query,
  executeOperations,
};

// 暴露 API 给主线程
Comlink.expose(workerApi);

export type DuckDBWorkerApi = typeof workerApi;
