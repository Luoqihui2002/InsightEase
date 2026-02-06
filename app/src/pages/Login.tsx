import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Zap, 
  Shield, 
  Sparkles,
  ArrowRight,
  Lock,
  User
} from 'lucide-react';
import gsap from 'gsap';

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  
  const MAX_PASSWORD_LENGTH = 50;

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Brand section animation
      gsap.fromTo(
        brandRef.current,
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }
      );
      
      // Form section animation
      gsap.fromTo(
        formRef.current,
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 }
      );
    });

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      return;
    }
    
    const result = await login(formData);
    if (result.success) {
      navigate('/app/dashboard');
    }
  };

  // Generate particles for background
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 4,
    size: 2 + Math.random() * 4,
  }));

  return (
    <div 
      ref={containerRef}
      className="min-h-screen w-full flex relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(0,245,255,0.3) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            animation: 'float 20s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(184,41,247,0.3) 0%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            animation: 'float 25s ease-in-out infinite reverse',
          }}
        />
        
        {/* Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.id % 2 === 0 ? '#00f5ff' : '#b829f7',
              opacity: 0.4,
              animation: `pulse ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,245,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,245,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Left Side - Brand Section */}
      <div 
        ref={brandRef}
        className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16"
      >
        <div className="max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(184,41,247,0.2))',
                  border: '1px solid rgba(0,245,255,0.3)',
                  boxShadow: '0 0 20px rgba(0,245,255,0.3)',
                }}
              >
                <Zap className="w-6 h-6 text-[#00f5ff]" />
              </div>
              <div 
                className="absolute inset-0 rounded-xl animate-pulse"
                style={{
                  boxShadow: '0 0 30px rgba(0,245,255,0.5)',
                }}
              />
            </div>
            <span 
              className="text-3xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #00f5ff, #b829f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              InsightEase
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            让数据
            <span 
              className="relative inline-block mx-2"
              style={{
                color: '#00f5ff',
                textShadow: '0 0 20px rgba(0,245,255,0.5)',
              }}
            >
              自己说话
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M0 4C50 0 150 8 200 4" stroke="#00f5ff" strokeWidth="2" opacity="0.5"/>
              </svg>
            </span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed">
            AI 驱动的电商数据分析引擎，帮助您从海量数据中快速发现业务洞察
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'AI 智能解读，自动发现业务洞察' },
              { icon: Shield, text: '企业级数据安全保护' },
              { icon: Zap, text: '秒级分析，实时可视化' },
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 text-[var(--text-secondary)]"
                style={{
                  animation: `fadeInLeft 0.5s ease-out ${0.5 + idx * 0.1}s both`,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(0,245,255,0.1)',
                    border: '1px solid rgba(0,245,255,0.2)',
                  }}
                >
                  <feature.icon className="w-4 h-4 text-[#00f5ff]" />
                </div>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div 
        ref={formRef}
        className="w-full lg:w-1/2 flex items-center justify-center relative z-10 p-6"
      >
        <div 
          className="w-full max-w-md relative"
          style={{
            perspective: '1000px',
          }}
        >
          {/* Card Glow Effect */}
          <div 
            className="absolute -inset-1 rounded-2xl opacity-50 blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,245,255,0.3), rgba(184,41,247,0.3))',
            }}
          />
          
          {/* Form Card */}
          <div 
            className="relative rounded-2xl p-8"
            style={{
              background: 'rgba(21, 27, 61, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,245,255,0.2)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <Zap className="w-6 h-6 text-[#00f5ff]" />
              <span 
                className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #00f5ff, #b829f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                InsightEase
              </span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">欢迎回来</h2>
              <p className="text-[var(--text-secondary)] text-sm">
                登录您的账号继续数据分析之旅
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                  用户名或邮箱
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#00f5ff] transition-colors" />
                  <Input
                    type="text"
                    placeholder="请输入用户名或邮箱"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="pl-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(0,245,255,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff] transition-all rounded-xl"
                    required
                  />
                  <div 
                    className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      boxShadow: '0 0 20px rgba(0,245,255,0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    密码
                  </label>
                  <Link 
                    to="#" 
                    className="text-xs text-[#00f5ff] hover:text-[#00f5ff]/80 transition-colors"
                  >
                    忘记密码？
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#00f5ff] transition-colors" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={formData.password}
                    maxLength={MAX_PASSWORD_LENGTH}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-12 pr-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(0,245,255,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff] transition-all rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 mt-2 relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #00f5ff, #b829f7)',
                  border: 'none',
                }}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2 font-semibold">
                    登录
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[rgba(0,245,255,0.2)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 text-[var(--text-muted)]" style={{ background: 'rgba(21, 27, 61, 1)' }}>
                  还没有账号？
                </span>
              </div>
            </div>

            {/* Register Link */}
            <Link to="/register">
              <Button
                variant="outline"
                className="w-full h-12 border-[rgba(0,245,255,0.3)] text-[#00f5ff] hover:bg-[rgba(0,245,255,0.1)] hover:border-[#00f5ff] transition-all rounded-xl"
              >
                创建新账号
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
