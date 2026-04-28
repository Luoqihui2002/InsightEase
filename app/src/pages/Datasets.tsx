import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  MoreVertical,
  Trash2,
  Download,
  Eye,
  Search,
  Plus,
  Database,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Table,
  CheckSquare,
  Square,
  X,
  Pencil,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { toast } from 'sonner';
import gsap from 'gsap';
import { useNavigate } from 'react-router-dom';
import { datasetApi } from '@/api';
import { quickRequest } from '@/lib/request';
import type { Dataset, DatasetPreview } from '@/types/api';
import { companionService } from '@/services';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentGrid } from '@/components/layout/ContentGrid';
import { SectionCard } from '@/components/layout/SectionCard';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { StatCard } from '@/components/data-display/StatCard';
import { DataTablePreview } from '@/components/data-display/DataTablePreview';

export function Datasets() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<Record<string, DatasetPreview>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // 多选状态
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // 重命名状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // 删除确认弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<'batch' | string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // 加载数据函数：统一从后端 API 加载
  const loadDatasets = async () => {
    setLoading(true);
    setError('');

    try {
      const res: any = await quickRequest.get('/datasets', { params: { page: 1, page_size: 50 } });
      const newDatasets = res.items || res.data?.items || [];
      setDatasets(newDatasets);

      // 清理已不存在的选中项
      setSelectedRows(prev => {
        const newIds = new Set(newDatasets.map((d: Dataset) => d.id));
        const validSelections = Array.from(prev).filter(id => newIds.has(id));
        return new Set(validSelections);
      });
    } catch (err: any) {
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadDatasets();

    // 通知AI助手当前页面
    companionService.setPage('datasets');
  }, []);

  // 监听存储模式变化
  useEffect(() => {
    const handleStorageChange = () => {
      loadDatasets();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 动画效果
  useEffect(() => {
    if (tableRef.current && datasets.length > 0) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          tableRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );
      });
      return () => ctx.revert();
    }
  }, [datasets]);

  // 加载预览数据
  const loadPreview = async (datasetId: string) => {
    if (previewData[datasetId]) {
      return;
    }
    setLoadingPreview(datasetId);
    try {
      const res = await datasetApi.preview(datasetId, 5) as unknown as { code: number; data: DatasetPreview };
      setPreviewData(prev => ({ ...prev, [datasetId]: res.data }));
    } catch (err) {
      console.error('Failed to load preview:', err);
    } finally {
      setLoadingPreview(null);
    }
  };

  // 切换行展开状态
  const toggleRowExpand = async (datasetId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(datasetId)) {
      newExpanded.delete(datasetId);
    } else {
      newExpanded.add(datasetId);
      await loadPreview(datasetId);
    }
    setExpandedRows(newExpanded);
  };

  // 多选相关函数
  const toggleRowSelection = (datasetId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(datasetId)) {
      newSelected.delete(datasetId);
    } else {
      newSelected.add(datasetId);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredDatasets.length && filteredDatasets.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredDatasets.map(d => d.id)));
    }
  };

  // 打开删除确认弹窗
  const openDeleteDialog = (target: 'batch' | string) => {
    setDeleteTarget(target);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteDialogOpen(false);
  };

  // 执行删除
  const executeDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget === 'batch') {
      if (selectedRows.size === 0) {
        closeDeleteDialog();
        return;
      }
      setIsBatchDeleting(true);
      try {
        const deletePromises = Array.from(selectedRows).map(id =>
          datasetApi.delete(id).catch(err => ({ id, error: err }))
        );

        const results = await Promise.all(deletePromises);
        const failures = results.filter((r: any) => r && r.error);

        if (failures.length > 0) {
          toast.error(`${failures.length} 个数据集删除失败`);
        } else {
          toast.success('批量删除成功');
        }

        await loadDatasets();
      } catch (err: any) {
        toast.error('批量删除失败: ' + err.message);
      } finally {
        setIsBatchDeleting(false);
        closeDeleteDialog();
      }
    } else {
      try {
        await datasetApi.delete(deleteTarget);
        toast.success('删除成功');
        await loadDatasets();
      } catch (err: any) {
        toast.error('删除失败: ' + err.message);
      } finally {
        closeDeleteDialog();
      }
    }
  };

  // 批量下载
  // 下载单个文件（从后端下载）
  const downloadFile = async (dataset: Dataset) => {
    try {
      const token = localStorage.getItem('access_token');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

      const response = await fetch(`${baseURL}/datasets/${dataset.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMsg = '下载失败';
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorData.message || `下载失败 (${response.status})`;
        } catch {
          errorMsg = `下载失败 (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMsg);
      }

      const contentDisposition = response.headers.get('content-disposition');
      let filename = dataset.filename;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || `下载 ${dataset.filename} 失败`);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedRows.size === 0) return;

    // 逐个下载（串行避免浏览器限制）
    for (const id of selectedRows) {
      const dataset = datasets.find(d => d.id === id);
      if (dataset) {
        await downloadFile(dataset);
        // 延迟避免浏览器限制
        await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  // 开始重命名
  const startRename = (dataset: Dataset) => {
    setEditingId(dataset.id);
    setEditingName(dataset.filename);
  };

  // 取消重命名
  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  // 确认重命名
  const confirmRename = async () => {
    if (!editingId || !editingName.trim()) return;

    // 检查文件名是否合法
    if (!/[\w一-龥\-_\.]+$/.test(editingName)) {
      toast.error('文件名包含非法字符');
      return;
    }

    setIsRenaming(true);
    try {
      await datasetApi.rename(editingId, editingName.trim());
      await loadDatasets();
      setEditingId(null);
      setEditingName('');
      toast.success('重命名成功');
    } catch (err: any) {
      toast.error('重命名失败: ' + err.message);
    } finally {
      setIsRenaming(false);
    }
  };

  // 查看详情
  const handleViewDetail = async (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setIsDetailOpen(true);
    if (!previewData[dataset.id]) {
      await loadPreview(dataset.id);
    }
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'text-[var(--text-muted)]';
    if (score >= 90) return 'text-[var(--neon-green)]';
    if (score >= 80) return 'text-[var(--neon-cyan)]';
    if (score >= 70) return 'text-[var(--neon-orange)]';
    return 'text-[var(--neon-pink)]';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // 过滤数据集
  const filteredDatasets = datasets.filter(d =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 统计数据
  const totalSize = datasets.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);
  const avgQuality = datasets.length > 0
    ? Math.round(datasets.reduce((acc, d) => acc + (d.quality_score || 0), 0) / datasets.filter(d => d.quality_score).length || 0)
    : 0;

  if (loading) {
    return (
      <PageShell>
        <LoadingState message="正在加载数据集..." className="h-64" />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <ErrorState title="加载失败" message={error} onRetry={loadDatasets} className="h-64" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* 页面标题 */}
      <PageHeader
        title="数据集"
        subtitle="管理已上传的数据集，预览字段结构、查看详情并进入后续分析。"
        actions={
          <Button
            onClick={() => navigate('/app/upload')}
            className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            上传数据
          </Button>
        }
      />

      {/* 统计卡片 */}
      <ContentGrid cols={4}>
        <StatCard
          label="数据集总数"
          value={datasets.length}
          icon={
            <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
            </div>
          }
        />
        <StatCard
          label="总存储"
          value={formatFileSize(totalSize)}
          icon={
            <div className="w-10 h-10 rounded-lg bg-[var(--neon-purple)]/20 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[var(--neon-purple)]" />
            </div>
          }
        />
        <StatCard
          label="总行数"
          value={totalRows > 1000000 ? (totalRows / 1000000).toFixed(1) + 'M' : totalRows > 1000 ? (totalRows / 1000).toFixed(1) + 'K' : totalRows}
          icon={
            <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-[var(--neon-green)]" />
            </div>
          }
        />
        <StatCard
          label="平均质量分"
          value={avgQuality || '-'}
          valueClassName={getQualityColor(avgQuality)}
          icon={
            <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-[var(--neon-green)]" />
            </div>
          }
        />
      </ContentGrid>

      {/* 数据集列表 */}
      <SectionCard
        title={
          <div className="flex items-center justify-between w-full">
            <span>数据集列表 {datasets.length > 0 && `(${filteredDatasets.length}/${datasets.length})`}</span>
            {selectedRows.size > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30 animate-in fade-in slide-in-from-right-2 duration-200">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  已选 {selectedRows.size} 个
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchDownload}
                    className="h-7 px-2 text-xs border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-[var(--bg-primary)]"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    下载
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog('batch')}
                    disabled={isBatchDeleting}
                    className="h-7 px-2 text-xs border-[var(--neon-pink)] text-[var(--neon-pink)] hover:bg-[var(--neon-pink)] hover:text-[var(--bg-primary)]"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRows(new Set())}
                    className="h-7 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
      >
        {/* 搜索栏 */}
        <div className="flex gap-4 items-center mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索数据集..."
              className="pl-10 bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)]"
            />
          </div>
        </div>

        <div ref={tableRef}>
          {filteredDatasets.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database className="text-[var(--text-muted)]" />
                </EmptyMedia>
                <EmptyTitle className="text-[var(--text-primary)]">
                  {searchQuery ? '未找到匹配的数据集' : '暂无数据集'}
                </EmptyTitle>
                <EmptyDescription>
                  {searchQuery ? '请尝试其他关键词' : '请先上传数据集'}
                </EmptyDescription>
              </EmptyHeader>
              {!searchQuery && (
                <Button onClick={() => navigate('/app/upload')} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  去上传
                </Button>
              )}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)] w-10">
                      <button
                        onClick={toggleAllSelection}
                        className="text-[var(--neon-cyan)] hover:opacity-80"
                      >
                        {selectedRows.size === filteredDatasets.length && filteredDatasets.length > 0 ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)] w-10"></th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">文件名</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">大小</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">行数</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">列数</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">上传时间</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-[var(--text-muted)]">质量分</th>
                    <th className="text-right py-3 px-3 text-sm font-medium text-[var(--text-muted)]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDatasets.map((dataset) => (
                    <React.Fragment key={dataset.id}>
                      <tr
                        className={`border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]/50 transition-colors ${
                          selectedRows.has(dataset.id) ? 'bg-[var(--neon-cyan)]/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowSelection(dataset.id);
                            }}
                            className="text-[var(--neon-cyan)] hover:opacity-80"
                          >
                            {selectedRows.has(dataset.id) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => toggleRowExpand(dataset.id)}
                            className="text-[var(--text-muted)] hover:text-[var(--neon-cyan)]"
                          >
                            {expandedRows.has(dataset.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          {editingId === dataset.id ? (
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0" />
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmRename();
                                  if (e.key === 'Escape') cancelRename();
                                }}
                                disabled={isRenaming}
                                autoFocus
                                className="h-8 text-sm bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                              />
                              <button
                                onClick={confirmRename}
                                disabled={isRenaming}
                                className="p-1 rounded text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10 disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelRename}
                                disabled={isRenaming}
                                className="p-1 rounded text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/10 disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <FileSpreadsheet className="w-5 h-5 text-[var(--neon-cyan)]" />
                              <span className="text-[var(--text-primary)]">{dataset.filename}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">
                          {formatFileSize(dataset.file_size)}
                        </td>
                        <td className="py-3 px-3 text-[var(--text-secondary)] mono">{dataset.row_count?.toLocaleString()}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{dataset.col_count}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">
                          {new Date(dataset.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold mono ${getQualityColor(dataset.quality_score)}`}>
                            {dataset.quality_score || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
                              <DropdownMenuItem
                                onClick={() => handleViewDetail(dataset)}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => startRename(dataset)}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => downloadFile(dataset)}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                下载
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(dataset.id)}
                                className="text-[var(--neon-pink)] cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                      {/* 展开的前五行预览 */}
                      {expandedRows.has(dataset.id) && (
                        <tr>
                          <td colSpan={9} className="py-0 px-4 bg-[var(--bg-secondary)]/50">
                            <div className="py-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Table className="w-4 h-4 text-[var(--neon-cyan)]" />
                                <span className="text-sm font-medium text-[var(--text-primary)]">前 5 行预览</span>
                                {loadingPreview === dataset.id && (
                                  <Loader2 className="w-3 h-3 animate-spin text-[var(--neon-cyan)]" />
                                )}
                              </div>
                              {previewData[dataset.id] ? (
                                <DataTablePreview
                                  columns={previewData[dataset.id].columns}
                                  data={previewData[dataset.id].data}
                                  maxHeight="300px"
                                />
                              ) : loadingPreview === dataset.id ? (
                                <LoadingState message="加载预览数据..." size="sm" />
                              ) : (
                                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                                  无法加载预览数据
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 底部上传快捷入口 */}
        <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
          <Button
            onClick={() => navigate('/app/upload')}
            variant="outline"
            className="w-full border-dashed border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50 hover:text-[var(--neon-cyan)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            去上传数据
          </Button>
        </div>
      </SectionCard>

      {/* 详情弹窗 */}
      {selectedDataset && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] p-0 flex flex-col overflow-hidden">
            <DialogHeader className="p-6 border-b border-[var(--border-subtle)]">
              <DialogTitle className="text-xl text-[var(--text-primary)] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[var(--neon-cyan)]" />
                {selectedDataset.filename}
              </DialogTitle>
              <DialogDescription className="text-[var(--text-muted)]">
                数据集详细信息和前5行预览
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 基本信息 */}
              <ContentGrid cols={4}>
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-sm text-[var(--text-muted)]">文件大小</p>
                  <p className="text-lg text-[var(--text-primary)] mono">
                    {formatFileSize(selectedDataset.file_size)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-sm text-[var(--text-muted)]">行数</p>
                  <p className="text-lg text-[var(--text-primary)] mono">
                    {selectedDataset.row_count?.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-sm text-[var(--text-muted)]">列数</p>
                  <p className="text-lg text-[var(--text-primary)] mono">
                    {selectedDataset.col_count}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-sm text-[var(--text-muted)]">数据质量</p>
                  <p className={`text-lg mono ${getQualityColor(selectedDataset.quality_score)}`}>
                    {selectedDataset.quality_score || '-'}/100
                  </p>
                </div>
              </ContentGrid>

              {/* 前五行预览 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Table className="w-4 h-4 text-[var(--neon-cyan)]" />
                  数据预览 (前5行)
                </h4>
                {previewData[selectedDataset.id] ? (
                  <DataTablePreview
                    columns={previewData[selectedDataset.id].columns}
                    data={previewData[selectedDataset.id].data}
                    maxHeight="400px"
                  />
                ) : (
                  <LoadingState message="加载预览数据..." size="sm" />
                )}
              </div>

              {/* 字段信息 */}
              {selectedDataset.schema && selectedDataset.schema.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">字段结构</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDataset.schema.map((field: any, index: number) => (
                      <div key={index} className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[var(--neon-cyan)]">{field.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                            {field.dtype}
                          </span>
                        </div>
                        {field.sample_values && (
                          <p className="text-xs text-[var(--text-muted)]">
                            示例: {field.sample_values.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 摘要 */}
              {selectedDataset.ai_summary && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--neon-purple)]/10 to-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                  <p className="text-sm text-[var(--neon-cyan)] mb-2">AI 摘要</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {selectedDataset.ai_summary}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'batch'
                ? `确定要删除选中的 ${selectedRows.size} 个数据集吗？此操作不可撤销。`
                : '确定要删除这个数据集吗？此操作不可撤销。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/80"
            >
              {deleteTarget === 'batch' && isBatchDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
