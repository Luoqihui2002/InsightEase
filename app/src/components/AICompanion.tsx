/**
 * AI Companion — 可拖拽启动器 + 紧凑通知
 *
 * 交互：
 *   拖动   →  reposition orb (left/top px)
 *   双击   →  open AIWorkspace
 *   通知   →  compact card above launcher, never morphs into input
 *
 * 禁止：input / chat / typing / capsule / freeform
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCompanion } from '@/hooks/useCompanion';
import { cn } from '@/lib/utils';
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar';

const POSITION_KEY = 'insightease_ai_companion_position';
const ORB_SIZE = 64; // w-16 = 64px
const MARGIN = 20;

function getDefaultPosition() {
  return {
    x: Math.max(MARGIN, window.innerWidth - ORB_SIZE - MARGIN),
    y: Math.max(MARGIN, window.innerHeight - ORB_SIZE - MARGIN),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidPosition(pos: unknown): pos is { x: number; y: number } {
  return (
    typeof pos === 'object' &&
    pos !== null &&
    typeof (pos as Record<string, unknown>).x === 'number' &&
    typeof (pos as Record<string, unknown>).y === 'number' &&
    Number.isFinite((pos as Record<string, unknown>).x) &&
    Number.isFinite((pos as Record<string, unknown>).y)
  );
}

export function AICompanion() {
  const { state, dismiss, executeAction, isVisible } = useCompanion();
  const [isHovered, setIsHovered] = useState(false);

  // ===== 拖拽位置（left/top 像素坐标） =====
  const [position, setPosition] = useState(getDefaultPosition);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);

  // 从 localStorage 恢复位置（带校验 + clamp）
  useEffect(() => {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        if (isValidPosition(pos)) {
          setPosition({
            x: clamp(pos.x, MARGIN, window.innerWidth - ORB_SIZE - MARGIN),
            y: clamp(pos.y, MARGIN, window.innerHeight - ORB_SIZE - MARGIN),
          });
          return;
        }
      } catch {
        // ignore corrupt data
      }
    }
    // 无保存数据或数据损坏：使用默认位置
    setPosition(getDefaultPosition());
  }, []);

  // 持久化位置
  useEffect(() => {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  }, [position]);

  // 窗口 resize 时保持在视口内
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: clamp(prev.x, MARGIN, window.innerWidth - ORB_SIZE - MARGIN),
        y: clamp(prev.y, MARGIN, window.innerHeight - ORB_SIZE - MARGIN),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== 拖拽事件 =====
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [position.x, position.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // 超过阈值才开始算作拖拽
    if (!isDraggingRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      setPosition({
        x: clamp(
          dragStartRef.current.posX + dx,
          MARGIN,
          window.innerWidth - ORB_SIZE - MARGIN
        ),
        y: clamp(
          dragStartRef.current.posY + dy,
          MARGIN,
          window.innerHeight - ORB_SIZE - MARGIN
        ),
      });
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // 短暂延迟后清除拖拽标记，避免双击检测误判
    window.setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (!isDraggingRef.current) {
      executeAction('open-chat');
    }
  }, [executeAction]);

  const handleAction = useCallback(
    (action: string) => {
      executeAction(action);
    },
    [executeAction]
  );

  // ===== 脉冲：新通知到达时短暂高亮 =====
  const [justNotified, setJustNotified] = useState(false);
  useEffect(() => {
    if (isVisible) {
      setJustNotified(true);
      const t = setTimeout(() => setJustNotified(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isVisible, state.message]);

  return (
    <div
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
    >
      <div className="relative flex flex-col items-end gap-3">
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
        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 新通知脉冲环 */}
          <AnimatePresence>
            {justNotified && (
              <motion.div
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(6,182,212,0.35) 0%, transparent 70%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* 悬停提示 — pointer-events-none 防止干扰 orb hover */}
          <AnimatePresence>
            {isHovered && !isVisible && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none"
              >
                <span className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  拖动可移动位置，双击打开 AI 工作台
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 可拖拽球体 */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className="relative cursor-grab active:cursor-grabbing rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/40"
            style={{ touchAction: 'none' }}
            role="button"
            aria-label="拖动可移动位置，双击打开 AI 工作台"
          >
            <AssistantAvatar
              variant={isVisible ? 'processing' : 'default'}
              size="lg"
              animated
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AICompanion;
