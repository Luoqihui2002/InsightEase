import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Database, 
  Upload, 
  Play, 
  Settings2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  Download,
  Copy,
  Table,
  Filter,
  GitMerge,
  Wand2,
  X,
  GripVertical,
  FileSpreadsheet,
  Code,
  Eye,
  FolderOpen,
  RefreshCw,
  Save,
  Type,
  SeparatorHorizontal,
  Combine,
  Calendar,
  HardDrive,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';

// Phase 2.1: 安全模式导入
import { SecurityBadge, EngineIndicator } from '@/components/SecurityBadge';
import { localStorageService, engineSelector } from '@/services';
import type { EngineDecision } from '@/services';

// 操作类型
type OperationType = 
  | 'join'           // JOIN合并
  | 'filter'         // 行筛选
  | 'pivot'          // 数据透视
  | 'reshape'        // 宽长表转换
  | 'transform'      // 列转换
  | 'dedup'          // 去重
  | 'sample'         // 抽样
  | 'derive'         // 衍生计算
  | 'output';        // 格式化输出

// 操作配置
interface Operation {
  id: string;
  type: OperationType;
  name: string;
  config: Record<string, any>;
}

// 数据表
interface DataTable {
  id: string;
  name: string;
  fileName: string;
  columns: string[];
  data: any[];
  rowCount: number;
}

// JOIN操作配置
interface JoinConfig {
  leftTable: string;
  rightTable: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  leftKey: string;
  rightKey: string;
}

// 筛选操作配置
interface FilterConfig {
  conditions: {
    column: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startswith' | 'endswith';
    value: string;
  }[];
  logic: 'and' | 'or';
}

// 列处理操作配置
type TransformAction = 
  | { type: 'split'; column: string; delimiter: string; newColumns: string[] }
  | { type: 'merge'; columns: string[]; separator: string; newColumn: string }
  | { type: 'format'; column: string; formatType: 'date' | 'number' | 'text'; formatPattern: string }
  | { type: 'rename'; mappings: { oldName: string; newName: string }[] }
  | { type: 'remove'; columns: string[] }
  | { type: 'reorder'; columnOrder: string[] };

interface TransformConfig {
  actions: TransformAction[];
}

// 去重操作配置
interface DedupConfig {
  columns: string[];           // 基于哪些列去重，空数组表示全局去重
  keep: 'first' | 'last';      // 保留第一条还是最后一条
  caseSensitive: boolean;      // 是否区分大小写
}

// 宽长转换配置
interface ReshapeConfig {
  direction: 'melt' | 'pivot';  // melt: 宽→长, pivot: 长→宽
  // melt 参数
  idVars?: string[];            // 保持不变的列
  valueVars?: string[];         // 要转换的列
  varName?: string;             // 新列名（原列名）
  valueName?: string;           // 值列名
  // pivot 参数
  index?: string;               // 作为行索引的列
  columns?: string;             // 要展开为列的列
  values?: string;              // 值列
}

// 数据透视配置
interface PivotConfig {
  rows: string[];               // 行维度
  columns: string[];            // 列维度
  values: {                     // 值字段
    column: string;
    aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min' | 'first' | 'last';
  }[];
  // 可选：过滤条件
  filters?: { column: string; operator: string; value: any }[];
}

// 衍生计算配置
interface DeriveConfig {
  newColumn: string;            // 新列名
  formula: string;              // 公式表达式
  // 支持的运算符: +, -, *, /, %, //, **
  // 支持的函数: UPPER, LOWER, TRIM, LEN, SUBSTR, REPLACE, CONCAT
  //            DATE, YEAR, MONTH, DAY, DATEDIFF
  //            IF, AND, OR, NOT
}

// 随机抽样配置
interface SampleConfig {
  method: 'count' | 'percentage';  // 抽样方式
  count?: number;                  // 指定数量
  percentage?: number;             // 指定百分比 (0-100)
  seed?: number;                   // 随机种子（可选，保证可重复）
}

// 操作类型定义
const OPERATION_TYPES: { type: OperationType; name: string; icon: any; desc: string }[] = [
  { type: 'join', name: 'JOIN合并', icon: GitMerge, desc: '基于共同键合并多个表' },
  { type: 'filter', name: '条件筛选', icon: Filter, desc: '按条件过滤行数据' },
  { type: 'pivot', name: '数据透视', icon: Table, desc: '行列转换和汇总统计' },
  { type: 'reshape', name: '宽长转换', icon: ArrowRight, desc: '宽表和长表互相转换' },
  { type: 'transform', name: '列处理', icon: Wand2, desc: '拆分、合并、格式化列' },
  { type: 'dedup', name: '数据去重', icon: Copy, desc: '基于列去重或全局去重' },
  { type: 'sample', name: '随机抽样', icon: Eye, desc: '抽取指定数量或比例的数据' },
  { type: 'derive', name: '衍生计算', icon: Plus, desc: '基于公式新增计算列' },
  { type: 'output', name: '格式化输出', icon: Code, desc: '输出为SQL、JSON等格式' },
];

