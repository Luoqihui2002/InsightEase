import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BarChart3, Calculator, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import gsap from 'gsap';

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 标题动画
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: 50, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out', delay: 0.3 }
      );

      // 副标题动画
      gsap.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.6 }
      );

      // CTA 按钮动画
      gsap.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.9 }
      );

      // 卡片动画
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power3.out',
            delay: 1.2,
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const handleCtaClick = () => {
    // 故障艺术效果
    setIsGlitching(true);
    setTimeout(() => {
      setIsGlitching(false);
      onEnterApp();
      navigate('/app/dashboard');
    }, 500);
  };

  const features = [
    {
      icon: Brain,
      title: 'AI智能解读',
      description: '基于Kimi大模型的深度数据分析，自动发现业务洞察',
    },
    {
      icon: BarChart3,
      title: '赛博可视化',
      description: '霓虹风格的交互式图表，让数据呈现更具科技感',
    },
    {
      icon: Calculator,
      title: '多种统计学分析工具',
      description: 'RFM分群、转化漏斗、时序预测、归因分析等丰富工具',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* 背景渐变 */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 245, 255, 0.1) 0%, transparent 70%)',
        }}
      />

      {/* 主要内容 */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Logo/标题 */}
        <h1
          ref={titleRef}
          className={`text-6xl md:text-8xl font-bold mb-6 gradient-text pb-2 ${isGlitching ? 'glitch' : ''}`}
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          InsightEase
        </h1>

        {/* 副标题 */}
        <p
          ref={subtitleRef}
          className="text-xl md:text-2xl text-[var(--text-secondary)] mb-10"
        >
          让数据自己说话 <span className="mx-3 text-[var(--neon-cyan)]">|</span> AI驱动的电商分析引擎
        </p>

        {/* CTA 按钮 */}
        <div ref={ctaRef} className="mb-16">
          <Button
            onClick={handleCtaClick}
            size="lg"
            className="btn-neon px-8 py-6 text-lg font-semibold bg-transparent border-2 border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-[var(--bg-primary)] transition-all duration-300"
          >
            启动工作台
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* 特性卡片 */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass card-hover rounded-xl p-6 text-center group cursor-pointer"
            >
              <div className="mb-4 flex justify-center">
                <div className="w-14 h-14 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center group-hover:neon-glow transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-[var(--neon-cyan)]" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--neon-cyan)] to-transparent opacity-50" />
      
      {/* 版本号 */}
      <div className="absolute bottom-4 right-4 text-xs text-[var(--text-muted)] mono">
        v2.0.0
      </div>
    </div>
  );
}
