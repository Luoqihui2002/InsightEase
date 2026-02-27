/**
 * DuckDB 服务 - 主线程调用封装
 * 
 * 功能：
 * - 封装 Web Worker 通信
 * - 提供类型安全的 API
 * - 懒加载 Worker（首次使用时创建）
 * - 错误处理和超时控制
 */

import * as Comlink from 'comlink';
import type { DuckDBWorkerApi } from '@/workers/duckdb.worker';
import type { DataTable } from '@/types/data-table';
import type { Operation } from '@/types/operation';

// Worker 实例
let worker: Worker | null = null;
let workerApi: Comlink.Remote<DuckDBWorkerApi> | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

// DuckDB 加载状态
export interface DuckDBStatus {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number;
}

// 状态监听器
const statusListeners = new Set<(status: DuckDBStatus) => void>();

let currentStatus: DuckDBStatus = {
  isLoaded: false,
  isLoading: false,
  error: null,
  progress: 0,
};

function updateStatus(status: Partial<DuckDBStatus>) {
  currentStatus = { ...currentStatus, ...status };
  statusListeners.forEach(listener => listener(currentStatus));
}

// 订阅状态变化
export function onDuckDBStatusChange(listener: (status: DuckDBStatus) => void): () => void {
  statusListeners.add(listener);
  // 立即通知当前状态
  listener(currentStatus);
  return () => statusListeners.delete(listener);
}

// 获取当前状态
export function getDuckDBStatus(): DuckDBStatus {
  return { ...currentStatus };
}

// 初始化 Worker
async function initWorker(): Promise<void> {
  if (workerApi) return;
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  updateStatus({ isLoading: true, progress: 0 });

  loadPromise = (async () => {
    try {
      // 动态创建 Worker
      // Vite 方式：使用 new URL 和 import.meta.url
      const WorkerUrl = new URL('@/workers/duckdb.worker.ts', import.meta.url);
      worker = new Worker(WorkerUrl, { type: 'module' });
      
      // 使用 Comlink 包装
      workerApi = Comlink.wrap(worker);
      
      updateStatus({ progress: 30 });
      
      // 初始化 DuckDB
      const result = await workerApi.initDuckDB();
      
      if (result.success) {
        updateStatus({ isLoaded: true, isLoading: false, progress: 100, error: null });
      } else {
        updateStatus({ isLoaded: false, isLoading: false, progress: 0, error: result.error || '初始化失败' });
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Worker 初始化失败';
      updateStatus({ isLoaded: false, isLoading: false, progress: 0, error: errorMsg });
      throw error;
    } finally {
      isLoading = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

// 确保 Worker 已初始化
async function ensureWorker(): Promise<Comlink.Remote<DuckDBWorkerApi>> {
  if (!workerApi) {
    await initWorker();
  }
  if (!workerApi) {
    throw new Error('Worker 初始化失败');
  }
  return workerApi;
}

// 终止 Worker（释放资源）
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerApi = null;
    updateStatus({ isLoaded: false, isLoading: false, error: null, progress: 0 });
  }
}

// ==================== API 封装 ====================

/**
 * 初始化 DuckDB（懒加载）
 */
export async function initDuckDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await initWorker();
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '初始化失败' 
    };
  }
}

/**
 * 导入数据表到 DuckDB
 */
export async function importToDuckDB(table: DataTable): Promise<{ success: boolean; error?: string }> {
  try {
    const api = await ensureWorker();
    return await api.importTable(table);
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '导入失败' 
    };
  }
}

/**
 * 执行 SQL 查询
 */
export async function queryDuckDB(sql: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const api = await ensureWorker();
    return await api.query(sql);
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '查询失败' 
    };
  }
}

/**
 * 使用 DuckDB 执行操作链（大数据处理）
 */
export async function executeWithDuckDB(
  table: DataTable,
  operations: Operation[],
  onProgress?: (step: number, total: number, operationName: string) => void
): Promise<{ success: boolean; data?: DataTable; error?: string }> {
  try {
    const api = await ensureWorker();
    
    // 包装 progress 回调（Comlink 支持函数代理）
    const progressCallback = onProgress 
      ? Comlink.proxy(onProgress)
      : undefined;
    
    return await api.executeOperations(table, operations, progressCallback);
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '处理失败' 
    };
  }
}

// ==================== 批量处理工具 ====================

/**
 * 批量导入多个表
 */
export async function importMultipleTables(
  tables: DataTable[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; imported: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    
    if (onProgress) {
      onProgress(i + 1, tables.length);
    }

    const result = await importToDuckDB(table);
    if (result.success) {
      imported++;
    } else {
      failed++;
      errors.push(`${table.name}: ${result.error}`);
    }
  }

  return { success: failed === 0, imported, failed, errors };
}

/**
 * 检查 DuckDB 是否可用
 */
export function isDuckDBAvailable(): boolean {
  return currentStatus.isLoaded;
}

/**
 * 等待 DuckDB 加载完成
 */
export async function waitForDuckDB(timeout: number = 30000): Promise<boolean> {
  if (currentStatus.isLoaded) return true;
  if (currentStatus.isLoading) {
    // 等待加载完成
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (currentStatus.isLoaded) return true;
      if (currentStatus.error) return false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
  // 未开始加载，尝试初始化
  try {
    await initDuckDB();
    return true;
  } catch {
    return false;
  }
}
