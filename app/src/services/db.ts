/**
 * IndexedDB 封装 - 使用 Dexie.js
 * 
 * 功能：
 * - 本地数据集存储（支持大数据）
 * - 操作链持久化
 * - 可视化配置缓存
 * - API 结果缓存（云端模式）
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { DataTable, DatasetMetadata } from '@/types/data-table';
import type { OperationChain } from '@/types/operation';

// 压缩相关（使用 fflate）
import { compressSync, decompressSync, strToU8, strFromU8 } from 'fflate';

export interface StoredDataset {
  id: string;
  metadata: DatasetMetadata;
  // 数据以压缩形式存储
  dataCompressed: Uint8Array;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface StoredOperationChain {
  id: string;
  name: string;
  operations: OperationChain['operations'];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredVisualization {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  datasetId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface APICacheEntry {
  id: string;
  key: string;           // 缓存键：URL + 参数哈希
  url: string;
  params: string;        // JSON 序列化的参数
  response: any;
  compressed: boolean;
  createdAt: Date;
  expiresAt: Date;       // TTL 过期时间
  accessCount: number;
}

class InsightEaseDatabase extends Dexie {
  // 声明表
  datasets!: Table<StoredDataset, string>;
  operationChains!: Table<StoredOperationChain, string>;
  visualizations!: Table<StoredVisualization, string>;
  apiCache!: Table<APICacheEntry, string>;

  constructor() {
    super('InsightEaseDB');

    // 定义表结构和索引
    this.version(1).stores({
      // 数据集：按名称、创建时间、标签索引
      datasets: 'id, name, [source+createdAt], *tags, lastAccessedAt',
      
      // 操作链：按名称、创建时间索引
      operationChains: 'id, name, createdAt, updatedAt',
      
      // 可视化：按类型、数据集ID索引
      visualizations: 'id, type, datasetId, createdAt',
      
      // API 缓存：按缓存键和过期时间索引
      apiCache: 'id, key, expiresAt, accessCount',
    });

    // 钩子：自动更新 updatedAt
    this.datasets.hook('updating', (mods, primKey, obj) => {
      return { ...mods, updatedAt: new Date() };
    });
    
    this.operationChains.hook('updating', (mods, primKey, obj) => {
      return { ...mods, updatedAt: new Date() };
    });
    
    this.visualizations.hook('updating', (mods, primKey, obj) => {
      return { ...mods, updatedAt: new Date() };
    });
  }
}

// 创建单例
const db = new InsightEaseDatabase();

/**
 * 数据压缩工具
 */
export const compression = {
  /**
   * 压缩 JSON 数据
   */
  compress(data: any): Uint8Array {
    const jsonStr = JSON.stringify(data);
    const uint8 = strToU8(jsonStr);
    return compressSync(uint8);
  },

  /**
   * 解压 JSON 数据
   */
  decompress(compressed: Uint8Array): any {
    const decompressed = decompressSync(compressed);
    const jsonStr = strFromU8(decompressed);
    return JSON.parse(jsonStr);
  },

  /**
   * 计算压缩率
   */
  calcRatio(original: any, compressed: Uint8Array): string {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    return `${ratio}%`;
  },
};

/**
 * 数据集存储服务
 */
export const datasetStorage = {
  /**
   * 保存数据集（自动压缩）
   */
  async save(table: DataTable, source: DatasetMetadata['source'] = 'local'): Promise<void> {
    const metadata: DatasetMetadata = {
      id: table.id,
      name: table.name,
      size: JSON.stringify(table.data).length,
      rowCount: table.rowCount,
      colCount: table.columns.length,
      columns: table.columns,
      createdAt: new Date().toISOString(),
      source,
    };

    const dataCompressed = compression.compress(table.data);
    const now = new Date();

    await db.datasets.put({
      id: table.id,
      metadata,
      dataCompressed,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    });
  },

  /**
   * 加载数据集（自动解压）
   */
  async load(id: string): Promise<DataTable | null> {
    const stored = await db.datasets.get(id);
    if (!stored) return null;

    // 更新访问统计
    await db.datasets.update(id, {
      accessCount: stored.accessCount + 1,
      lastAccessedAt: new Date(),
    });

    const data = compression.decompress(stored.dataCompressed);

    return {
      id: stored.metadata.id,
      name: stored.metadata.name,
      columns: stored.metadata.columns,
      data,
      rowCount: stored.metadata.rowCount,
      colCount: stored.metadata.colCount,
      createdAt: stored.metadata.createdAt,
      source: stored.metadata.source,
    };
  },

  /**
   * 获取元数据列表（不解压数据）
   */
  async listMetadata(): Promise<DatasetMetadata[]> {
    const all = await db.datasets.toArray();
    return all.map(s => s.metadata);
  },

  /**
   * 删除数据集
   */
  async delete(id: string): Promise<void> {
    await db.datasets.delete(id);
  },

  /**
   * 检查是否存在
   */
  async exists(id: string): Promise<boolean> {
    const count = await db.datasets.where('id').equals(id).count();
    return count > 0;
  },

  /**
   * 获取存储统计
   */
  async getStats(): Promise<{
    count: number;
    totalCompressedSize: number;
    totalOriginalSize: number;
  }> {
    const all = await db.datasets.toArray();
    const count = all.length;
    const totalCompressedSize = all.reduce((sum, s) => sum + s.dataCompressed.length, 0);
    const totalOriginalSize = all.reduce((sum, s) => sum + s.metadata.size, 0);
    
    return { count, totalCompressedSize, totalOriginalSize };
  },

  /**
   * 清理旧数据（LRU 策略）
   */
  async cleanup(maxAgeDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    
    const oldIds = await db.datasets
      .where('lastAccessedAt')
      .below(cutoff)
      .primaryKeys();
    
    await db.datasets.bulkDelete(oldIds);
    return oldIds.length;
  },
};

