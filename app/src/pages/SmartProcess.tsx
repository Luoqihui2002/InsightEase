import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Settings2, 
  Wand2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  Trash2,
  Filter,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetSelector } from '@/components/DatasetSelector';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { toast } from 'sonner';
import gsap from 'gsap';

// 处理配置类型
interface ProcessConfig {
  // 缺失值处理
  missingValueStrategy: 'drop' | 'mean' | 'median' | 'mode' | 'fill' | 'none';
  missingValueFill: string;
  // 重复值处理
  duplicateStrategy: 'drop' | 'keep_first' | 'keep_last' | 'none';
  // 异常值处理
  outlierStrategy: 'drop' | 'clip' | 'mark' | 'none';
  outlierMethod: 'iqr' | 'zscore';
  outlierThreshold: number;
  // 数据类型转换
  typeConversion: boolean;
  // 数据标准化
  standardization: 'none' | 'zscore' | 'minmax' | 'log';
}

// 处理结果对比
interface ProcessResult {
  originalRows: number;
  processedRows: number;
  removedRows: number;
  originalNulls: number;
  processedNulls: number;
  fixedNulls: number;
  duplicatesRemoved: number;
  outliersRemoved: number;
  outputDatasetId?: string;
  outputDatasetName?: string;
}

export function SmartProcess() {
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 处理配置 - 默认全部不处理，让用户自己选择
  const [config, setConfig] = useState<ProcessConfig>({
    missingValueStrategy: 'none',
    missingValueFill: '0',
    duplicateStrategy: 'none',
    outlierStrategy: 'none',
    outlierMethod: 'iqr',
    outlierThreshold: 1.5,
    typeConversion: false,
    standardization: 'none',
  });

  // 加载数据集信息
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetInfo(null);
      setShowResult(false);
      return;
    }

    const loadDatasetInfo = async () => {
      try {
        const res = await datasetApi.getDetail(selectedDataset) as any;
        setDatasetInfo(res.data);
      } catch (err) {
        console.error('Failed to load dataset info:', err);
      }
    };

    loadDatasetInfo();
  }, [selectedDataset]);

  useEffect(() => {
    if (showResult && resultRef.current) {
      gsap.fromTo(
        resultRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, [showResult]);

  const handleConfigChange = <K extends keyof ProcessConfig>(
    key: K, 
    value: ProcessConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleProcess = async () => {
    if (!selectedDataset) {
      toast.error('请先选择数据集');
      return;
    }

    setIsProcessing(true);
    setShowResult(false);
    setProcessResult(null);

    try {
      const res = await analysisApi.create({
        dataset_id: selectedDataset,
        analysis_type: 'smart_process',
        params: config
      }) as any;

      if ((res.code === 202 || res.code === 200) && res.data?.id) {
        await pollResult(res.data.id);
      } else {
        throw new Error(res.message || '处理启动失败');
      }
    } catch (err: any) {
      toast.error(err.message || '处理失败');
      setIsProcessing(false);
    }
  };

  const pollResult = async (analysisId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const checkResult = async () => {
      try {
        attempts++;
        const res = await analysisApi.getResult(analysisId) as any;
        
        if (res.data?.status === 'completed') {
          // 构建处理结果
          const result: ProcessResult = {
            originalRows: res.data.result_data?.original_rows || datasetInfo?.row_count || 0,
            processedRows: res.data.result_data?.processed_rows || 0,
            removedRows: res.data.result_data?.removed_rows || 0,
            originalNulls: res.data.result_data?.original_nulls || 0,
            processedNulls: res.data.result_data?.processed_nulls || 0,
            fixedNulls: res.data.result_data?.fixed_nulls || 0,
            duplicatesRemoved: res.data.result_data?.duplicates_removed || 0,
            outliersRemoved: res.data.result_data?.outliers_removed || 0,
            outputDatasetId: res.data.result_data?.output_dataset_id,
            outputDatasetName: res.data.result_data?.output_dataset_name,
          };
          setProcessResult(result);
          setShowResult(true);
          setIsProcessing(false);
          toast.success('数据处理完成！已生成新的数据集');
          return;
        } else if (res.data?.status === 'failed') {
          throw new Error(res.data.error_msg || '处理失败');
        }

        if (attempts < maxAttempts) {
          setTimeout(checkResult, 1000);
        } else {
          throw new Error('处理超时');
        }
      } catch (err: any) {
        toast.error(err.message);
        setIsProcessing(false);
      }
    };

    setTimeout(checkResult, 1000);
  };

  const handleDownload = async () => {
    if (!processResult?.outputDatasetId) {
      toast.info('处理后的数据集暂无可下载文件');
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
      
      const response = await fetch(`${baseURL}/datasets/${processResult.outputDatasetId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      let filename = processResult.outputDatasetName || 'processed_data.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
      
      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('下载已开始');
    } catch (err) {
      toast.error(`下载失败: ${err}`);
    }
  };

  const handleReprocess = () => {
    setShowResult(false);
    setProcessResult(null);
    setIsConfigOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          智能处理
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          自定义数据处理流程，生成高质量数据集
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 配置面板 */}
        <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                处理配置
              </div>
              {isConfigOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          
          {isConfigOpen && (
            <CardContent className="space-y-4">
              {/* 数据集选择 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-muted)]">选择数据集</label>
                <DatasetSelector 
                  value={selectedDataset}
                  onChange={setSelectedDataset}
                />
                {datasetInfo && (
                  <p className="text-xs text-[var(--neon-cyan)]">
                    {datasetInfo.row_count?.toLocaleString()} 行 · {datasetInfo.col_count} 列
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-4">
                
                {/* 缺失值处理 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[var(--neon-cyan)]" />
                    <label className="text-sm font-medium text-[var(--text-primary)]">缺失值处理</label>
                  </div>
                  <select
                    value={config.missingValueStrategy}
                    onChange={(e) => handleConfigChange('missingValueStrategy', e.target.value as any)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="mean">填充均值（数值列）</option>
                    <option value="median">填充中位数（数值列）</option>
                    <option value="mode">填充众数（分类列）</option>
                    <option value="fill">填充固定值</option>
                    <option value="drop">删除包含缺失值的行</option>
                    <option value="none">不处理</option>
                  </select>
                  {config.missingValueStrategy === 'fill' && (
                    <input
                      type="text"
                      value={config.missingValueFill}
                      onChange={(e) => handleConfigChange('missingValueFill', e.target.value)}
                      placeholder="输入填充值"
                      className="w-full p-2 rounded text-sm mt-2"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    />
                  )}
                </div>

                {/* 重复值处理 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-[var(--neon-purple)]" />
                    <label className="text-sm font-medium text-[var(--text-primary)]">重复值处理</label>
                  </div>
                  <select
                    value={config.duplicateStrategy}
                    onChange={(e) => handleConfigChange('duplicateStrategy', e.target.value as any)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="drop">删除重复行</option>
                    <option value="keep_first">保留第一个</option>
                    <option value="keep_last">保留最后一个</option>
                    <option value="none">不处理</option>
                  </select>
                </div>

                {/* 异常值处理 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--neon-orange)]" />
                    <label className="text-sm font-medium text-[var(--text-primary)]">异常值处理</label>
                  </div>
                  <select
                    value={config.outlierStrategy}
                    onChange={(e) => handleConfigChange('outlierStrategy', e.target.value as any)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="none">不处理</option>
                    <option value="drop">删除异常值所在行</option>
                    <option value="clip">截断到边界值</option>
                    <option value="mark">标记但不删除</option>
                  </select>
                  {config.outlierStrategy !== 'none' && (
                    <>
                      <select
                        value={config.outlierMethod}
                        onChange={(e) => handleConfigChange('outlierMethod', e.target.value as any)}
                        className="w-full p-2 rounded text-sm mt-2"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <option value="iqr">IQR 方法（四分位距）</option>
                        <option value="zscore">Z-Score 方法</option>
                      </select>
                      {config.outlierMethod === 'iqr' && (
                        <div className="mt-2">
                          <label className="text-xs text-[var(--text-muted)]">IQR 倍数: {config.outlierThreshold}</label>
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.1"
                            value={config.outlierThreshold}
                            onChange={(e) => handleConfigChange('outlierThreshold', parseFloat(e.target.value))}
                            className="w-full mt-1"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 数据标准化 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[var(--neon-pink)]" />
                    <label className="text-sm font-medium text-[var(--text-primary)]">数据标准化</label>
                  </div>
                  <select
                    value={config.standardization}
                    onChange={(e) => handleConfigChange('standardization', e.target.value as any)}
                    className="w-full p-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value="none">不处理</option>
                    <option value="zscore">Z-Score 标准化</option>
                    <option value="minmax">Min-Max 归一化</option>
                    <option value="log">对数变换</option>
                  </select>
                </div>

                {/* 数据类型转换 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[var(--neon-green)]" />
                    <span className="text-sm text-[var(--text-primary)]">自动类型转换</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.typeConversion}
                      onChange={(e) => handleConfigChange('typeConversion', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--neon-cyan)]"></div>
                  </label>
                </div>

              </div>

              {/* 处理按钮 */}
              <button
                onClick={handleProcess}
                disabled={isProcessing || !selectedDataset}
                className="w-full font-medium py-2 px-4 rounded transition-all flex items-center justify-center"
                style={{
                  backgroundColor: selectedDataset ? 'var(--neon-cyan)' : 'var(--bg-tertiary)',
                  color: selectedDataset ? 'var(--bg-primary)' : 'var(--text-muted)',
                  cursor: selectedDataset ? 'pointer' : 'not-allowed',
                  border: 'none',
                  opacity: selectedDataset ? 1 : 0.5
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    开始处理
                  </>
                )}
              </button>

              {isProcessing && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  正在处理数据，请稍候...
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* 结果展示 */}
        <div className="lg:col-span-2 space-y-6">
          {!showResult ? (
            <Card className="glass border-[var(--border-subtle)] h-96 flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-[var(--neon-cyan)]/30 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">选择数据集并配置处理选项</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">处理后将生成新的数据集</p>
              </div>
            </Card>
          ) : (
            <div ref={resultRef} className="space-y-6">
              {/* 处理完成提示 */}
              <Card className="glass border-[var(--neon-green)]/30">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
                    处理完成
                    {processResult?.outputDatasetName && (
                      <span className="text-sm font-normal text-[var(--text-muted)]">
                        - {processResult.outputDatasetName}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    已生成新的处理后的数据集。您可以在数据集列表中查看，或下载处理后的文件。
                  </p>
                  
                  {/* 数据对比 */}
                  {processResult && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">原始行数</p>
                        <p className="text-xl font-bold text-[var(--text-primary)] mono">
                          {processResult.originalRows.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">处理后行数</p>
                        <p className="text-xl font-bold text-[var(--neon-cyan)] mono">
                          {processResult.processedRows.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">删除行数</p>
                        <p className="text-xl font-bold text-[var(--neon-pink)] mono">
                          {processResult.removedRows.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[var(--bg-secondary)] text-center">
                        <p className="text-xs text-[var(--text-muted)]">修复缺失值</p>
                        <p className="text-xl font-bold text-[var(--neon-green)] mono">
                          {processResult.fixedNulls.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 详细处理信息 */}
                  {processResult && (
                    <div className="mt-4 p-4 rounded bg-[var(--bg-secondary)]">
                      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">处理详情</h4>
                      <div className="space-y-2 text-sm">
                        {processResult.duplicatesRemoved > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">删除重复行:</span>
                            <span className="text-[var(--neon-orange)]">{processResult.duplicatesRemoved} 行</span>
                          </div>
                        )}
                        {processResult.outliersRemoved > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">删除异常值:</span>
                            <span className="text-[var(--neon-orange)]">{processResult.outliersRemoved} 行</span>
                          </div>
                        )}
                        {processResult.originalNulls > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">缺失值处理:</span>
                            <span className="text-[var(--neon-green)]">
                              {processResult.originalNulls} → {processResult.processedNulls}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">数据保留率:</span>
                          <span className="text-[var(--neon-cyan)]">
                            {processResult.originalRows > 0 
                              ? ((processResult.processedRows / processResult.originalRows) * 100).toFixed(1) 
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  className="flex-1 py-2 px-4 rounded font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--neon-cyan)',
                    color: 'var(--bg-primary)',
                  }}
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  下载处理后数据
                </button>
                <button
                  className="flex-1 py-2 px-4 rounded border font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={handleReprocess}
                >
                  <RotateCcw className="w-4 h-4" />
                  重新处理
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
