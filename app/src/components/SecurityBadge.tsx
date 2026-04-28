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
