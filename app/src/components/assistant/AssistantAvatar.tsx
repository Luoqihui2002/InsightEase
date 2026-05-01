/**
 * AssistantAvatar - 球形数据助手头像
 *
 * 视觉方向：圆润、柔和、与 InsightEase 暗色主题浑然一体
 * 统一身份：所有变体共享同一 cyan-aqua-neon 球体核心，仅通过 subtle accent 区分状态
 * 球形 companion，径向渐变球体，简笔双眼表情，柔和呼吸光晕
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

/* ------------------------------------------------------------------
 * 统一品牌调色板 — 所有变体共享此核心，仅 overlay accent 不同
 * ------------------------------------------------------------------ */
const CORE = {
  start: 'rgba(22, 217, 245, 0.62)',   // cyan
  mid: 'rgba(43, 168, 247, 0.48)',     // aqua-blue
  end: 'rgba(37, 99, 235, 0.55)',      // deeper blue
  highlight: 'rgba(190, 255, 255, 0.75)',
  shadow: 'rgba(5, 18, 45, 0.45)',
  glowCyan: 'rgba(0, 229, 255, 0.32)',
  glowAmbient: 'rgba(139, 92, 246, 0.14)',
};

/** 基础球体渐变 — 所有变体相同 */
const baseSphere = `radial-gradient(circle at 36% 24%, ${CORE.start} 0%, ${CORE.mid} 42%, ${CORE.end} 100%)`;

/** 基础光晕 — 所有变体相同 */
const baseGlow = `0 0 20px ${CORE.glowCyan}, 0 0 40px ${CORE.glowAmbient}, 0 4px 12px rgba(0,0,0,0.35)`;

/** 变体仅覆盖 accent（非常 subtle 的装饰层） */
const variantAccent: Record<AssistantAvatarVariant, React.CSSProperties | undefined> = {
  default: undefined,
  dataset: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.60) 0%, rgba(20,184,166,0.46) 42%, rgba(37,99,235,0.55) 100%)` },
  path: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.60) 0%, rgba(43,168,247,0.46) 42%, rgba(59,130,246,0.55) 100%)` },
  forecast: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.60) 0%, rgba(14,165,233,0.46) 42%, rgba(29,78,216,0.55) 100%)` },
  experiment: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.60) 0%, rgba(6,182,212,0.46) 42%, rgba(30,58,138,0.55) 100%)` },
  text: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.58) 0%, rgba(139,92,246,0.42) 42%, rgba(37,99,235,0.55) 100%)` },
  warning: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.58) 0%, rgba(43,168,247,0.44) 42%, rgba(202,138,4,0.50) 100%)` },
  processing: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.72) 0%, rgba(43,168,247,0.58) 40%, rgba(37,99,235,0.62) 100%)` },
  success: { background: `radial-gradient(circle at 36% 24%, rgba(22,217,245,0.60) 0%, rgba(20,184,166,0.48) 42%, rgba(37,99,235,0.55) 100%)` },
};

const variantGlowIntensity: Record<AssistantAvatarVariant, string> = {
  default: baseGlow,
  dataset: baseGlow,
  path: baseGlow,
  forecast: baseGlow,
  experiment: baseGlow,
  text: baseGlow,
  warning: baseGlow,
  processing: `0 0 24px rgba(0,229,255,0.50), 0 0 48px rgba(139,92,246,0.22), 0 4px 12px rgba(0,0,0,0.35)`,
  success: baseGlow,
};

export function AssistantAvatar({
  variant = 'default',
  size = 'md',
  animated = true,
  className,
}: AssistantAvatarProps) {
  const { container, eye, gap } = sizeMap[size];
  const isProcessing = variant === 'processing';

  const sphereStyle: React.CSSProperties = {
    background: variantAccent[variant]?.background ?? baseSphere,
    boxShadow: variantGlowIntensity[variant],
  };

  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center',
        'border border-white/[0.08]',
        container,
        className
      )}
      style={sphereStyle}
    >
      {/* 顶部高光 — 营造球体感 */}
      <div
        className="absolute top-[14%] left-[18%] w-[38%] h-[26%] rounded-full bg-[rgba(190,255,255,0.35)] blur-[3px]"
        aria-hidden="true"
      />

      {/* 眼睛 */}
      <div className={cn('flex items-center justify-center z-10', gap)}>
        <div
          className={cn(
            'rounded-full shadow-sm',
            eye,
            isProcessing
              ? 'bg-[rgba(200,255,255,0.95)] animate-pulse'
              : 'bg-[rgba(255,255,255,0.88)]'
          )}
        />
        <div
          className={cn(
            'rounded-full shadow-sm',
            eye,
            isProcessing
              ? 'bg-[rgba(200,255,255,0.95)] animate-pulse'
              : 'bg-[rgba(255,255,255,0.88)]'
          )}
          style={isProcessing ? { animationDelay: '150ms' } : undefined}
        />
      </div>

      {/* 底部微光 */}
      <div
        className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-[55%] h-[14%] rounded-full bg-white/[0.06] blur-[2px]"
        aria-hidden="true"
      />

      {/* 呼吸光环（仅 animated） */}
      {animated && (
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            isProcessing ? 'opacity-50' : 'opacity-30'
          )}
          style={{ animationDuration: isProcessing ? '1.5s' : '3s' }}
        >
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-pulse',
              'bg-gradient-to-br from-white/[0.08] to-transparent'
            )}
          />
        </div>
      )}
    </div>
  );
}

export default AssistantAvatar;
