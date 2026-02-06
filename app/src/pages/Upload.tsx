import { useState, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import gsap from 'gsap';
import { datasetApi } from '@/api';  // 新增
import type { FieldSchema } from '@/types/api';  // 新增

interface UploadingFile {
  id: string;
  file: File;  // 保留原始文件引用
  name: string;
  size: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMsg?: string;
}

// 使用后端返回的真实数据结构
interface ScanReport {
  qualityScore: number;
  fields: FieldSchema[];
  datasetId: string;
  rowCount: number;
  colCount: number;
  aiSummary?: string;
}

export function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 新增：真实上传逻辑
  const handleFiles = async (files: File[]) => {
    const validFiles = files.filter(f => 
      f.name.endsWith('.csv') || 
      f.name.endsWith('.xlsx') || 
      f.name.endsWith('.xls')
    );

    for (const file of validFiles) {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newFile: UploadingFile = {
        id,
        file,  // 保存引用
        name: file.name,
        size: formatFileSize(file.size),
        progress: 0,
        status: 'uploading',
      };

      setUploadingFiles(prev => [...prev, newFile]);

      try {
        // 调用真实 API 上传
        const res: any = await datasetApi.upload(file, (percent) => {
          setUploadingFiles(prev => 
            prev.map(f => 
              f.id === id ? { ...f, progress: percent } : f
            )
          );
        });

        // 上传成功
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === id ? { ...f, progress: 100, status: 'completed' } : f
          )
        );

        // 显示后端返回的扫描报告
        const dataset = res.data || res;
        setScanReport({
          qualityScore: dataset?.quality_score || 85,
          fields: dataset?.schema || [],
          datasetId: dataset?.id,
          rowCount: dataset?.row_count,
          colCount: dataset?.col_count,
          aiSummary: dataset?.ai_summary || '上传成功，数据已准备就绪。',
        });

        // 触发动画
        setTimeout(() => {
          if (reportRef.current) {
            gsap.fromTo(
              reportRef.current,
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
            );
          }
        }, 100);

      } catch (err: any) {
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === id ? { ...f, status: 'error', errorMsg: err.message } : f
          )
        );
      }
    }
  };

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
    // 如果删除的是已完成的文件，也清空扫描报告
    const file = uploadingFiles.find(f => f.id === id);
    if (file?.status === 'completed') {
      setScanReport(null);
    }
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[var(--neon-pink)]" />;
      default:
        return <Loader2 className="w-5 h-5 text-[var(--neon-cyan)] animate-spin" />;
    }
  };

  const getStatusText = (status: UploadingFile['status'], errorMsg?: string) => {
    switch (status) {
      case 'completed':
        return '上传完成';
      case 'error':
        return errorMsg || '上传失败';
      default:
        return '上传中...';
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(21, 27, 61, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <h1 className="text-heading-1 text-[var(--text-primary)]">
          上传数据
        </h1>
        <p className="mt-1" style={{ color: '#94a3b8' }}>
          支持 CSV、Excel 格式，上传后自动进行智能探查
        </p>
      </div>

      {/* 拖拽上传区域 */}
      <Card className="glass border-[var(--border-subtle)]">
        <CardContent className="p-8">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
              ${isDragging 
                ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 neon-glow' 
                : 'border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50'
              }
            `}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="relative">
              {isDragging && (
                <div className="absolute inset-0 -m-2 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 animate-spin-slow bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-purple)] to-[var(--neon-cyan)] opacity-30" 
                       style={{ animation: 'spin 3s linear infinite' }} />
                </div>
              )}
              
              <div className="relative">
                <div className={`
                  w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${isDragging 
                    ? 'bg-[var(--neon-cyan)]/20 scale-110' 
                    : 'bg-[var(--bg-tertiary)]'
                  }
                `}>
                  <UploadCloud className={`
                    w-10 h-10 transition-all duration-300
                    ${isDragging ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)]'}
                  `} />
                </div>
                
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {isDragging ? '释放以上传文件' : '拖拽文件到此处'}
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  或点击选择文件，支持 CSV、Excel 格式
                </p>
                <div className="flex justify-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">.csv</span>
                  <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">.xlsx</span>
                  <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">.xls</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 上传中的文件列表（改为真实进度） */}
      {uploadingFiles.length > 0 && (
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)]">
              上传进度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadingFiles.map((file) => (
              <div 
                key={file.id} 
                className="flex items-center gap-4 p-4 rounded-lg bg-[var(--bg-secondary)]"
              >
                <FileSpreadsheet className="w-8 h-8 text-[var(--neon-cyan)]" />
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {file.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {file.size}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Progress 
                      value={file.progress} 
                      className="flex-1 h-2 bg-[var(--bg-tertiary)]"
                    />
                    <span className="text-xs text-[var(--text-muted)] w-12 text-right">
                      {Math.round(file.progress)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusIcon(file.status)}
                    <span className={`
                      text-xs
                      ${file.status === 'completed' ? 'text-[var(--neon-green)]' : ''}
                      ${file.status === 'error' ? 'text-[var(--neon-pink)]' : ''}
                      ${file.status === 'uploading' ? 'text-[var(--neon-cyan)]' : ''}
                    `}>
                      {getStatusText(file.status, file.errorMsg)}
                    </span>
                  </div>
                </div>
                
                {file.status !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--neon-pink)]"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 扫描报告（使用后端真实数据） */}
      {scanReport && (
        <div ref={reportRef}>
          <Card className="glass border-[var(--neon-cyan)]/30 neon-glow">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--neon-cyan)]" />
                智能探查报告
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 质量分数 */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="var(--bg-tertiary)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="var(--neon-cyan)"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${scanReport.qualityScore * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[var(--neon-cyan)] mono text-center">
                      {scanReport.qualityScore}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">数据质量评分</p>
                  <p className="text-lg text-[var(--text-primary)] font-medium">
                    {scanReport.qualityScore >= 90 ? '优秀' : 
                     scanReport.qualityScore >= 80 ? '良好' : '一般'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {scanReport.rowCount.toLocaleString()} 行 × {scanReport.colCount} 列
                  </p>
                </div>
              </div>

              {/* 字段分析（来自后端 schema） */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-[var(--text-primary)]">字段分析 ({scanReport.fields.length})</h4>
                {scanReport.fields.map((field, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--neon-cyan)]">
                        {field.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                        {field.dtype}
                      </span>
                      {field.semantic_type && field.semantic_type !== 'unknown' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]">
                          {field.semantic_type}
                        </span>
                      )}
                    </div>
                    {field.sample_values && field.sample_values.length > 0 && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        示例: {field.sample_values.slice(0, 3).map(v => String(v)).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* AI 摘要 */}
              {scanReport.aiSummary && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--neon-purple)]/10 to-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                  <p className="text-sm text-[var(--neon-cyan)] mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI 摘要
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {scanReport.aiSummary}
                  </p>
                </div>
              )}

              {/* 操作按钮（可以跳转到分析页面） */}
              <div className="flex gap-3">
                <Button 
                  className="flex-1 btn-neon bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                  onClick={() => window.location.href = `/app/datasets`}
                >
                  去查看数据集
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}