/**
 * 安全模式徽章 - 显示数据本地处理状态
 */

import { Shield, ShieldCheck, Database, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { localStorageService } from '@/services';
import { cn } from '@/lib/utils';

interface SecurityBadgeProps {
  className?: string;
  showDetails?: boolean;
}

export function SecurityBadge({ className, showDetails = false }: SecurityBadgeProps) {
  const [isSecurityMode, setIsSecurityMode] = useState(false);
  const [stats, setStats] = useState<{ datasetCount: number; usedSpace: string } | null>(null);

  useEffect(() => {
    // 初始化安全模式状态
    const initialMode = localStorageService.getSecurityMode();
    setIsSecurityMode(initialMode);

    // 订阅变化
    const unsubscribe = localStorageService.onSecurityModeChange((enabled) => {
      setIsSecurityMode(enabled);
      if (enabled) {
        loadStats();
      }
    });

    if (initialMode) {
      loadStats();
    }

    return unsubscribe;
  }, []);

  const loadStats = async () => {
    const status = await localStorageService.getStatus();
    setStats({
      datasetCount: status.datasetCount,
      usedSpace: localStorageService.formatStorageSize(status.usedSpace),
    });
  };

  const toggleMode = () => {
    const newMode = !isSecurityMode;
    localStorageService.setSecurityMode(newMode);
    setIsSecurityMode(newMode);
    if (newMode) {
      loadStats();
    }
  };

  if (!isSecurityMode) {
    return (
      <button
        onClick={toggleMode}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
          "border border-[var(--border-subtle)] text-[var(--text-muted)]",
          "hover:border-[var(--neon-cyan)]/50 hover:text-[var(--neon-cyan)]",
          "transition-all duration-200",
          className
        )}
        title="点击启用安全模式，数据将仅保存在本地"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>安全模式</span>
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={toggleMode}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
          "bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/50",
          "text-[var(--neon-cyan)]",
          "hover:bg-[var(--neon-cyan)]/20 transition-all duration-200"
        )}
        title="安全模式已启用，数据不会上传"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span className="font-medium">本地安全</span>
        <Lock className="w-3 h-3 ml-0.5" />
      </button>

      {showDetails && stats && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            {stats.datasetCount} 数据集
          </span>
          <span>·</span>
          <span>{stats.usedSpace}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 引擎选择指示器 - 显示当前使用的处理引擎
 */
interface EngineIndicatorProps {
  engine: 'js' | 'duckdb' | 'none';
  reason?: string;
  estimatedTime?: string;
  className?: string;
}

export function EngineIndicator({ 
  engine, 
  reason, 
  estimatedTime,
  className 
}: EngineIndicatorProps) {
  if (engine === 'none') return null;

  const isJS = engine === 'js';

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs",
        isJS 
          ? "bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
          : "bg-[var(--neon-purple)]/10 border border-[var(--neon-purple)]/30 text-[var(--neon-purple)]",
        className
      )}
      title={reason}
    >
      {isJS ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h18v18H3V3zm4.73 15.04c.4.85 1.19 1.55 2.54 1.55 1.5 0 2.53-.8 2.53-2.55v-5.78h-1.7v5.77c0 .86-.35 1.31-1.05 1.31-.61 0-.98-.27-1.38-.93l-1.94 1.63zm5.58.03c.5.98 1.51 1.55 3.13 1.55 1.93 0 3.17-1.03 3.17-2.75 0-1.8-1.14-2.38-3.08-2.88-1.15-.31-1.57-.64-1.57-1.18 0-.4.31-.76 1.02-.76.67 0 1.11.27 1.52.91l1.38-1.35c-.64-.98-1.46-1.37-2.9-1.37-1.81 0-3.01 1.08-3.01 2.61 0 1.69 1.12 2.29 2.87 2.78 1.21.33 1.71.74 1.71 1.38 0 .51-.45.87-1.28.87-.96 0-1.48-.42-1.95-1.15l-1.01 1.36z"/>
          </svg>
          <span>极速模式</span>
        </>
      ) : (
        <>
          <Database className="w-3.5 h-3.5" />
          <span>高性能引擎</span>
        </>
      )}
      {estimatedTime && (
        <span className="opacity-70">· {estimatedTime}</span>
      )}
    </div>
  );
}
