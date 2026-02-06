/**
 * 本地存储服务 - 安全模式核心
 * 
 * 功能：
 * - 数据集本地持久化（IndexedDB + 压缩）
 * - 智能引擎选择（JS / DuckDB-WASM）
 * - 操作链本地存储
 * - 安全徽章状态管理
 */

import { datasetStorage, operationChainStorage, compression } from './db';
import { engineSelector, type EngineDecision } from './engine-selector';
import type { DataTable } from '@/types/data-table';
import type { Operation, OperationChain } from '@/types/operation';

export interface ProcessingResult {
  success: boolean;
  data?: DataTable;
  error?: string;
  engine: 'js' | 'duckdb' | 'none';
  duration: number;
}

export interface LocalStorageStatus {
  isAvailable: boolean;
  usedSpace: number;
  datasetCount: number;
  isSecurityMode: boolean;
}

class LocalStorageService {
  private _isSecurityMode = false;
  private securityModeListeners: Set<(enabled: boolean) => void> = new Set();

  // ===== 安全模式状态管理 =====

  /**
   * 启用/禁用安全模式
   */
  setSecurityMode(enabled: boolean): void {
    this._isSecurityMode = enabled;
    this.securityModeListeners.forEach(listener => listener(enabled));
    
    // 持久化到 localStorage
    localStorage.setItem('insightease_security_mode', JSON.stringify(enabled));
  }

  /**
   * 获取安全模式状态
   */
  getSecurityMode(): boolean {
    return this._isSecurityMode;
  }

  /**
   * 初始化安全模式（从 localStorage 读取）
   */
  initSecurityMode(): boolean {
    const saved = localStorage.getItem('insightease_security_mode');
    if (saved) {
      try {
        this._isSecurityMode = JSON.parse(saved);
      } catch {
        this._isSecurityMode = false;
      }
    }
    return this._isSecurityMode;
  }

  /**
   * 订阅安全模式变化
   */
  onSecurityModeChange(listener: (enabled: boolean) => void): () => void {
    this.securityModeListeners.add(listener);
    return () => this.securityModeListeners.delete(listener);
  }

  // ===== 数据集管理 =====

  /**
   * 导入数据集（上传到本地 IndexedDB）
   */
  async importDataset(
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<DataTable> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const table = await this.parseFile(file.name, content);
          
          // 保存到 IndexedDB
          await datasetStorage.save(table, 'upload');
          
          resolve(table);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 解析文件内容
   */
  private async parseFile(fileName: string, content: string): Promise<DataTable> {
    // CSV 解析
    if (fileName.endsWith('.csv')) {
      return this.parseCSV(fileName, content);
    }
    
    // JSON 解析
    if (fileName.endsWith('.json')) {
      return this.parseJSON(fileName, content);
    }

    throw new Error('不支持的文件格式，仅支持 CSV 和 JSON');
  }

  /**
   * 解析 CSV
   */
  private parseCSV(fileName: string, content: string): DataTable {
    // 简单的 CSV 解析（实际使用 papaparse）
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV 文件为空或格式错误');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, any> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });
      data.push(row);
    }

    return {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fileName.replace(/\.[^/.]+$/, ''),
      fileName,
      columns: headers,
      data,
      rowCount: data.length,
      colCount: headers.length,
      source: 'upload',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 解析 JSON
   */
  private parseJSON(fileName: string, content: string): DataTable {
    const parsed = JSON.parse(content);
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('JSON 必须是对象数组');
    }

    const columns = Object.keys(parsed[0]);

    return {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fileName.replace(/\.[^/.]+$/, ''),
      fileName,
      columns,
      data: parsed,
      rowCount: parsed.length,
      colCount: columns.length,
      source: 'upload',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 获取所有本地数据集元数据
   */
  async listDatasets() {
    return datasetStorage.listMetadata();
  }

  /**
   * 加载数据集
   */
  async loadDataset(id: string): Promise<DataTable | null> {
    return datasetStorage.load(id);
  }

  /**
   * 删除数据集
   */
  async deleteDataset(id: string): Promise<void> {
    return datasetStorage.delete(id);
  }

  /**
   * 检查数据集是否存在
   */
  async hasDataset(id: string): Promise<boolean> {
    return datasetStorage.exists(id);
  }

  // ===== 操作链管理 =====

  /**
   * 保存操作链
   */
  async saveOperationChain(chain: OperationChain): Promise<void> {
    return operationChainStorage.save(chain);
  }

  /**
   * 加载操作链
   */
  async loadOperationChain(id: string): Promise<OperationChain | null> {
    return operationChainStorage.load(id);
  }

  /**
   * 列出所有操作链
   */
  async listOperationChains(): Promise<OperationChain[]> {
    return operationChainStorage.list();
  }

  /**
   * 删除操作链
   */
  async deleteOperationChain(id: string): Promise<void> {
    return operationChainStorage.delete(id);
  }

  // ===== 数据处理引擎 =====

  /**
   * 获取引擎决策（用于 UI 显示）
   */
  getEngineDecision(table: DataTable, operations: Operation[]): EngineDecision {
    return engineSelector.chooseForChain(table, operations);
  }

  /**
   * 执行操作链
   * 
   * 当前实现：纯 JS 引擎（DuckDB 在 Phase 2.2 添加）
   */
  async executeOperations(
    table: DataTable,
    operations: Operation[],
    onProgress?: (step: number, total: number, operationName: string) => void
  ): Promise<ProcessingResult> {
    const startTime = performance.now();
    const decision = this.getEngineDecision(table, operations);

    try {
      let currentData = { ...table };

      // 按顺序执行每个操作
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        if (onProgress) {
          onProgress(i + 1, operations.length, operation.name);
        }

        // 根据引擎选择执行方式
        if (decision.engine === 'js') {
          currentData = await this.executeWithJS(currentData, operation);
        } else {
          // DuckDB 引擎（待实现）
          throw new Error('DuckDB 引擎在 Phase 2.2 中实现');
        }
      }

      const duration = performance.now() - startTime;

      return {
        success: true,
        data: currentData,
        engine: decision.engine,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
        engine: decision.engine,
        duration,
      };
    }
  }

  /**
   * 纯 JS 执行操作（复用 DataWorkshop 现有逻辑）
   */
  private async executeWithJS(
    table: DataTable, 
    operation: Operation
  ): Promise<DataTable> {
    // 导入 DataWorkshop 的执行函数
    const { executeOperation } = await import('@/utils/operation-executor');
    return executeOperation(table, operation);
  }

  // ===== 存储统计 =====

  /**
   * 获取存储状态
   */
  async getStatus(): Promise<LocalStorageStatus> {
    const stats = await datasetStorage.getStats();
    
    return {
      isAvailable: true,
      usedSpace: stats.totalCompressedSize,
      datasetCount: stats.count,
      isSecurityMode: this._isSecurityMode,
    };
  }

  /**
   * 获取友好的存储空间显示
   */
  formatStorageSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  /**
   * 计算压缩率
   */
  async getCompressionRatio(): Promise<string> {
    const stats = await datasetStorage.getStats();
    if (stats.totalOriginalSize === 0) return '0%';
    
    const ratio = (1 - stats.totalCompressedSize / stats.totalOriginalSize) * 100;
    return `${ratio.toFixed(1)}%`;
  }
}

// 导出单例
export const localStorageService = new LocalStorageService();

// 初始化安全模式
localStorageService.initSecurityMode();

export default localStorageService;
