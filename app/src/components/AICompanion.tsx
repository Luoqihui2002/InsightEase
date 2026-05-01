/**
 * AI Companion — 极简启动器 + 紧凑通知
 *
 * 状态模型（严格三态）：
 *   collapsed      → 仅显示启动器球体
 *   notification   → 启动器 + 紧凑通知卡片
 *   workspace_open → AppLayout 接管， companion 隐藏
 *
 * 禁止状态：input / chat / typing / capsule / freeform
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCompanion } from '@/hooks/useCompanion';
import { cn } from '@/lib/utils';
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar';

export function AICompanion() {
  const { state, dismiss, executeAction, isVisible } = useCompanion();
  const [isHovered, setIsHovered] = useState(false);

  const handleAction = useCallback(
    (action: string) => {
      executeAction(action);
    },
    [executeAction]
  );

  const handleOpenWorkspace = useCallback(() => {
    executeAction('open-chat');
  }, [executeAction]);

  // 脉冲：新通知到达时短暂高亮
  const [justNotified, setJustNotified] = useState(false);
  useEffect(() => {
    if (isVisible) {
      setJustNotified(true);
      const t = setTimeout(() => setJustNotified(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isVisible, state.message]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* ===== 紧凑通知卡片 ===== */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'w-[280px] p-3.5 rounded-2xl',
              'bg-[var(--bg-secondary)]/95 backdrop-blur-lg',
              'border border-[var(--neon-cyan)]/20',
              'shadow-xl shadow-black/20'
            )}
          >
            {/* 头部：消息 + 关闭 */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {state.message || '你好！有什么可以帮你的吗？'}
              </p>
              {state.canDismiss && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  className="shrink-0 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  aria-label="关闭通知"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 操作按钮（最多 3 个） */}
            {state.suggestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {state.suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(s.action);
                    }}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium',
                      'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]',
                      'border border-[var(--neon-cyan)]/25',
                      'hover:bg-[var(--neon-cyan)]/20 hover:border-[var(--neon-cyan)]/40',
                      'transition-all active:scale-95'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 启动器球体 ===== */}
      <div className="relative">
        {/* 新通知脉冲环 */}
        <AnimatePresence>
          {justNotified && (
            <motion.div
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0 rounded-full bg-cyan-400/30"
            />
          )}
        </AnimatePresence>

        {/* 悬停提示 */}
        <AnimatePresence>
          {isHovered && !isVisible && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
            >
              <span className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                打开 AI 工作台
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 可点击球体 */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleOpenWorkspace}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/40"
          aria-label="打开 AI 工作台"
        >
          <AssistantAvatar
            variant={isVisible ? 'processing' : 'default'}
            size="lg"
            animated
          />
        </motion.button>
      </div>
    </div>
  );
}

export default AICompanion;