/**
 * 操作链存储服务
 */
export const operationChainStorage = {
  /**
   * 保存操作链
   */
  async save(chain: OperationChain): Promise<void> {
    const now = new Date();
    await db.operationChains.put({
      id: chain.id,
      name: chain.name,
      operations: chain.operations,
      createdAt: new Date(chain.createdAt),
      updatedAt: chain.updatedAt ? new Date(chain.updatedAt) : now,
    });
  },

  /**
   * 加载操作链
   */
  async load(id: string): Promise<OperationChain | null> {
    const stored = await db.operationChains.get(id);
    if (!stored) return null;

    return {
      id: stored.id,
      name: stored.name,
      operations: stored.operations,
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    };
  },

  /**
   * 列出所有操作链
   */
  async list(): Promise<OperationChain[]> {
    const all = await db.operationChains
      .orderBy('updatedAt')
      .reverse()
      .toArray();
    
    return all.map(s => ({
      id: s.id,
      name: s.name,
      operations: s.operations,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  /**
   * 删除操作链
   */
  async delete(id: string): Promise<void> {
    await db.operationChains.delete(id);
  },
};

/**
 * API 缓存服务（云端模式优化）
 */
export const apiCache = {
  /**
   * 生成缓存键
   */
  generateKey(url: string, params?: Record<string, any>): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${url}:${paramsStr}`;
  },

  /**
   * 获取缓存
   */
  async get(key: string): Promise<any | null> {
    const entry = await db.apiCache.where('key').equals(key).first();
    if (!entry) return null;

    // 检查过期
    if (new Date() > entry.expiresAt) {
      await db.apiCache.delete(entry.id);
      return null;
    }

    // 更新访问统计
    await db.apiCache.update(entry.id, {
      accessCount: entry.accessCount + 1,
    });

    return entry.response;
  },

  /**
   * 设置缓存
   */
  async set(
    key: string, 
    url: string, 
    params: Record<string, any>, 
    response: any, 
    ttlMinutes: number = 5
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await db.apiCache.put({
      id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key,
      url,
      params: JSON.stringify(params),
      response,
      compressed: false,  // API 响应通常较小，不压缩
      createdAt: now,
      expiresAt,
      accessCount: 0,
    });
  },

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    const expiredIds = await db.apiCache
      .where('expiresAt')
      .below(now)
      .primaryKeys();
    
    await db.apiCache.bulkDelete(expiredIds);
    return expiredIds.length;
  },

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    await db.apiCache.clear();
  },
};

/**
 * 存储管理工具
 */
export const storageManager = {
  /**
   * 获取所有存储统计
   */
  async getFullStats(): Promise<{
    datasets: { count: number; compressedSize: number; originalSize: number };
    operationChains: { count: number };
    apiCache: { count: number };
    totalSize: number;
  }> {
    const [datasetStats, chainCount, cacheCount] = await Promise.all([
      datasetStorage.getStats(),
      db.operationChains.count(),
      db.apiCache.count(),
    ]);

    return {
      datasets: {
        count: datasetStats.count,
        compressedSize: datasetStats.totalCompressedSize,
        originalSize: datasetStats.totalOriginalSize,
      },
      operationChains: { count: chainCount },
      apiCache: { count: cacheCount },
      totalSize: datasetStats.totalCompressedSize,
    };
  },

  /**
   * 清空所有数据（危险操作）
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      db.datasets.clear(),
      db.operationChains.clear(),
      db.visualizations.clear(),
      db.apiCache.clear(),
    ]);
  },

  /**
   * 导出所有数据（备份用）
   */
  async exportAll(): Promise<{
    datasets: StoredDataset[];
    operationChains: StoredOperationChain[];
    exportedAt: string;
  }> {
    const [datasets, operationChains] = await Promise.all([
      db.datasets.toArray(),
      db.operationChains.toArray(),
    ]);

    return {
      datasets,
      operationChains,
      exportedAt: new Date().toISOString(),
    };
  },
};

// 导出数据库实例
export { db };
export default db;
