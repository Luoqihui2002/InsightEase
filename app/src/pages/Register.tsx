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
  User, 
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import gsap from 'gsap';

export function Register() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  
  const MAX_PASSWORD_LENGTH = 50;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        brandRef.current,
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }
      );
      
      gsap.fromTo(
        formRef.current,
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 }
      );
    });

    return () => ctx.revert();
  }, []);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    
    if (formData.password.length > MAX_PASSWORD_LENGTH) {
      newErrors.password = `密码不能超过${MAX_PASSWORD_LENGTH}个字符`;
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep2()) {
      return;
    }
    
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    
    if (result.success) {
      navigate('/login');
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string): { strength: number; text: string; color: string } => {
    if (!password) return { strength: 0, text: '', color: '' };
    
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    const levels = [
      { text: '太弱', color: '#ff006e' },
      { text: '较弱', color: '#ff6b35' },
      { text: '一般', color: '#ffd700' },
      { text: '较强', color: '#00f5ff' },
      { text: '很强', color: '#00ff9f' },
    ];
    
    const level = Math.min(score, 4);
    return { strength: score, ...levels[level] };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Generate particles
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
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(184,41,247,0.3) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            animation: 'float 20s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(0,245,255,0.3) 0%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            animation: 'float 25s ease-in-out infinite reverse',
          }}
        />
        
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.id % 2 === 0 ? '#b829f7' : '#00f5ff',
              opacity: 0.4,
              animation: `pulse ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
        
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(184,41,247,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(184,41,247,0.5) 1px, transparent 1px)
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
                  background: 'linear-gradient(135deg, rgba(184,41,247,0.2), rgba(0,245,255,0.2))',
                  border: '1px solid rgba(184,41,247,0.3)',
                  boxShadow: '0 0 20px rgba(184,41,247,0.3)',
                }}
              >
                <Zap className="w-6 h-6 text-[#b829f7]" />
              </div>
              <div 
                className="absolute inset-0 rounded-xl animate-pulse"
                style={{
                  boxShadow: '0 0 30px rgba(184,41,247,0.5)',
                }}
              />
            </div>
            <span 
              className="text-3xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #b829f7, #00f5ff)',
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
            开始您的
            <span 
              className="relative inline-block mx-2"
              style={{
                color: '#b829f7',
                textShadow: '0 0 20px rgba(184,41,247,0.5)',
              }}
            >
              数据之旅
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M0 4C50 0 150 8 200 4" stroke="#b829f7" strokeWidth="2" opacity="0.5"/>
              </svg>
            </span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed">
            加入数千名数据分析师的行列，使用 AI 驱动的工具发现隐藏在海量数据中的商业价值
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { value: '10K+', label: '活跃用户' },
              { value: '1M+', label: '分析任务' },
              { value: '99.9%', label: '服务可用性' },
            ].map((stat, idx) => (
              <div 
                key={idx}
                className="text-center"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${0.5 + idx * 0.1}s both`,
                }}
              >
                <div 
                  className="text-2xl font-bold mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #00f5ff, #b829f7)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
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
        <div className="w-full max-w-md relative">
          {/* Card Glow */}
          <div 
            className="absolute -inset-1 rounded-2xl opacity-50 blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(184,41,247,0.3), rgba(0,245,255,0.3))',
            }}
          />
          
          {/* Form Card */}
          <div 
            className="relative rounded-2xl p-8"
            style={{
              background: 'rgba(21, 27, 61, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(184,41,247,0.2)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <Zap className="w-6 h-6 text-[#b829f7]" />
              <span 
                className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #b829f7, #00f5ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                InsightEase
              </span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">创建账号</h2>
              <p className="text-[var(--text-secondary)] text-sm">
                {step === 1 ? '第一步：基本信息' : '第二步：设置密码'}
              </p>
              
              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: step >= 1 ? 'linear-gradient(135deg, #00f5ff, #b829f7)' : 'rgba(255,255,255,0.1)',
                    color: step >= 1 ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <div 
                  className="w-12 h-0.5 transition-all"
                  style={{
                    background: step >= 2 ? 'linear-gradient(90deg, #00f5ff, #b829f7)' : 'rgba(255,255,255,0.1)',
                  }}
                />
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: step >= 2 ? 'linear-gradient(135deg, #00f5ff, #b829f7)' : 'rgba(255,255,255,0.1)',
                    color: step >= 2 ? 'white' : 'var(--text-muted)',
                  }}
                >
                  2
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit} className="space-y-5">
              {step === 1 ? (
                <>
                  {/* Username */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                      用户名
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#00f5ff] transition-colors" />
                      <Input
                        type="text"
                        placeholder="至少3个字符"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="pl-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(0,245,255,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff] transition-all rounded-xl"
                        required
                      />
                    </div>
                    {errors.username && (
                      <p className="text-xs text-[#ff006e] ml-1">{errors.username}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                      邮箱
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#00f5ff] transition-colors" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(0,245,255,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#00f5ff] focus:ring-1 focus:ring-[#00f5ff] transition-all rounded-xl"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-[#ff006e] ml-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Nickname (Optional) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                      昵称 <span className="text-[var(--text-muted)]">（可选）</span>
                    </label>
                    <div className="relative group">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#b829f7] transition-colors" />
                      <Input
                        type="text"
                        placeholder="怎么称呼你？"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        className="pl-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(184,41,247,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#b829f7] focus:ring-1 focus:ring-[#b829f7] transition-all rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Next Button */}
                  <Button
                    type="submit"
                    className="w-full h-12 mt-2 relative overflow-hidden group"
                    style={{
                      background: 'linear-gradient(135deg, #00f5ff, #b829f7)',
                      border: 'none',
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                    <span className="flex items-center gap-2 font-semibold">
                      下一步
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </>
              ) : (
                <>
                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                      密码
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#b829f7] transition-colors" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="6-50个字符"
                        value={formData.password}
                        maxLength={MAX_PASSWORD_LENGTH}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pl-12 pr-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(184,41,247,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#b829f7] focus:ring-1 focus:ring-[#b829f7] transition-all rounded-xl"
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
                    
                    {/* Password Strength */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden">
                            <div 
                              className="h-full transition-all duration-300"
                              style={{
                                width: `${(passwordStrength.strength / 5) * 100}%`,
                                background: passwordStrength.color,
                              }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: passwordStrength.color }}>
                            {passwordStrength.text}
                          </span>
                        </div>
                      </div>
                    )}
                    {errors.password && (
                      <p className="text-xs text-[#ff006e] ml-1">{errors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)] ml-1">
                      确认密码
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[#b829f7] transition-colors" />
                      <Input
                        type="password"
                        placeholder="再次输入密码"
                        value={formData.confirmPassword}
                        maxLength={MAX_PASSWORD_LENGTH}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="pl-12 h-12 bg-[rgba(10,14,39,0.6)] border-[rgba(184,41,247,0.2)] text-white placeholder:text-[var(--text-muted)] focus:border-[#b829f7] focus:ring-1 focus:ring-[#b829f7] transition-all rounded-xl"
                        required
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-[#ff006e] ml-1">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-12 border-[rgba(255,255,255,0.2)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.05)] transition-all rounded-xl"
                    >
                      返回
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 relative overflow-hidden group"
                      style={{
                        background: 'linear-gradient(135deg, #b829f7, #00f5ff)',
                        border: 'none',
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2 font-semibold">
                          创建账号
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[rgba(184,41,247,0.2)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 text-[var(--text-muted)]" style={{ background: 'rgba(21, 27, 61, 1)' }}>
                  已有账号？
                </span>
              </div>
            </div>

            {/* Login Link */}
            <Link to="/login">
              <Button
                variant="outline"
                className="w-full h-12 border-[rgba(184,41,247,0.3)] text-[#b829f7] hover:bg-[rgba(184,41,247,0.1)] hover:border-[#b829f7] transition-all rounded-xl"
              >
                直接登录
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
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