export function DataWorkshop() {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 数据表管理
  const [tables, setTables] = useState<DataTable[]>([]);
  const [activeTableId, setActiveTableId] = useState<string>('');
  
  // Phase 2.1: 本地数据集
  const [localDatasets, setLocalDatasets] = useState<Array<{ id: string; name: string; rowCount: number; createdAt: string }>>([]);
  const [showLocalDatasets, setShowLocalDatasets] = useState(false);
  const [storageStats, setStorageStats] = useState<{ usedSpace: string; compressionRatio: string } | null>(null);
  
  // 操作链
  const [operations, setOperations] = useState<Operation[]>([]);
  const [showAddOperation, setShowAddOperation] = useState(false);
  
  // Phase 2.1: 引擎决策显示
  const [engineDecision, setEngineDecision] = useState<EngineDecision | null>(null);
  
  // 预览
  const [previewData, setPreviewData] = useState<DataTable | null>(null);
  
  // Datasets 相关
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [showDatasetSelector, setShowDatasetSelector] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  
  // 保存的操作链
  const [savedChains, setSavedChains] = useState<{id: string; name: string; operations: Operation[]; createdAt: string}[]>([]);
  const [showSaveChainDialog, setShowSaveChainDialog] = useState(false);
  const [showLoadChainDialog, setShowLoadChainDialog] = useState(false);
  const [chainName, setChainName] = useState('');
  
  // 加载已保存的操作链
  useEffect(() => {
    const saved = localStorage.getItem('insightease_workshop_chains');
    if (saved) {
      setSavedChains(JSON.parse(saved));
    }
  }, []);
  
  // Phase 2.1: 加载本地数据集列表
  const loadLocalDatasets = useCallback(async () => {
    try {
      const metadata = await localStorageService.listDatasets();
      setLocalDatasets(metadata.map(m => ({
        id: m.id,
        name: m.name,
        rowCount: m.rowCount,
        createdAt: m.createdAt,
      })));
      
      // 加载存储统计
      const stats = await localStorageService.getStatus();
      const ratio = await localStorageService.getCompressionRatio();
      setStorageStats({
        usedSpace: localStorageService.formatStorageSize(stats.usedSpace),
        compressionRatio: ratio,
      });
    } catch (error) {
      console.error('加载本地数据集失败:', error);
    }
  }, []);
  
  useEffect(() => {
    loadLocalDatasets();
  }, [loadLocalDatasets]);
  
  // Phase 2.1: 更新引擎决策
  useEffect(() => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (activeTable && operations.length > 0) {
      const decision = engineSelector.chooseForChain(activeTable, operations);
      setEngineDecision(decision);
    } else {
      setEngineDecision(null);
    }
  }, [tables, activeTableId, operations]);
  


  // 加载 Datasets 列表
  const loadDatasets = useCallback(async () => {
    try {
      setLoadingDatasets(true);
      const res = await datasetApi.list(1, 100) as any;
      const items = res?.items || res?.data?.items || [];
      setDatasets(items);
    } catch (error) {
      toast.error('加载数据集列表失败');
    } finally {
      setLoadingDatasets(false);
    }
  }, []);
  
  // 从 Dataset 导入数据
  const importFromDataset = useCallback(async (dataset: Dataset) => {
    try {
      setLoadingDatasets(true);
      const previewRes = await datasetApi.preview(dataset.id, 1000) as any;
      const previewData = previewRes?.data || previewRes;
      
      if (!previewData || !previewData.data || previewData.data.length === 0) {
        toast.error('数据集为空或无法读取');
        return;
      }
      
      const newTable: DataTable = {
        id: `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: dataset.filename.replace(/\.[^/.]+$/, ''),
        fileName: dataset.filename,
        columns: previewData.columns || Object.keys(previewData.data[0]),
        data: previewData.data,
        rowCount: previewData.total_rows || previewData.data.length
      };
      
      setTables(prev => [...prev, newTable]);
      if (!activeTableId) {
        setActiveTableId(newTable.id);
      }
      setShowDatasetSelector(false);
      toast.success(`已导入 "${dataset.filename}" (${newTable.rowCount} 行)`);
    } catch (error) {
      toast.error('导入数据集失败');
    } finally {
      setLoadingDatasets(false);
    }
  }, [activeTableId]);
  
  // 文件上传处理
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let parsedData: any[] = [];
          let columns: string[] = [];

          if (file.name.endsWith('.csv')) {
            // CSV解析
            const text = data as string;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
              columns = lines[0].split(',').map(c => c.trim());
              parsedData = lines.slice(1).map(line => {
                const values = line.split(',');
                const row: any = {};
                columns.forEach((col, idx) => {
                  row[col] = values[idx]?.trim() || '';
                });
                return row;
              });
            }
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Excel解析
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            parsedData = XLSX.utils.sheet_to_json(worksheet);
            columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
          } else if (file.name.endsWith('.json')) {
            // JSON解析
            parsedData = JSON.parse(data as string);
            if (Array.isArray(parsedData)) {
              columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
            }
          }

          const newTable: DataTable = {
            id: `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            columns,
            data: parsedData,
            rowCount: parsedData.length
          };

          setTables(prev => [...prev, newTable]);
          if (!activeTableId) {
            setActiveTableId(newTable.id);
          }
          
          // Phase 2.1: 同时保存到 IndexedDB
          localStorageService.importDataset(file).then(() => {
            loadLocalDatasets(); // 刷新列表
            toast.success(`已导入 ${file.name} (${parsedData.length} 行) 并保存到本地`);
          }).catch(() => {
            toast.success(`已导入 ${file.name} (${parsedData.length} 行)`);
          });
        } catch (error) {
          toast.error(`${file.name} 解析失败`);
        }
      };

      if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  }, [activeTableId]);

  // 删除表
  const removeTable = (tableId: string) => {
    setTables(prev => prev.filter(t => t.id !== tableId));
    if (activeTableId === tableId) {
      const remaining = tables.filter(t => t.id !== tableId);
      setActiveTableId(remaining.length > 0 ? remaining[0].id : '');
    }
  };
  
  // Phase 2.1: 从本地 IndexedDB 加载数据集
  const loadFromLocalStorage = useCallback(async (datasetId: string) => {
    try {
      const table = await localStorageService.loadDataset(datasetId);
      if (!table) {
        toast.error('本地数据集不存在');
        return;
      }
      
      // 检查是否已加载
      if (tables.some(t => t.id === table.id)) {
        toast.info('该数据集已加载');
        setActiveTableId(table.id);
        return;
      }
      
      setTables(prev => [...prev, table]);
      setActiveTableId(table.id);
      setShowLocalDatasets(false);
      toast.success(`已加载本地数据集 "${table.name}" (${table.rowCount} 行)`);
    } catch (error) {
      toast.error('加载本地数据集失败');
    }
  }, [tables]);
  
  // Phase 2.1: 删除本地数据集
  const deleteLocalDataset = useCallback(async (datasetId: string) => {
    try {
      await localStorageService.deleteDataset(datasetId);
      loadLocalDatasets();
      toast.success('本地数据集已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  }, [loadLocalDatasets]);

  // 添加操作
  const addOperation = (type: OperationType) => {
    const opDef = OPERATION_TYPES.find(op => op.type === type);
    if (!opDef) return;

    const newOp: Operation = {
      id: `op_${Date.now()}`,
      type,
      name: opDef.name,
      config: getDefaultConfig(type)
    };

    setOperations(prev => [...prev, newOp]);
    setShowAddOperation(false);
    toast.success(`已添加 ${opDef.name}`);
  };

  // 获取默认配置
  const getDefaultConfig = (type: OperationType): Record<string, any> => {
    switch (type) {
      case 'join':
        return { leftTable: '', rightTable: '', joinType: 'inner', leftKey: '', rightKey: '' };
      case 'filter':
        return { conditions: [{ column: '', operator: 'eq', value: '' }], logic: 'and' };
      case 'transform':
        return { actions: [{ type: 'rename', mappings: [{ oldName: '', newName: '' }] }] };
      case 'dedup':
        return { columns: [], keep: 'first', caseSensitive: true };
      case 'reshape':
        return { direction: 'melt', idVars: [], valueVars: [], varName: 'variable', valueName: 'value' };
      case 'pivot':
        return { rows: [], columns: [], values: [{ column: '', aggregation: 'sum' }], filters: [] };
      case 'derive':
        return { newColumn: '', formula: '' };
      case 'sample':
        return { method: 'count', count: 100, percentage: 10 };
      case 'output':
        return { format: 'csv', tableName: 'my_table' };
      default:
        return {};
    }
  };

  // 删除操作
  const removeOperation = (opId: string) => {
    setOperations(prev => prev.filter(op => op.id !== opId));
  };

  // 更新操作配置
  const updateOperationConfig = (opId: string, config: any) => {
    setOperations(prev => prev.map(op => 
      op.id === opId ? { ...op, config: { ...op.config, ...config } } : op
    ));
  };
  
  // 保存操作链
  const saveChain = () => {
    if (operations.length === 0) {
      toast.error('操作链为空，无法保存');
      return;
    }
    if (!chainName.trim()) {
      toast.error('请输入操作链名称');
      return;
    }
    
    const newChain = {
      id: `chain_${Date.now()}`,
      name: chainName.trim(),
      operations: [...operations],
      createdAt: new Date().toISOString()
    };
    
    const updated = [...savedChains, newChain];
    setSavedChains(updated);
    localStorage.setItem('insightease_workshop_chains', JSON.stringify(updated));
    setChainName('');
    setShowSaveChainDialog(false);
    toast.success('操作链已保存');
  };
  
  // 加载操作链
  const loadChain = (chainId: string) => {
    const chain = savedChains.find(c => c.id === chainId);
    if (chain) {
      setOperations(chain.operations);
      setShowLoadChainDialog(false);
      toast.success(`已加载「${chain.name}」`);
    }
  };
  
  // 删除保存的操作链
  const deleteChain = (chainId: string) => {
    const updated = savedChains.filter(c => c.id !== chainId);
    setSavedChains(updated);
    localStorage.setItem('insightease_workshop_chains', JSON.stringify(updated));
    toast.success('操作链已删除');
  };

  // 执行操作链
  const executeOperations = async () => {
    if (operations.length === 0) {
      toast.error('请先添加操作');
      return;
    }

    setIsProcessing(true);
    let currentData = activeTableId ? tables.find(t => t.id === activeTableId) : null;
    
    if (!currentData && tables.length > 0) {
      currentData = tables[0];
    }

    if (!currentData) {
      toast.error('请先上传数据文件');
      setIsProcessing(false);
      return;
    }

    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      let result = { ...currentData };

      for (const operation of operations) {
        switch (operation.type) {
          case 'join':
            result = executeJoin(result, operation.config as JoinConfig, tables);
            break;
          case 'filter':
            result = executeFilter(result, operation.config as FilterConfig);
            break;
          case 'transform':
            result = executeTransform(result, operation.config as TransformConfig);
            break;
          case 'dedup':
            result = executeDedup(result, operation.config as DedupConfig);
            break;
          case 'reshape':
            result = executeReshape(result, operation.config as ReshapeConfig);
            break;
          case 'pivot':
            result = executePivot(result, operation.config as PivotConfig);
            break;
          case 'derive':
            result = executeDerive(result, operation.config as DeriveConfig);
            break;
          case 'sample':
            result = executeSample(result, operation.config as SampleConfig);
            break;
          case 'output':
            // 输出操作不修改数据，只影响最终导出
            break;
          default:
            break;
        }
      }

      setPreviewData(result);
      toast.success('处理完成');
    } catch (error) {
      toast.error('处理失败: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 执行JOIN
  const executeJoin = (leftTable: DataTable, config: JoinConfig, allTables: DataTable[]): DataTable => {
    const rightTable = allTables.find(t => t.id === config.rightTable);
    if (!rightTable) throw new Error('右表不存在');

    // 简化的JOIN实现
    const joinedData: any[] = [];
    const rightMap = new Map(rightTable.data.map(row => [row[config.rightKey], row]));

    for (const leftRow of leftTable.data) {
      const key = leftRow[config.leftKey];
      const rightRow = rightMap.get(key);

      if (rightRow && config.joinType !== 'left') {
        joinedData.push({ ...leftRow, ...rightRow });
      } else if (config.joinType === 'left' || config.joinType === 'full') {
        joinedData.push({ ...leftRow });
      }
    }

    // 处理右表未匹配的行（FULL JOIN）
    if (config.joinType === 'full' || config.joinType === 'right') {
      const leftKeys = new Set(leftTable.data.map(r => r[config.leftKey]));
      for (const rightRow of rightTable.data) {
        if (!leftKeys.has(rightRow[config.rightKey])) {
          joinedData.push({ ...rightRow });
        }
      }
    }

    return {
      id: `result_${Date.now()}`,
      name: `${leftTable.name}_${config.joinType}join_${rightTable.name}`,
      fileName: 'result.csv',
      columns: [...new Set([...leftTable.columns, ...rightTable.columns])],
      data: joinedData,
      rowCount: joinedData.length
    };
  };

  // 执行筛选
  const executeFilter = (table: DataTable, config: FilterConfig): DataTable => {
    const filteredData = table.data.filter(row => {
      const results = config.conditions.map(cond => {
        const value = row[cond.column];
        switch (cond.operator) {
          case 'eq': return String(value) === cond.value;
          case 'ne': return String(value) !== cond.value;
          case 'gt': return Number(value) > Number(cond.value);
          case 'gte': return Number(value) >= Number(cond.value);
          case 'lt': return Number(value) < Number(cond.value);
          case 'lte': return Number(value) <= Number(cond.value);
          case 'contains': return String(value).includes(cond.value);
          case 'startswith': return String(value).startsWith(cond.value);
          case 'endswith': return String(value).endsWith(cond.value);
          default: return true;
        }
      });
      return config.logic === 'and' ? results.every(r => r) : results.some(r => r);
    });

    return {
      ...table,
      data: filteredData,
      rowCount: filteredData.length
    };
  };

  // 执行列处理
  const executeTransform = (table: DataTable, config: TransformConfig): DataTable => {
    let result = { ...table };
    let newColumns = [...table.columns];
    let newData = [...table.data];

    for (const action of config.actions) {
      switch (action.type) {
        case 'rename': {
          // 重命名列
          const renameMap = new Map(action.mappings.map(m => [m.oldName, m.newName]));
          newColumns = newColumns.map(col => renameMap.get(col) || col);
          newData = newData.map(row => {
            const newRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              const newKey = renameMap.get(key) || key;
              newRow[newKey] = value;
            }
            return newRow;
          });
          break;
        }
        case 'split': {
          // 拆分列
          const { column, delimiter, newColumns: splitCols } = action;
          if (splitCols.length > 0) {
            newData = newData.map(row => {
              const value = String(row[column] || '');
              const parts = value.split(delimiter);
              const newRow = { ...row };
              splitCols.forEach((col, idx) => {
                newRow[col] = parts[idx] || '';
              });
              return newRow;
            });
            // 添加新列到列列表
            const colIndex = newColumns.indexOf(column);
            if (colIndex !== -1) {
              newColumns.splice(colIndex + 1, 0, ...splitCols);
            } else {
              newColumns.push(...splitCols);
            }
          }
          break;
        }
        case 'merge': {
          // 合并列
          const { columns, separator, newColumn } = action;
          newData = newData.map(row => ({
            ...row,
            [newColumn]: columns.map(col => row[col]).join(separator)
          }));
          // 添加新列
          if (!newColumns.includes(newColumn)) {
            const lastColIndex = Math.max(...columns.map(c => newColumns.indexOf(c)));
            newColumns.splice(lastColIndex + 1, 0, newColumn);
          }
          break;
        }
        case 'format': {
          // 格式化列
          const { column, formatType, formatPattern } = action;
          newData = newData.map(row => {
            const value = row[column];
            let formattedValue = value;
            
            if (formatType === 'date' && value) {
              try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  formattedValue = date.toISOString().split('T')[0].replace(/-/g, formatPattern.includes('/') ? '/' : '-');
                }
              } catch {}
            } else if (formatType === 'number' && !isNaN(Number(value))) {
              const num = Number(value);
              if (formatPattern === '0') {
                formattedValue = Math.round(num);
              } else if (formatPattern === '0.00') {
                formattedValue = num.toFixed(2);
              } else if (formatPattern === '0.0000') {
                formattedValue = num.toFixed(4);
              } else if (formatPattern === '0%') {
                formattedValue = Math.round(num * 100) + '%';
              } else if (formatPattern === '0.00%') {
                formattedValue = (num * 100).toFixed(2) + '%';
              } else if (formatPattern === '0,000') {
                formattedValue = Math.round(num).toLocaleString();
              } else if (formatPattern === '0,000.00') {
                formattedValue = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          // 删除列
          const colsToRemove = new Set(action.columns);
          newColumns = newColumns.filter(col => !colsToRemove.has(col));
          newData = newData.map(row => {
            const newRow: any = {};
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
      ...result,
      columns: newColumns,
      data: newData,
      colCount: newColumns.length
    };
  };

  // 执行去重
  const executeDedup = (table: DataTable, config: DedupConfig): DataTable => {
    const { columns, keep, caseSensitive } = config;
    
    // 生成行的唯一键
    const getRowKey = (row: any): string => {
      if (columns.length === 0) {
        // 全局去重：使用所有列
        return JSON.stringify(row);
      }
      // 基于指定列
      const values = columns.map(col => {
        const val = row[col];
        if (typeof val === 'string' && !caseSensitive) {
          return val.toLowerCase();
        }
        return val;
      });
      return JSON.stringify(values);
    };

    const seen = new Map<string, number>(); // key -> index
    const dedupedData: any[] = [];

    for (let i = 0; i < table.data.length; i++) {
      const row = table.data[i];
      const key = getRowKey(row);
      
      if (!seen.has(key)) {
        // 第一次遇到这个键
        seen.set(key, dedupedData.length);
        dedupedData.push(row);
      } else if (keep === 'last') {
        // 保留最后一条：替换之前的
        const existingIndex = seen.get(key)!;
        dedupedData[existingIndex] = row;
      }
      // 如果 keep === 'first'，则忽略重复项
    }

    const removedCount = table.data.length - dedupedData.length;
    
    return {
      ...table,
      data: dedupedData,
      rowCount: dedupedData.length,
      // 可以添加一个属性记录去重信息
      _dedupInfo: { removedCount, originalCount: table.data.length }
    } as DataTable;
  };

  // 执行宽长转换
  const executeReshape = (table: DataTable, config: ReshapeConfig): DataTable => {
    const { direction } = config;
    
    if (direction === 'melt') {
      // 宽表 → 长表 (类似 pandas melt)
      const { idVars = [], valueVars = [], varName = 'variable', valueName = 'value' } = config;
      
      // 如果没有指定 valueVars，使用所有非 idVars 的列
      const meltColumns = valueVars.length > 0 ? valueVars : table.columns.filter(col => !idVars.includes(col));
      
      const newData: any[] = [];
      
      for (const row of table.data) {
        for (const col of meltColumns) {
          const newRow: any = {};
          // 复制 idVars
          for (const idVar of idVars) {
            newRow[idVar] = row[idVar];
          }
          // 添加 variable 和 value
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
        colCount: newColumns.length
      };
    } else {
      // 长表 → 宽表 (类似 pandas pivot)
      const { index, columns, values } = config;
      
      if (!index || !columns || !values) {
        throw new Error('长表转宽表需要指定 index、columns 和 values');
      }
      
      // 收集所有唯一的 index 值和 columns 值
      const indexValues = [...new Set(table.data.map(row => row[index]))];
      const columnValues = [...new Set(table.data.map(row => row[columns]))];
      
      const newData: any[] = [];
      
      for (const idxVal of indexValues) {
        const newRow: any = { [index]: idxVal };
        
        for (const colVal of columnValues) {
          // 找到匹配的行
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
        colCount: newColumns.length
      };
    }
  };

  // 执行数据透视
  const executePivot = (table: DataTable, config: PivotConfig): DataTable => {
    const { rows, columns, values, filters } = config;
    
    // 先应用过滤器
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
    
    // 按 rows 和 columns 分组
    const groups = new Map<string, any[]>();
    
    for (const row of filteredData) {
      const rowKey = rows.map(r => row[r]).join('_|_');
      const colKey = columns.map(c => row[c]).join('_|_');
      const key = `${rowKey}__COL__${colKey}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }
    
    // 获取所有唯一的列维度值
    const uniqueColValues = [...new Set(filteredData.map(row => columns.map(c => row[c]).join('_|_')))];
    
    // 聚合计算
    const aggregate = (group: any[], aggType: string, valueCol: string): number => {
      const values = group.map(r => r[valueCol]).filter(v => v !== null && v !== undefined && v !== '');
      const nums = values.map(v => Number(v)).filter(v => !isNaN(v));
      
      switch (aggType) {
        case 'sum': return nums.reduce((a, b) => a + b, 0);
        case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case 'count': return values.length;
        case 'max': return nums.length ? Math.max(...nums) : 0;
        case 'min': return nums.length ? Math.min(...nums) : 0;
        case 'first': return values[0] ?? 0;
        case 'last': return values[values.length - 1] ?? 0;
        default: return 0;
      }
    };
    
    // 构建结果
    const rowGroups = new Map<string, any>();
    
    for (const [key, group] of groups) {
      const [rowKey, colKey] = key.split('__COL__');
      
      if (!rowGroups.has(rowKey)) {
        const row: any = {};
        rows.forEach((r, i) => {
          row[r] = rowKey.split('_|_')[i];
        });
        rowGroups.set(rowKey, row);
      }
      
      const row = rowGroups.get(rowKey);
      
      // 对每个值字段进行聚合
      for (const valConfig of values) {
        const aggValue = aggregate(group, valConfig.aggregation, valConfig.column);
        const colName = columns.length > 0 
          ? `${colKey}_${valConfig.column}_${valConfig.aggregation}`
          : `${valConfig.column}_${valConfig.aggregation}`;
        row[colName] = aggValue;
      }
    }
    
    const newData = Array.from(rowGroups.values());
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
      colCount: newColumns.length
    };
  };

  // 执行衍生计算
  const executeDerive = (table: DataTable, config: DeriveConfig): DataTable => {
    const { newColumn, formula } = config;
    
    // 解析并执行公式
    const evaluateFormula = (row: any, expr: string): any => {
      // 替换列引用为实际值
      let processedExpr = expr;
      table.columns.forEach(col => {
        const value = row[col];
        const safeValue = typeof value === 'string' ? `"${value}"` : value;
        processedExpr = processedExpr.replace(new RegExp(`\\b${col}\\b`, 'g'), safeValue ?? 'null');
      });
      
      try {
        // 安全执行：使用 Function 构造器
        // 支持常用函数
        const func = new Function('UPPER', 'LOWER', 'TRIM', 'LEN', 'SUBSTR', 'REPLACE', 'CONCAT', 'IF', 'AND', 'OR', 'NOT', 
          `return ${processedExpr}`);
        
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
      [newColumn]: evaluateFormula(row, formula)
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
      colCount: newColumns.length
    };
  };

  // 执行随机抽样
  const executeSample = (table: DataTable, config: SampleConfig): DataTable => {
    const { method, count, percentage, seed } = config;
    
    // 简单的伪随机数生成器（可选种子）
    const seededRandom = (() => {
      let s = seed ?? Date.now();
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();
    
    const data = [...table.data];
    
    // Fisher-Yates 洗牌
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
        seed
      }
    } as DataTable;
  };

  // 导出结果
  const exportResult = (format: string) => {
    if (!previewData) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'csv':
        content = [
          previewData.columns.join(','),
          ...previewData.data.map(row => previewData.columns.map(col => row[col]).join(','))
        ].join('\n');
        filename = 'result.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = JSON.stringify(previewData.data, null, 2);
        filename = 'result.json';
        mimeType = 'application/json';
        break;
      case 'sql_in':
        const idCol = previewData.columns[0];
        const ids = previewData.data.map(row => `'${row[idCol]}'`).join(',');
        content = `(${ids})`;
        filename = 'sql_in.txt';
        mimeType = 'text/plain';
        break;
      case 'markdown':
        content = [
          '| ' + previewData.columns.join(' | ') + ' |',
          '|' + previewData.columns.map(() => '---').join('|') + '|',
          ...previewData.data.map(row => '| ' + previewData.columns.map(col => row[col]).join(' | ') + ' |')
        ].join('\n');
        filename = 'result.md';
        mimeType = 'text/markdown';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filename}`);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          数据工坊
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          可视化数据表处理工具 - 宽长转换、多表JOIN、格式化输出
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：数据源和操作链 */}
        <div className="lg:col-span-1 space-y-4 relative z-50">
          {/* 数据源 */}
          <Card className="glass border-[var(--border-subtle)] overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
                  数据源
                </div>
                <SecurityBadge showDetails={false} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 overflow-visible">
              {/* 文件上传 */}
              <div>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-2 w-full p-3 rounded cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">上传 CSV / Excel / JSON</span>
                </label>
              </div>
              
              {/* 从 Datasets 导入 */}
              <button
                onClick={() => {
                  loadDatasets();
                  setShowDatasetSelector(true);
                }}
                className="flex items-center justify-center gap-2 w-full p-3 rounded cursor-pointer transition-all hover:bg-[var(--bg-tertiary)]"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px dashed var(--neon-cyan)/50',
                  color: 'var(--neon-cyan)'
                }}
              >
                <FolderOpen className="w-4 h-4" />
                <span className="text-sm">从云端导入</span>
              </button>
              
              {/* Phase 2.1: 从本地存储导入 */}
              <button
                onClick={() => {
                  loadLocalDatasets();
                  setShowLocalDatasets(true);
                }}
                className="flex items-center justify-center gap-2 w-full p-3 rounded cursor-pointer transition-all hover:bg-[var(--bg-tertiary)]"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px dashed var(--neon-purple)/50',
                  color: 'var(--neon-purple)'
                }}
              >
                <HardDrive className="w-4 h-4" />
                <span className="text-sm">从本地导入</span>
                {localDatasets.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--neon-purple)]/20">
                    {localDatasets.length}
                  </span>
                )}
              </button>

              {/* 已上传表列表 */}
              {tables.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tables.map(table => (
                    <div
                      key={table.id}
                      className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-all ${
                        activeTableId === table.id
                          ? 'bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]'
                          : 'bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-subtle)]'
                      }`}
                      onClick={() => setActiveTableId(table.id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[var(--neon-cyan)]" />
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{table.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {table.rowCount} 行 × {table.columns.length} 列
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
                        className="text-[var(--neon-pink)] hover:text-[var(--neon-pink)]/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作链 */}
          <Card className="glass border-[var(--border-subtle)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[var(--neon-purple)]" />
                  操作链
                </div>
                <div className="flex items-center gap-1">
                  {operations.length > 0 && (
                    <button
                      onClick={() => setShowSaveChainDialog(true)}
                      className="text-xs px-2 py-1 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/30"
                      title="保存操作链"
                    >
                      <Save className="w-3 h-3 inline mr-1" />
                      保存
                    </button>
                  )}
                  {savedChains.length > 0 && (
                    <button
                      onClick={() => setShowLoadChainDialog(true)}
                      className="text-xs px-2 py-1 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
                      title="加载操作链"
                    >
                      <FolderOpen className="w-3 h-3 inline mr-1" />
                      加载
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddOperation(!showAddOperation)}
                    className="text-xs px-2 py-1 rounded bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/30"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    添加
                  </button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 添加操作面板 */}
              {showAddOperation && (
                <div className="p-2 rounded bg-[var(--bg-secondary)] space-y-1">
                  {OPERATION_TYPES.map(op => (
                    <button
                      key={op.type}
                      onClick={() => addOperation(op.type)}
                      className="w-full flex items-center gap-2 p-2 rounded text-xs text-left hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      <op.icon className="w-4 h-4 text-[var(--neon-cyan)]" />
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{op.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{op.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Phase 2.1: 引擎选择指示器 */}
              {engineDecision && (
                <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--text-muted)]">处理引擎</span>
                    <EngineIndicator 
                      engine={engineDecision.engine}
                      reason={engineDecision.reason}
                      estimatedTime={engineDecision.estimatedTime}
                    />
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate" title={engineDecision.reason}>
                    {engineDecision.reason}
                  </div>
                </div>
              )}

              {/* 操作列表 */}
              {operations.length === 0 ? (
                <div className="text-center py-4 text-[var(--text-muted)] text-xs">
                  点击上方"添加"按钮创建操作链
                </div>
              ) : (
                <div className="space-y-2">
                  {operations.map((op, index) => (
                    <OperationConfig
                      key={op.id}
                      operation={op}
                      index={index}
                      tables={tables}
                      onUpdate={(config) => updateOperationConfig(op.id, config)}
                      onRemove={() => removeOperation(op.id)}
                    />
                  ))}
                </div>
              )}

              {/* 执行按钮 */}
              {operations.length > 0 && (
                <button
                  onClick={executeOperations}
                  disabled={isProcessing || tables.length === 0}
                  className="w-full font-medium py-2 px-4 rounded transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: tables.length > 0 ? 'var(--neon-cyan)' : 'var(--bg-tertiary)',
                    color: tables.length > 0 ? 'var(--bg-primary)' : 'var(--text-muted)',
                    border: 'none',
                    opacity: isProcessing ? 0.5 : 1
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      执行操作链
                    </>
                  )}
                </button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：预览区域 */}
        <div className="lg:col-span-2">
          {!previewData ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Table className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">上传数据并执行操作链</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">处理结果将在此预览</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* 结果概览 */}
              <Card className="glass border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
                    <span>处理结果</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => exportResult('csv')}
                        className="text-xs px-3 py-1.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
                      >
                        <Download className="w-3 h-3 inline mr-1" />
                        CSV
                      </button>
                      <button
                        onClick={() => exportResult('json')}
                        className="text-xs px-3 py-1.5 rounded bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/30"
                      >
                        <Download className="w-3 h-3 inline mr-1" />
                        JSON
                      </button>
                      <button
                        onClick={() => exportResult('sql_in')}
                        className="text-xs px-3 py-1.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/30"
                      >
                        <Code className="w-3 h-3 inline mr-1" />
                        SQL IN
                      </button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 text-xs text-[var(--text-muted)]">
                    {previewData.rowCount} 行 × {previewData.columns.length} 列
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-[var(--bg-secondary)]">
                          {previewData.columns.map(col => (
                            <th key={col} className="p-2 text-left text-[var(--neon-cyan)] font-medium border-b border-[var(--border-subtle)]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.data.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-secondary)]/50">
                            {previewData.columns.map(col => (
                              <td key={col} className="p-2 text-[var(--text-primary)]">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.data.length > 100 && (
                      <div className="text-center py-2 text-xs text-[var(--text-muted)]">
                        ... 还有 {previewData.data.length - 100} 行数据 ...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      {/* 保存操作链对话框 */}
      {showSaveChainDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">保存操作链</h3>
            <input
              type="text"
              value={chainName}
              onChange={(e) => setChainName(e.target.value)}
              placeholder="输入操作链名称..."
              className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveChainDialog(false)}
                className="flex-1 py-2 px-4 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              >
                取消
              </button>
              <button
                onClick={saveChain}
                className="flex-1 py-2 px-4 rounded-lg bg-[var(--neon-green)] text-[var(--bg-primary)] hover:bg-[var(--neon-green)]/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 加载操作链对话框 */}
      {showLoadChainDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">加载操作链</h3>
              <button onClick={() => setShowLoadChainDialog(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {savedChains.length === 0 ? (
                <p className="text-center text-[var(--text-muted)] py-4">暂无保存的操作链</p>
              ) : (
                <div className="space-y-2">
                  {savedChains.map(chain => (
                    <div key={chain.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">{chain.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {chain.operations.length} 个操作 · {new Date(chain.createdAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={() => loadChain(chain.id)}
                          className="px-3 py-1.5 rounded text-xs bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
                        >
                          加载
                        </button>
                        <button
                          onClick={() => deleteChain(chain.id)}
                          className="p-1.5 rounded text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 数据集选择对话框 */}
      {showDatasetSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">选择云端数据集</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadDatasets}
                  disabled={loadingDatasets}
                  className="text-xs text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]/80 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingDatasets ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <button onClick={() => setShowDatasetSelector(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDatasets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--neon-cyan)]" />
                </div>
              ) : datasets.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无可用数据集</p>
                  <p className="text-xs mt-1">请先在「数据集」页面上传</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {datasets.map((dataset) => (
                    <button
                      key={dataset.id}
                      onClick={() => importFromDataset(dataset)}
                      disabled={loadingDatasets}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-[var(--bg-tertiary)] transition-all border border-transparent hover:border-[var(--border-subtle)]"
                    >
                      <Database className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--text-primary)] truncate">
                          {dataset.filename}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {dataset.row_count} 行 · {dataset.col_count} 列
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-[var(--neon-green)] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Phase 2.1: 本地数据集选择器 */}
      {showLocalDatasets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">本地数据集</h3>
                {storageStats && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    已用空间: {storageStats.usedSpace} · 压缩率: {storageStats.compressionRatio}
                  </p>
                )}
              </div>
              <button onClick={() => setShowLocalDatasets(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {localDatasets.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无本地数据集</p>
                  <p className="text-xs mt-1">上传文件时将自动保存到本地</p>
                  <button
                    onClick={() => {
                      setShowLocalDatasets(false);
                      document.getElementById('file-upload')?.click();
                    }}
                    className="mt-4 text-xs px-4 py-2 rounded bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/30"
                  >
                    上传文件
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {localDatasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                    >
                      <HardDrive className="w-5 h-5 text-[var(--neon-purple)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--text-primary)] truncate">
                          {dataset.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {dataset.rowCount.toLocaleString()} 行 · {new Date(dataset.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => loadFromLocalStorage(dataset.id)}
                          className="p-1.5 rounded hover:bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                          title="加载"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteLocalDataset(dataset.id)}
                          className="p-1.5 rounded hover:bg-[var(--neon-pink)]/20 text-[var(--neon-pink)]"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 操作配置组件
function OperationConfig({ 
  operation, 
  index, 
  tables, 
  onUpdate, 
  onRemove 
}: { 
  operation: Operation; 
  index: number; 
  tables: DataTable[];
  onUpdate: (config: any) => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const opDef = OPERATION_TYPES.find(op => op.type === operation.type);

  const renderConfig = () => {
    switch (operation.type) {
      case 'join':
        return <JoinConfigPanel config={operation.config} tables={tables} onUpdate={onUpdate} />;
      case 'filter':
        return <FilterConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'transform':
        return <TransformConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'dedup':
        return <DedupConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'reshape':
        return <ReshapeConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'pivot':
        return <PivotConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'derive':
        return <DeriveConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'sample':
        return <SampleConfigPanel config={operation.config} table={tables[0]} onUpdate={onUpdate} />;
      case 'output':
        return <OutputConfigPanel config={operation.config} onUpdate={onUpdate} />;
      default:
        return <div className="text-xs text-[var(--text-muted)]">配置面板开发中...</div>;
    }
  };

  return (
    <div className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
      <div 
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <GripVertical className="w-3 h-3 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--neon-cyan)]">{index + 1}.</span>
        {opDef && <opDef.icon className="w-4 h-4 text-[var(--neon-purple)]" />}
        <span className="flex-1 text-sm text-[var(--text-primary)]">{operation.name}</span>
        {isOpen ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-[var(--neon-pink)] hover:text-[var(--neon-pink)]/80"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          {renderConfig()}
        </div>
      )}
    </div>
  );
}

// JOIN配置面板
function JoinConfigPanel({ config, tables, onUpdate }: { config: Record<string, any>; tables: DataTable[]; onUpdate: (c: any) => void }) {
  const leftTable = tables.find(t => t.id === config.leftTable);
  const rightTable = tables.find(t => t.id === config.rightTable);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">左表</label>
          <select
            value={config.leftTable}
            onChange={(e) => onUpdate({ leftTable: e.target.value })}
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">选择表</option>
            {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">右表</label>
          <select
            value={config.rightTable}
            onChange={(e) => onUpdate({ rightTable: e.target.value })}
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">选择表</option>
            {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-[var(--text-muted)]">JOIN类型</label>
        <select
          value={config.joinType}
          onChange={(e) => onUpdate({ joinType: e.target.value })}
          className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          <option value="inner">INNER JOIN (交集)</option>
          <option value="left">LEFT JOIN (左表全)</option>
          <option value="right">RIGHT JOIN (右表全)</option>
          <option value="full">FULL JOIN (并集)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">左表关联键</label>
          <select
            value={config.leftKey}
            onChange={(e) => onUpdate({ leftKey: e.target.value })}
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">选择列</option>
            {leftTable?.columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">右表关联键</label>
          <select
            value={config.rightKey}
            onChange={(e) => onUpdate({ rightKey: e.target.value })}
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">选择列</option>
            {rightTable?.columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// 筛选配置面板
function FilterConfigPanel({ config, table, onUpdate }: { config: Record<string, any>; table: DataTable; onUpdate: (c: any) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[var(--text-muted)]">条件关系</label>
        <select
          value={config.logic}
          onChange={(e) => onUpdate({ logic: e.target.value })}
          className="p-1 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          <option value="and">全部满足 (AND)</option>
          <option value="or">任一满足 (OR)</option>
        </select>
      </div>

      {(config.conditions || []).map((cond: any, idx: number) => (
        <div key={idx} className="flex items-center gap-1">
          <select
            value={cond.column}
            onChange={(e) => {
              const newConds = [...config.conditions];
              newConds[idx].column = e.target.value;
              onUpdate({ conditions: newConds });
            }}
            className="flex-1 p-1 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">选择列</option>
            {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
          <select
            value={cond.operator}
            onChange={(e) => {
              const newConds = [...config.conditions];
              newConds[idx].operator = e.target.value as any;
              onUpdate({ conditions: newConds });
            }}
            className="p-1 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="eq">等于</option>
            <option value="ne">不等于</option>
            <option value="gt">大于</option>
            <option value="gte">大于等于</option>
            <option value="lt">小于</option>
            <option value="lte">小于等于</option>
            <option value="contains">包含</option>
          </select>
          <input
            type="text"
            value={cond.value}
            onChange={(e) => {
              const newConds = [...config.conditions];
              newConds[idx].value = e.target.value;
              onUpdate({ conditions: newConds });
            }}
            placeholder="值"
            className="flex-1 p-1 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
          <button
            onClick={() => {
              const newConds = (config.conditions || []).filter((_c: any, i: number) => i !== idx);
              onUpdate({ conditions: newConds });
            }}
            className="text-[var(--neon-pink)]"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      <button
        onClick={() => onUpdate({ conditions: [...config.conditions, { column: '', operator: 'eq', value: '' }] })}
        className="text-xs text-[var(--neon-cyan)] hover:underline"
      >
        + 添加条件
      </button>
    </div>
  );
}

// 输出配置面板
function OutputConfigPanel({ config, onUpdate }: { config: Record<string, any>; onUpdate: (c: any) => void }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">输出格式</label>
        <select
          value={config.format}
          onChange={(e) => onUpdate({ format: e.target.value })}
          className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          <option value="csv">CSV 文件</option>
          <option value="excel">Excel 文件</option>
          <option value="json">JSON 文件</option>
          <option value="sql_in">SQL IN 语句</option>
          <option value="sql_insert">SQL INSERT 语句</option>
          <option value="python">Python 代码</option>
          <option value="markdown">Markdown 表格</option>
        </select>
      </div>

      {(config.format === 'sql_insert' || config.format === 'sql_in') && (
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">表名</label>
          <input
            type="text"
            value={config.tableName || ''}
            onChange={(e) => onUpdate({ tableName: e.target.value })}
            placeholder="my_table"
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      )}

      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        示例输出：
        {config.format === 'sql_in' && (
          <code className="block mt-1 text-[var(--neon-green)]">('id1','id2','id3')</code>
        )}
        {config.format === 'sql_insert' && (
          <code className="block mt-1 text-[var(--neon-green)]">INSERT INTO table (col1,col2) VALUES (val1,val2)</code>
        )}
      </div>
    </div>
  );
}

// 列处理配置面板
function TransformConfigPanel({ config, table, onUpdate }: { config: TransformConfig; table: DataTable; onUpdate: (c: any) => void }) {
  const [activeTab, setActiveTab] = useState<TransformAction['type']>(config.actions[0]?.type || 'rename');
  
  const actionTypes = [
    { type: 'rename', label: '重命名', icon: Type },
    { type: 'split', label: '拆分', icon: SeparatorHorizontal },
    { type: 'merge', label: '合并', icon: Combine },
    { type: 'format', label: '格式化', icon: Calendar },
    { type: 'remove', label: '删除', icon: Trash2 },
  ] as const;

  const currentAction = config.actions.find(a => a.type === activeTab) || { type: activeTab };

  const updateAction = (action: TransformAction) => {
    const newActions = config.actions.filter(a => a.type !== action.type);
    newActions.push(action);
    onUpdate({ actions: newActions });
  };

  return (
    <div className="space-y-3">
      {/* 操作类型选择 */}
      <div className="flex flex-wrap gap-1">
        {actionTypes.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
              activeTab === type
                ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* 重命名配置 */}
      {activeTab === 'rename' && (
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--text-muted)]">批量重命名列</p>
          {(currentAction as any).mappings?.map((mapping: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={mapping.oldName}
                onChange={(e) => {
                  const newMappings = [...((currentAction as any).mappings || [])];
                  newMappings[idx] = { ...mapping, oldName: e.target.value };
                  updateAction({ type: 'rename', mappings: newMappings });
                }}
                className="flex-1 p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="">选择列</option>
                {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
              <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
              <input
                type="text"
                value={mapping.newName}
                onChange={(e) => {
                  const newMappings = [...((currentAction as any).mappings || [])];
                  newMappings[idx] = { ...mapping, newName: e.target.value };
                  updateAction({ type: 'rename', mappings: newMappings });
                }}
                placeholder="新名称"
                className="flex-1 p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
              <button
                onClick={() => {
                  const newMappings = ((currentAction as any).mappings || []).filter((_: any, i: number) => i !== idx);
                  updateAction({ type: 'rename', mappings: newMappings });
                }}
                className="text-[var(--neon-pink)]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => updateAction({ 
              type: 'rename', 
              mappings: [...((currentAction as any).mappings || []), { oldName: '', newName: '' }] 
            })}
            className="text-xs text-[var(--neon-cyan)] hover:underline"
          >
            + 添加重命名
          </button>
        </div>
      )}

      {/* 拆分配置 */}
      {activeTab === 'split' && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">选择列</label>
            <select
              value={(currentAction as any).column || ''}
              onChange={(e) => updateAction({ type: 'split', column: e.target.value, delimiter: '-', newColumns: [''] })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="">选择列</option>
              {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">分隔符</label>
            <select
              value={(currentAction as any).delimiter || '-'}
              onChange={(e) => updateAction({ ...(currentAction as any), delimiter: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="-">- (连字符)</option>
              <option value="_">_ (下划线)</option>
              <option value=" ">空格</option>
              <option value=".">. (点)</option>
              <option value="/">/ (斜杠)</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          {(currentAction as any).delimiter === 'custom' && (
            <input
              type="text"
              value={(currentAction as any).customDelimiter || ''}
              onChange={(e) => updateAction({ ...(currentAction as any), delimiter: e.target.value })}
              placeholder="输入分隔符"
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          )}
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">新列名 (逗号分隔)</label>
            <input
              type="text"
              value={(currentAction as any).newColumns?.join(', ') || ''}
              onChange={(e) => updateAction({ 
                ...(currentAction as any), 
                newColumns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="col1, col2, col3"
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      )}

      {/* 合并配置 */}
      {activeTab === 'merge' && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">选择要合并的列</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {table?.columns.map(col => {
                const isSelected = (currentAction as any).columns?.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => {
                      const cols = (currentAction as any).columns || [];
                      const newCols = isSelected ? cols.filter((c: string) => c !== col) : [...cols, col];
                      updateAction({ type: 'merge', columns: newCols, separator: '-', newColumn: 'merged' });
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      isSelected
                        ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">连接符</label>
            <select
              value={(currentAction as any).separator || '-'}
              onChange={(e) => updateAction({ ...(currentAction as any), separator: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="-">- (连字符)</option>
              <option value="_">_ (下划线)</option>
              <option value=" ">空格</option>
              <option value="">无</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">新列名</label>
            <input
              type="text"
              value={(currentAction as any).newColumn || ''}
              onChange={(e) => updateAction({ ...(currentAction as any), newColumn: e.target.value })}
              placeholder="merged_column"
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      )}

      {/* 格式化配置 */}
      {activeTab === 'format' && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">选择列</label>
            <select
              value={(currentAction as any).column || ''}
              onChange={(e) => updateAction({ type: 'format', column: e.target.value, formatType: 'date', formatPattern: '' })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="">选择列</option>
              {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">格式化类型</label>
            <select
              value={(currentAction as any).formatType || 'date'}
              onChange={(e) => updateAction({ ...(currentAction as any), formatType: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="date">日期格式</option>
              <option value="number">数字格式</option>
              <option value="text">文本格式</option>
            </select>
          </div>
          {(currentAction as any).formatType === 'date' && (
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">日期格式</label>
              <select
                value={(currentAction as any).formatPattern || 'YYYY-MM-DD'}
                onChange={(e) => updateAction({ ...(currentAction as any), formatPattern: e.target.value })}
                className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                <option value="YYYY年MM月DD日">YYYY年MM月DD日</option>
              </select>
            </div>
          )}
          {(currentAction as any).formatType === 'number' && (
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">数字格式</label>
              <select
                value={(currentAction as any).formatPattern || '0.00'}
                onChange={(e) => updateAction({ ...(currentAction as any), formatPattern: e.target.value })}
                className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="0">整数</option>
                <option value="0.00">2位小数</option>
                <option value="0.0000">4位小数</option>
                <option value="0%">百分比</option>
                <option value="0.00%">百分比(2位小数)</option>
                <option value="0,000">千分位</option>
                <option value="0,000.00">千分位(2位小数)</option>
              </select>
            </div>
          )}
          {(currentAction as any).formatType === 'text' && (
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">文本操作</label>
              <select
                value={(currentAction as any).formatPattern || 'upper'}
                onChange={(e) => updateAction({ ...(currentAction as any), formatPattern: e.target.value })}
                className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="upper">转大写</option>
                <option value="lower">转小写</option>
                <option value="trim">去除首尾空格</option>
                <option value="capitalize">首字母大写</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* 删除配置 */}
      {activeTab === 'remove' && (
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--text-muted)]">选择要删除的列</p>
          <div className="flex flex-wrap gap-1">
            {table?.columns.map(col => {
              const isSelected = (currentAction as any).columns?.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => {
                    const cols = (currentAction as any).columns || [];
                    const newCols = isSelected ? cols.filter((c: string) => c !== col) : [...cols, col];
                    updateAction({ type: 'remove', columns: newCols });
                  }}
                  className={`px-2 py-1 rounded text-xs border transition-all ${
                    isSelected
                      ? 'bg-[var(--neon-pink)]/20 border-[var(--neon-pink)]/50 text-[var(--neon-pink)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-pink)]/30'
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 去重配置面板
function DedupConfigPanel({ config, table, onUpdate }: { config: DedupConfig; table: DataTable; onUpdate: (c: any) => void }) {
  return (
    <div className="space-y-3">
      {/* 选择去重列 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">基于列去重（不选则全局去重）</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {table?.columns.map(col => {
            const isSelected = config.columns?.includes(col);
            return (
              <button
                key={col}
                onClick={() => {
                  const cols = config.columns || [];
                  const newCols = isSelected 
                    ? cols.filter((c: string) => c !== col)
                    : [...cols, col];
                  onUpdate({ ...config, columns: newCols });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  isSelected
                    ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
                }`}
              >
                {col}
              </button>
            );
          })}
        </div>
        {config.columns?.length === 0 && (
          <p className="text-[10px] text-[var(--text-muted)] mt-1">未选择列，将对整行进行全局去重</p>
        )}
      </div>

      {/* 保留策略 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">保留策略</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ ...config, keep: 'first' })}
            className={`flex-1 px-3 py-2 rounded text-xs border transition-all ${
              config.keep === 'first'
                ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
            }`}
          >
            保留第一条
          </button>
          <button
            onClick={() => onUpdate({ ...config, keep: 'last' })}
            className={`flex-1 px-3 py-2 rounded text-xs border transition-all ${
              config.keep === 'last'
                ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
            }`}
          >
            保留最后一条
          </button>
        </div>
      </div>

      {/* 大小写敏感 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="caseSensitive"
          checked={config.caseSensitive}
          onChange={(e) => onUpdate({ ...config, caseSensitive: e.target.checked })}
          className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--neon-cyan)]"
        />
        <label htmlFor="caseSensitive" className="text-xs text-[var(--text-primary)] cursor-pointer">
          区分大小写
        </label>
      </div>

      {/* 提示 */}
      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        <p>• 基于指定列：只比较选中列的值是否相同</p>
        <p>• 全局去重：比较整行所有列的值</p>
        <p>• 保留策略：重复数据保留第一条还是最后一条</p>
      </div>
    </div>
  );
}

// 宽长转换配置面板
function ReshapeConfigPanel({ config, table, onUpdate }: { config: ReshapeConfig; table: DataTable; onUpdate: (c: any) => void }) {
  const { direction } = config;

  return (
    <div className="space-y-3">
      {/* 转换方向 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">转换方向</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ ...config, direction: 'melt' })}
            className={`flex-1 px-3 py-2 rounded text-xs border transition-all ${
              direction === 'melt'
                ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
            }`}
          >
            宽表 → 长表 (Melt)
          </button>
          <button
            onClick={() => onUpdate({ ...config, direction: 'pivot' })}
            className={`flex-1 px-3 py-2 rounded text-xs border transition-all ${
              direction === 'pivot'
                ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
            }`}
          >
            长表 → 宽表 (Pivot)
          </button>
        </div>
      </div>

      {/* Melt 配置 */}
      {direction === 'melt' && (
        <>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">保持不变的列 (ID列)</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {table?.columns.map(col => {
                const isSelected = config.idVars?.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => {
                      const cols = config.idVars || [];
                      const newCols = isSelected
                        ? cols.filter((c: string) => c !== col)
                        : [...cols, col];
                      onUpdate({ ...config, idVars: newCols });
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      isSelected
                        ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)]">要转换的列 (不选则转换所有其他列)</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {table?.columns.filter(col => !config.idVars?.includes(col)).map(col => {
                const isSelected = config.valueVars?.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => {
                      const cols = config.valueVars || [];
                      const newCols = isSelected
                        ? cols.filter((c: string) => c !== col)
                        : [...cols, col];
                      onUpdate({ ...config, valueVars: newCols });
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      isSelected
                        ? 'bg-[var(--neon-purple)]/20 border-[var(--neon-purple)]/50 text-[var(--neon-purple)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/30'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">新列名 (原列名)</label>
              <input
                type="text"
                value={config.varName || 'variable'}
                onChange={(e) => onUpdate({ ...config, varName: e.target.value })}
                className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">值列名</label>
              <input
                type="text"
                value={config.valueName || 'value'}
                onChange={(e) => onUpdate({ ...config, valueName: e.target.value })}
                className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        </>
      )}

      {/* Pivot 配置 */}
      {direction === 'pivot' && (
        <>
          <div>
            <label className="text-[10px] text-[var(--text-muted)]">行索引列</label>
            <select
              value={config.index || ''}
              onChange={(e) => onUpdate({ ...config, index: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="">选择列</option>
              {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)]">展开为列的列</label>
            <select
              value={config.columns || ''}
              onChange={(e) => onUpdate({ ...config, columns: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="">选择列</option>
              {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)]">值列</label>
            <select
              value={config.values || ''}
              onChange={(e) => onUpdate({ ...config, values: e.target.value })}
              className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="">选择列</option>
              {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
        </>
      )}

      {/* 说明 */}
      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        {direction === 'melt' ? (
          <>
            <p><strong className="text-[var(--neon-cyan)]">宽表→长表：</strong>将多列转换为两列（变量名+值）</p>
            <p className="mt-1">例：将「产品A销量」「产品B销量」转为「产品」「销量」</p>
          </>
        ) : (
          <>
            <p><strong className="text-[var(--neon-cyan)]">长表→宽表：</strong>将两列扩展为多列</p>
            <p className="mt-1">例：将「产品」「销量」转为「产品A销量」「产品B销量」</p>
          </>
        )}
      </div>
    </div>
  );
}

// 数据透视配置面板
function PivotConfigPanel({ config, table, onUpdate }: { config: Record<string, any>; table: DataTable; onUpdate: (c: any) => void }) {
  const aggregations = [
    { value: 'sum', label: '求和' },
    { value: 'avg', label: '平均值' },
    { value: 'count', label: '计数' },
    { value: 'max', label: '最大值' },
    { value: 'min', label: '最小值' },
    { value: 'first', label: '首个' },
    { value: 'last', label: '末个' },
  ];

  const addValueField = () => {
    const values = config.values || [];
    onUpdate({ ...config, values: [...values, { column: '', aggregation: 'sum' }] });
  };

  const updateValueField = (index: number, field: any) => {
    const values = [...(config.values || [])];
    values[index] = { ...values[index], ...field };
    onUpdate({ ...config, values });
  };

  const removeValueField = (index: number) => {
    const values = (config.values || []).filter((_: any, i: number) => i !== index);
    onUpdate({ ...config, values });
  };

  return (
    <div className="space-y-3">
      {/* 行维度 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">行维度</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {table?.columns.map(col => {
            const isSelected = config.rows?.includes(col);
            return (
              <button
                key={col}
                onClick={() => {
                  const rows = config.rows || [];
                  const newRows = isSelected
                    ? rows.filter((c: string) => c !== col)
                    : [...rows, col];
                  onUpdate({ ...config, rows: newRows });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  isSelected
                    ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/30'
                }`}
              >
                {col}
              </button>
            );
          })}
        </div>
      </div>

      {/* 列维度 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">列维度（可选）</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {table?.columns.filter(col => !(config.rows || []).includes(col)).map(col => {
            const isSelected = config.columns?.includes(col);
            return (
              <button
                key={col}
                onClick={() => {
                  const cols = config.columns || [];
                  const newCols = isSelected
                    ? cols.filter((c: string) => c !== col)
                    : [...cols, col];
                  onUpdate({ ...config, columns: newCols });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  isSelected
                    ? 'bg-[var(--neon-purple)]/20 border-[var(--neon-purple)]/50 text-[var(--neon-purple)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/30'
                }`}
              >
                {col}
              </button>
            );
          })}
        </div>
      </div>

      {/* 值字段 */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-[var(--text-muted)]">值字段</label>
          <button
            onClick={addValueField}
            className="text-[10px] px-2 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
          >
            + 添加
          </button>
        </div>
        <div className="space-y-2 mt-1">
          {(config.values || []).map((val: any, index: number) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
              <select
                value={val.column}
                onChange={(e) => updateValueField(index, { column: e.target.value })}
                className="flex-1 p-1.5 rounded text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="">选择列</option>
                {table?.columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
              <select
                value={val.aggregation}
                onChange={(e) => updateValueField(index, { aggregation: e.target.value })}
                className="w-24 p-1.5 rounded text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                {aggregations.map(agg => <option key={agg.value} value={agg.value}>{agg.label}</option>)}
              </select>
              <button
                onClick={() => removeValueField(index)}
                className="p-1 text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/10 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {(config.values || []).length === 0 && (
            <div className="text-xs text-[var(--text-muted)] italic">点击上方按钮添加值字段</div>
          )}
        </div>
      </div>

      {/* 说明 */}
      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        <p><strong className="text-[var(--neon-cyan)]">数据透视：</strong>按维度聚合数据，类似 Excel 透视表</p>
        <p className="mt-1">例：按「地区」行、按「产品」列、对「销售额」求和</p>
      </div>
    </div>
  );
}

// 衍生计算配置面板
function DeriveConfigPanel({ config, table, onUpdate }: { config: Record<string, any>; table: DataTable; onUpdate: (c: any) => void }) {
  const functions = [
    { name: 'UPPER', desc: '转大写', example: 'UPPER(列名)' },
    { name: 'LOWER', desc: '转小写', example: 'LOWER(列名)' },
    { name: 'TRIM', desc: '去空格', example: 'TRIM(列名)' },
    { name: 'LEN', desc: '字符串长度', example: 'LEN(列名)' },
    { name: 'SUBSTR', desc: '截取', example: 'SUBSTR(列名, 0, 3)' },
    { name: 'REPLACE', desc: '替换', example: 'REPLACE(列名, "旧", "新")' },
    { name: 'CONCAT', desc: '连接', example: 'CONCAT(列A, "-", 列B)' },
    { name: 'IF', desc: '条件', example: 'IF(列A > 100, "高", "低")' },
    { name: 'AND', desc: '与', example: 'AND(条件1, 条件2)' },
    { name: 'OR', desc: '或', example: 'OR(条件1, 条件2)' },
  ];

  const insertColumn = (col: string) => {
    const currentFormula = config.formula || '';
    const newFormula = currentFormula + (currentFormula ? ' ' : '') + col;
    onUpdate({ ...config, formula: newFormula });
  };

  const insertFunction = (fn: string) => {
    const currentFormula = config.formula || '';
    const newFormula = currentFormula + (currentFormula ? ' ' : '') + fn;
    onUpdate({ ...config, formula: newFormula });
  };

  return (
    <div className="space-y-3">
      {/* 新列名 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">新列名</label>
        <input
          type="text"
          value={config.newColumn || ''}
          onChange={(e) => onUpdate({ ...config, newColumn: e.target.value })}
          placeholder="输入新列名称"
          className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        />
      </div>

      {/* 公式 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">计算公式</label>
        <textarea
          value={config.formula || ''}
          onChange={(e) => onUpdate({ ...config, formula: e.target.value })}
          placeholder="例如：列A + 列B * 2 或 UPPER(列名)"
          rows={3}
          className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
        />
      </div>

      {/* 可用列 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">可用列</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {table?.columns.map(col => (
            <button
              key={col}
              onClick={() => insertColumn(col)}
              className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-cyan)]/50 hover:text-[var(--neon-cyan)] transition-all"
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* 可用函数 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">可用函数（点击插入）</label>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {functions.map(fn => (
            <button
              key={fn.name}
              onClick={() => insertFunction(fn.example)}
              className="p-1.5 rounded text-[10px] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/50 hover:text-[var(--neon-purple)] text-left transition-all"
              title={fn.example}
            >
              <span className="font-mono text-[var(--neon-cyan)]">{fn.name}</span>
              <span className="ml-1">{fn.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 运算符 */}
      <div className="flex flex-wrap gap-1">
        {['+', '-', '*', '/', '%', '==', '!=', '>', '<', '>=', '<=', '&&', '||'].map(op => (
          <button
            key={op}
            onClick={() => insertFunction(op)}
            className="px-2 py-1 rounded text-xs border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--neon-purple)]/50 hover:text-[var(--neon-purple)] transition-all"
          >
            {op}
          </button>
        ))}
      </div>

      {/* 说明 */}
      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        <p><strong className="text-[var(--neon-cyan)]">衍生计算：</strong>基于现有列创建新列</p>
        <p className="mt-1">支持：数学运算(+ - * /)、比较运算(== != &gt; &lt;)、逻辑运算(&& ||)</p>
      </div>
    </div>
  );
}

// 随机抽样配置面板
function SampleConfigPanel({ config, table, onUpdate }: { config: Record<string, any>; table: DataTable; onUpdate: (c: any) => void }) {
  const method = config.method || 'count';

  return (
    <div className="space-y-3">
      {/* 抽样方式 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">抽样方式</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ ...config, method: 'count' })}
            className={`flex-1 py-1.5 px-2 rounded text-xs border transition-all ${
              method === 'count'
                ? 'bg-[var(--neon-cyan)]/20 border-[var(--neon-cyan)]/50 text-[var(--neon-cyan)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            指定数量
          </button>
          <button
            onClick={() => onUpdate({ ...config, method: 'percentage' })}
            className={`flex-1 py-1.5 px-2 rounded text-xs border transition-all ${
              method === 'percentage'
                ? 'bg-[var(--neon-purple)]/20 border-[var(--neon-purple)]/50 text-[var(--neon-purple)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            指定百分比
          </button>
        </div>
      </div>

      {/* 数量 */}
      {method === 'count' && (
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">抽样数量</label>
          <input
            type="number"
            min={1}
            max={table?.rowCount || 100000}
            value={config.count || 100}
            onChange={(e) => onUpdate({ ...config, count: parseInt(e.target.value) || 100 })}
            className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            最大: {table?.rowCount || 'N/A'} 行
          </div>
        </div>
      )}

      {/* 百分比 */}
      {method === 'percentage' && (
        <div>
          <label className="text-[10px] text-[var(--text-muted)]">抽样百分比</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={config.percentage || 10}
              onChange={(e) => onUpdate({ ...config, percentage: parseInt(e.target.value) || 10 })}
              className="flex-1 p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
            <span className="text-xs text-[var(--text-muted)]">%</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            预计抽取: {Math.floor((table?.rowCount || 0) * (config.percentage || 10) / 100)} 行
          </div>
        </div>
      )}

      {/* 随机种子 */}
      <div>
        <label className="text-[10px] text-[var(--text-muted)]">随机种子（可选）</label>
        <input
          type="number"
          value={config.seed || ''}
          onChange={(e) => onUpdate({ ...config, seed: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="留空则随机"
          className="w-full p-1.5 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        />
        <div className="text-[10px] text-[var(--text-muted)] mt-1">
          固定种子可保证结果可重复
        </div>
      </div>

      {/* 说明 */}
      <div className="p-2 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
        <p><strong className="text-[var(--neon-cyan)]">随机抽样：</strong>从数据中随机抽取指定数量的记录</p>
        <p className="mt-1">使用 Fisher-Yates 洗牌算法，保证随机性</p>
      </div>
    </div>
  );
}
