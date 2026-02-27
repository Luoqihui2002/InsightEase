/**
 * DuckDB-WASM 加载状态组件
 * 
 * 显示：
 * - 加载进度
 * - 加载状态（下载中、初始化中、完成、错误）
 * - 取消按钮
 */

import { useState, useEffect } from 'react';
import { Database, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  onDuckDBStatusChange, 
  getDuckDBStatus, 
  type DuckDBStatus,
  terminateWorker 
} from '@/services/duckdb-service';

interface DuckDBLoaderProps {
  showWhenReady?: boolean;
  className?: string;
}

export function DuckDBLoader({ showWhenReady = false, className }: DuckDBLoaderProps) {
  const [status, setStatus] = useState<DuckDBStatus>(getDuckDBStatus());
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const unsubscribe = onDuckDBStatusChange((newStatus) => {
      setStatus(newStatus);
      
      // 加载完成且不需要显示时，自动隐藏
      if (newStatus.isLoaded && !showWhenReady) {
        setTimeout(() => setIsVisible(false), 2000);
      }
    });

    return unsubscribe;
  }, [showWhenReady]);

  const handleCancel = () => {
    terminateWorker();
    setIsVisible(false);
  };

  // 根据状态决定是否显示
  if (!isVisible || (status.isLoaded && !showWhenReady && !status.error)) {
    return null;
  }

  // 状态配置
  const getStatusConfig = () => {
    if (status.error) {
      return {
        icon: <AlertCircle className="w-5 h-5 text-[var(--neon-pink)]" />,
        title: '加载失败',
        description: status.error,
        progressColor: 'bg-[var(--neon-pink)]',
      };
    }
    if (status.isLoaded) {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />,
        title: '高性能引擎就绪',
        description: 'DuckDB 已加载，可以处理大数据',
        progressColor: 'bg-[var(--neon-green)]',
      };
    }
    if (status.isLoading) {
      return {
        icon: <Loader2 className="w-5 h-5 text-[var(--neon-cyan)] animate-spin" />,
        title: '正在加载高性能引擎...',
        description: '首次使用需要下载约 12MB（仅一次）',
        progressColor: 'bg-[var(--neon-cyan)]',
      };
    }
    return {
      icon: <Database className="w-5 h-5 text-[var(--text-muted)]" />,
      title: '高性能引擎',
      description: '点击加载 DuckDB-WASM',
      progressColor: 'bg-[var(--neon-cyan)]',
    };
  };

  const config = getStatusConfig();

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg border",
      "bg-[var(--bg-secondary)] border-[var(--border-subtle)]",
      className
    )}>
      {/* 图标 */}
      <div className="flex-shrink-0">
        {config.icon}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {config.title}
          </span>
          
          {/* 关闭按钮（错误时显示） */}
          {status.error && (
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {config.description}
        </p>

        {/* 进度条 */}
        {(status.isLoading || status.isLoaded) && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  config.progressColor
                )}
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--text-muted)]">
                {status.isLoading ? '下载中...' : '完成'}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {status.progress}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 小型 DuckDB 状态指示器（用于工具栏等紧凑空间）
 */
interface DuckDBIndicatorProps {
  className?: string;
}

export function DuckDBIndicator({ className }: DuckDBIndicatorProps) {
  const [status, setStatus] = useState<DuckDBStatus>(getDuckDBStatus());

  useEffect(() => {
    return onDuckDBStatusChange(setStatus);
  }, []);

  // 未加载时不显示
  if (!status.isLoaded && !status.isLoading && !status.error) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs",
        status.isLoaded && "bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/30",
        status.isLoading && "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30",
        status.error && "bg-[var(--neon-pink)]/10 text-[var(--neon-pink)] border border-[var(--neon-pink)]/30",
        className
      )}
      title={status.error || (status.isLoaded ? 'DuckDB 已就绪' : '正在加载 DuckDB...')}
    >
      <Database className="w-3.5 h-3.5" />
      <span>
        {status.isLoaded && 'SQL 引擎'}
        {status.isLoading && '加载中...'}
        {status.error && '引擎错误'}
      </span>
    </div>
  );
}
