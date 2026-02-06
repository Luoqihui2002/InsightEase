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
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';

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
  
  // 操作链
  const [operations, setOperations] = useState<Operation[]>([]);
  const [showAddOperation, setShowAddOperation] = useState(false);
  
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
          toast.success(`已导入 ${file.name} (${parsedData.length} 行)`);
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
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
                数据源
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
                <span className="text-sm">从数据集导入</span>
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
              <h3 className="text-lg font-bold text-[var(--text-primary)]">选择数据集</h3>
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
