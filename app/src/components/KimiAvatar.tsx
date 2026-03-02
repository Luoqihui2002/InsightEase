/**
 * Kimi 风格头像组件 - 可爱斗鸡眼版本
 * 蓝色圆形 + 两个朝中间倾斜的白色椭圆眼睛
 */

import { cn } from '@/lib/utils';

interface KimiAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  mood?: 'idle' | 'thinking' | 'happy' | 'tip';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-9 h-9', eyeW: 'w-2', eyeH: 'h-2.5', gap: 'gap-1' },
  md: { container: 'w-11 h-11', eyeW: 'w-2.5', eyeH: 'h-3', gap: 'gap-1.5' },
  lg: { container: 'w-14 h-14', eyeW: 'w-3', eyeH: 'h-3.5', gap: 'gap-2' },
};

export function KimiAvatar({ size = 'md', mood = 'idle', className }: KimiAvatarProps) {
  const { container, eyeW, eyeH, gap } = sizeMap[size];
  
  // 根据情绪调整眼睛样式
  const getEyeStyles = () => {
    switch (mood) {
      case 'thinking':
        return 'scale-y-75'; // 思考时稍微眯眼
      case 'happy':
        return 'scale-y-50 scale-x-110'; // 开心时笑眼
      case 'tip':
        return 'scale-y-90'; // 提示时眨眼
      default:
        return 'scale-y-100'; // 正常
    }
  };

  const eyeScale = getEyeStyles();

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center",
        "bg-gradient-to-br from-[#60A5FA] via-[#3B82F6] to-[#2563EB]",
        "shadow-lg shadow-blue-500/40",
        "transition-all duration-300",
        container,
        className
      )}
    >
      {/* 眼睛容器 */}
      <div className={cn("flex items-center justify-center", gap)}>
        {/* 左眼 - 朝右倾斜（内八） */}
        <div
          className={cn(
            "bg-white rounded-full transition-all duration-300",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            eyeW,
            eyeH,
            eyeScale,
            "transform rotate-[25deg]"
          )}
        />
        {/* 右眼 - 朝左倾斜（内八） */}
        <div
          className={cn(
            "bg-white rounded-full transition-all duration-300",
            "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
            eyeW,
            eyeH,
            eyeScale,
            "transform -rotate-[25deg]"
          )}
        />
      </div>
      
      {/* 思考时的动画效果 - 头顶气泡 */}
      {mood === 'thinking' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-ping" />
          <div className="w-1 h-1 bg-white/40 rounded-full mt-0.5" />
        </div>
      )}

      {/* 开心时的效果 - 脸颊红晕 */}
      {mood === 'happy' && (
        <>
          <div className="absolute top-1/2 -translate-y-1/2 left-1 w-2 h-1 bg-pink-400/30 rounded-full blur-[2px]" />
          <div className="absolute top-1/2 -translate-y-1/2 right-1 w-2 h-1 bg-pink-400/30 rounded-full blur-[2px]" />
        </>
      )}

      {/* 提示时的效果 - 小灯泡 */}
      {mood === 'tip' && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse shadow-lg">
          <span className="text-[10px] text-yellow-700 font-bold">!</span>
        </div>
      )}

      {/* 外圈光晕效果 - 呼吸感 */}
      <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse" style={{ animationDuration: '3s' }} />
    </div>
  );
}

export default KimiAvatar;
