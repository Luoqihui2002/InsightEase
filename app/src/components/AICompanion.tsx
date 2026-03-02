/**
 * AI Companion - 极简发光圆点助手
 * 
 * 设计：赛博朋克风格，霓虹发光圆点
 * 交互：呼吸动画 + 脉冲提示 + 气泡对话 + 拖拽移动
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GripHorizontal } from 'lucide-react';
import { useCompanion } from '@/hooks/useCompanion';
import { cn } from '@/lib/utils';
import { KimiAvatar } from './KimiAvatar';

export function AICompanion() {
  const { state, dismiss, executeAction, isVisible } = useCompanion();
  const [isHovered, setIsHovered] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleAction = useCallback((action: string) => {
    executeAction(action);
  }, [executeAction]);

  // 新消息时显示脉冲效果
  useEffect(() => {
    if (state.visible) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.visible, state.message]);

  // 未激活状态 - 极简发光圆点（可拖拽）
  if (!isVisible) {
    return (
      <>
        {/* 拖拽约束区域（全屏） */}
        <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />
        
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          drag
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
          whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
          className="fixed bottom-6 right-6 z-50 cursor-grab active:cursor-grabbing"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 悬停提示 */}
          <AnimatePresence>
            {isHovered && !isDragging && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
              >
                <span className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center gap-1">
                  <GripHorizontal className="w-3 h-3" />
                  拖拽移动 / 双击对话
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Kimi 头像按钮 */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onDoubleClick={() => handleAction('open-chat')}
            className="relative cursor-pointer"
          >
            {/* 呼吸光环 */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full bg-blue-400/30"
            />

            {/* 外圈光晕 */}
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0, 0.2],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute inset-0 rounded-full border-2 border-blue-400/50"
            />

            {/* Kimi 头像 */}
            <KimiAvatar size="lg" mood="idle" />
          </motion.div>
        </motion.div>
      </>
    );
  }

  // 激活状态 - 气泡对话（可拖拽）
  return (
    <>
      {/* 拖拽约束区域 */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />
      
      <motion.div 
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
        whileDrag={{ cursor: 'grabbing' }}
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 cursor-grab active:cursor-grabbing"
      >
        {/* 消息气泡 */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "w-[320px] p-4 rounded-2xl relative flex-shrink-0",
              "bg-[var(--bg-secondary)]/95 backdrop-blur-lg",
              "border border-[var(--neon-cyan)]/30",
              "shadow-xl shadow-black/20"
            )}
          >
            {/* 关闭按钮 */}
            {state.canDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="absolute top-2 right-2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* 消息内容 */}
            <div className="flex items-start gap-3">
              {/* Kimi 风格头像 */}
              <KimiAvatar size="sm" mood={state.mood} />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] leading-relaxed min-h-[1.5rem]">
                  {state.message || '你好！有什么可以帮你的吗？'}
                </p>

                {/* 快捷操作按钮 */}
                {state.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {state.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(suggestion.action);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium",
                          "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]",
                          "border border-[var(--neon-cyan)]/30",
                          "hover:bg-[var(--neon-cyan)]/20 hover:border-[var(--neon-cyan)]/50",
                          "transition-all active:scale-95"
                        )}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 底部 Kimi 头像 */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative"
        >
          {/* 脉冲效果 */}
          {showPulse && (
            <motion.div
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 rounded-full bg-blue-500/50"
            />
          )}
          <KimiAvatar size="md" mood={state.mood} />
        </motion.div>
      </motion.div>
    </>
  );
}

export default AICompanion;
