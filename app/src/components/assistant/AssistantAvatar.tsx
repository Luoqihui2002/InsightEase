/**
 * AssistantAvatar - 球形数据助手头像
 *
 * 视觉方向：圆润、柔和、友好
 * 球形 companion，软青/蓝渐变，简笔双眼表情
 * 适配 InsightEase 暗色主题
 */

import { cn } from '@/lib/utils';

export type AssistantAvatarVariant =
  | 'default'
  | 'dataset'
  | 'path'
  | 'forecast'
  | 'experiment'
  | 'text'
  | 'warning'
  | 'processing'
  | 'success';

export type AssistantAvatarSize = 'sm' | 'md' | 'lg';

interface AssistantAvatarProps {
  variant?: AssistantAvatarVariant;
  size?: AssistantAvatarSize;
  animated?: boolean;
  className?: string;
}

const sizeMap: Record<AssistantAvatarSize, { container: string; eye: string; gap: string }> = {
  sm: { container: 'w-9 h-9', eye: 'w-1.5 h-1.5', gap: 'gap-1.5' },
  md: { container: 'w-12 h-12', eye: 'w-2 h-2', gap: 'gap-2' },
  lg: { container: 'w-16 h-16', eye: 'w-2.5 h-2.5', gap: 'gap-2.5' },
};

const variantGradients: Record<AssistantAvatarVariant, string> = {
  default: 'from-cyan-400/80 via-sky-500/80 to-blue-600/80',
  dataset: 'from-emerald-400/80 via-teal-500/80 to-cyan-600/80',
  path: 'from-violet-400/80 via-purple-500/80 to-fuchsia-600/80',
  forecast: 'from-amber-400/80 via-orange-500/80 to-rose-600/80',
  experiment: 'from-lime-400/80 via-green-500/80 to-emerald-600/80',
  text: 'from-pink-400/80 via-rose-500/80 to-red-600/80',
  warning: 'from-orange-400/80 via-amber-500/80 to-yellow-600/80',
  processing: 'from-cyan-400/80 via-blue-500/80 to-indigo-600/80',
  success: 'from-green-400/80 via-emerald-500/80 to-teal-600/80',
};

const variantGlow: Record<AssistantAvatarVariant, string> = {
  default: 'shadow-cyan-500/30',
  dataset: 'shadow-emerald-500/30',
  path: 'shadow-violet-500/30',
  forecast: 'shadow-amber-500/30',
  experiment: 'shadow-lime-500/30',
  text: 'shadow-pink-500/30',
  warning: 'shadow-orange-500/30',
  processing: 'shadow-cyan-500/30',
  success: 'shadow-green-500/30',
};

export function AssistantAvatar({
  variant = 'default',
  size = 'md',
  animated = true,
  className,
}: AssistantAvatarProps) {
  const { container, eye, gap } = sizeMap[size];

  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center',
        'bg-gradient-to-br',
        variantGradients[variant],
        'shadow-lg',
        variantGlow[variant],
        'border border-white/10',
        container,
        className
      )}
    >
      {/* 顶部高光 — 营造球体感 */}
      <div
        className="absolute top-[15%] left-[20%] w-[35%] h-[25%] rounded-full bg-white/20 blur-[3px]"
        aria-hidden="true"
      />

      {/* 眼睛 */}
      <div className={cn('flex items-center justify-center', gap)}>
        <div
          className={cn(
            'rounded-full bg-white/90 shadow-sm',
            eye,
            animated && variant === 'processing' && 'animate-pulse'
          )}
        />
        <div
          className={cn(
            'rounded-full bg-white/90 shadow-sm',
            eye,
            animated && variant === 'processing' && 'animate-pulse'
          )}
          style={animated && variant === 'processing' ? { animationDelay: '150ms' } : undefined}
        />
      </div>

      {/* 底部微光 */}
      <div
        className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-[50%] h-[15%] rounded-full bg-white/5 blur-[2px]"
        aria-hidden="true"
      />

      {/* 呼吸光环（仅 animated） */}
      {animated && (
        <div
          className={cn(
            'absolute inset-0 rounded-full opacity-40',
            'animate-pulse'
          )}
          style={{ animationDuration: '3s' }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
        </div>
      )}
    </div>
  );
}

export default AssistantAvatar;
