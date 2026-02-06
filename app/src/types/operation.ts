/**
 * 操作类型定义
 */

export type OperationType = 
  | 'join'           // JOIN合并
  | 'filter'         // 行筛选
  | 'pivot'          // 数据透视
  | 'reshape'        // 宽长表转换
  | 'transform'      // 列转换
  | 'dedup'          // 去重
  | 'sample'         // 抽样
  | 'derive'         // 衍生计算
  | 'output';        // 格式化输出

export interface BaseOperation {
  id: string;
  type: OperationType;
  name: string;
  config: Record<string, any>;
}

export type Operation = BaseOperation;

export interface OperationChain {
  id: string;
  name: string;
  operations: Operation[];
  createdAt: string;
  updatedAt?: string;
}
