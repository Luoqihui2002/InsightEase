/**
 * 架构状态徽章 - 显示当前后端处理架构状态
 *
 * 注意：此组件不再提供模式切换功能。
 * 所有数据处理统一由后端执行，浏览器本地处理已标记为 legacy。
 */

import { Server, Database, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecurityBadgeProps {
  className?: string;
  showDetails?: boolean;
}

export function SecurityBadge({ className, showDetails = false }: SecurityBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
          "bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/50",
          "text-[var(--neon-cyan)]"
        )}
        title="当前版本统一由后端处理数据"
      >
        <Server className="w-3.5 h-3.5" />
        <span className="font-medium">Backend</span>
      </div>

      {showDetails && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            Metadata: Backend DB
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            File Storage: Backend-managed
          </span>
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
