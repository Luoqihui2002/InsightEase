/**
 * 数据表类型定义
 */

export interface DataTable {
  id: string;
  name: string;
  fileName?: string;
  columns: string[];
  data: Record<string, any>[];
  rowCount: number;
  colCount?: number;
  
  // 元数据
  createdAt?: string;
  source?: 'upload' | 'local' | 'api';
  
  // 处理信息（由操作附加）
  _dedupInfo?: {
    removedCount: number;
    originalCount: number;
  };
  _sampleInfo?: {
    originalCount: number;
    sampledCount: number;
    method: string;
    seed?: number;
  };
}

export interface DatasetMetadata {
  id: string;
  name: string;
  size: number;
  rowCount: number;
  colCount: number;
  columns: string[];
  createdAt: string;
  updatedAt?: string;
  source: 'upload' | 'local' | 'api';
  tags?: string[];
}
