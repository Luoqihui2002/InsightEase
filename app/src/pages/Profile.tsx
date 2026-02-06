import { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  Lock,
  CheckCircle2,
  X,
  Database,
  BarChart3,
  Clock,
  Upload,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth';
import { analysisApi } from '@/api/analysis';
import { datasetApi } from '@/api/datasets';
import { toast } from 'sonner';
import gsap from 'gsap';
import type { Analysis, Dataset } from '@/types/api';

// 头像颜色选项
const AVATAR_COLORS = [
  { bg: 'from-[var(--neon-cyan)] to-[var(--neon-purple)]', name: '赛博紫' },
  { bg: 'from-[var(--neon-pink)] to-[var(--neon-orange)]', name: '霓虹粉' },
  { bg: 'from-emerald-400 to-cyan-500', name: '翡翠绿' },
  { bg: 'from-amber-400 to-orange-500', name: '琥珀金' },
  { bg: 'from-violet-400 to-purple-600', name: '紫罗兰' },
  { bg: 'from-rose-400 to-red-600', name: '玫瑰红' },
];

export function Profile() {
  const { user, updateUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  
  // 统计数据
  const [stats, setStats] = useState({
    datasets: 0,
    analyses: 0,
    completedAnalyses: 0,
    storageUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    avatar: '',
  });
  
  // 密码表单
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const [datasetsRes, analysesRes] = await Promise.all([
          datasetApi.list(1, 1000),
          analysisApi.list(1, 1000),
        ]);
        
        const datasets = (datasetsRes as any)?.items || [];
        const analyses = (analysesRes as any)?.items || [];
        
        const totalSize = datasets.reduce((acc: number, d: Dataset) => acc + (d.file_size || 0), 0);
        
        setStats({
          datasets: datasets.length,
          analyses: analyses.length,
          completedAnalyses: analyses.filter((a: Analysis) => a.status === 'completed').length,
          storageUsed: totalSize,
        });
      } catch (err) {
        console.error('加载统计数据失败:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
  }, []);
  
  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        email: user.email || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);
  
  // 页面入场动画
  useEffect(() => {
    if (pageRef.current) {
      gsap.fromTo(
        pageRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
      );
    }
  }, []);
  
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // 获取用户首字母
  const getUserInitials = () => {
    if (formData.nickname) return formData.nickname.charAt(0).toUpperCase();
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return 'U';
  };
  
  // 保存个人信息
  const handleSaveProfile = async () => {
    if (!formData.email?.includes('@')) {
      toast.error('请输入有效的邮箱地址');
      return;
    }
    
    try {
      setSaving(true);
      const result = await updateUser({
        nickname: formData.nickname,
        email: formData.email,
        avatar: formData.avatar,
      });
      
      if (result.success) {
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };
  
  // 修改密码
  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码至少需要6个字符');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    
    try {
      setSaving(true);
      await authApi.changePassword({
        old_password: passwordForm.oldPassword,
        new_password: passwordForm.newPassword,
      });
      toast.success('密码修改成功');
      setIsChangingPassword(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || '密码修改失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 选择头像颜色
  const selectAvatarColor = (colorIndex: number) => {
    setFormData(prev => ({ ...prev, avatar: colorIndex.toString() }));
  };
  
  // 获取当前头像样式
  const getAvatarStyle = () => {
    const colorIndex = parseInt(formData.avatar || '0') % AVATAR_COLORS.length;
    return AVATAR_COLORS[colorIndex].bg;
  };
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--neon-cyan)]" />
      </div>
    );
  }
  
  return (
    <div ref={pageRef} className="space-y-6 max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="p-6 rounded-xl glass border border-[var(--border-subtle)]">
        <h1 className="text-heading-1 text-[var(--text-primary)] flex items-center gap-3">
          <User className="w-8 h-8 text-[var(--neon-cyan)]" />
          个人中心
        </h1>
        <p className="text-body text-[var(--text-secondary)] mt-2">
          管理您的个人信息和账户设置
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：个人信息卡片 */}
        <div className="space-y-6">
          {/* 头像卡片 */}
          <Card className="glass border-[var(--border-subtle)]">
            <CardContent className="p-6 text-center">
              <div className="relative inline-block">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarStyle()} flex items-center justify-center text-white text-3xl font-bold mx-auto shadow-lg`}>
                  {getUserInitials()}
                </div>
                {isEditing && (
                  <div className="absolute -bottom-2 -right-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--neon-cyan)] flex items-center justify-center">
                      <Edit3 className="w-4 h-4 text-[var(--bg-primary)]" />
                    </div>
                  </div>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-[var(--text-primary)] mt-4">
                {user.nickname || user.username}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">@{user.username}</p>
              
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--neon-green)]/20 text-[var(--neon-green)] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  已激活
                </span>
              </div>
              
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="w-full mt-6 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  编辑资料
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* 账户信息 */}
          <Card className="glass border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--neon-cyan)]" />
                账户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <Calendar className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">注册时间</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {new Date(user.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <Clock className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">最后登录</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleString('zh-CN')
                      : '暂无记录'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 右侧：详细信息和统计 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass border-[var(--border-subtle)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {loading ? '-' : stats.datasets}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">数据集</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass border-[var(--border-subtle)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--neon-purple)]/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-[var(--neon-purple)]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {loading ? '-' : stats.analyses}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">分析任务</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass border-[var(--border-subtle)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--neon-green)]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {loading ? '-' : stats.completedAnalyses}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">已完成</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass border-[var(--border-subtle)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--neon-pink)]/20 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-[var(--neon-pink)]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {loading ? '-' : formatFileSize(stats.storageUsed)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">存储使用</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* 编辑模式：个人信息表单 */}
          {isEditing ? (
            <Card className="glass border-[var(--border-subtle)]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[var(--neon-cyan)]" />
                  编辑资料
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 头像颜色选择 */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] font-medium mb-3 block">
                    选择头像颜色
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {AVATAR_COLORS.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => selectAvatarColor(index)}
                        className={`w-12 h-12 rounded-full bg-gradient-to-br ${color.bg} transition-all ${
                          formData.avatar === index.toString()
                            ? 'ring-2 ring-[var(--neon-cyan)] ring-offset-2 ring-offset-[var(--bg-primary)] scale-110'
                            : 'hover:scale-105'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                
                {/* 昵称 */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                    昵称
                  </label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="请输入昵称"
                    className="w-full p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
                  />
                </div>
                
                {/* 邮箱 */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                    邮箱
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="请输入邮箱"
                      className="w-full p-3 pl-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                
                {/* 用户名（只读） */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                    用户名
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={user.username}
                      disabled
                      className="w-full p-3 pl-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">用户名不可修改</p>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="flex-1 border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    disabled={saving}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSaveProfile}
                    className="flex-1 bg-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/90 text-[var(--bg-primary)]"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存修改'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* 查看模式：个人信息展示 */
            <Card className="glass border-[var(--border-subtle)]">
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <User className="w-5 h-5 text-[var(--neon-cyan)]" />
                  个人信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">昵称</p>
                    <p className="text-lg text-[var(--text-primary)] font-medium">
                      {user.nickname || '未设置'}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">邮箱</p>
                    <p className="text-lg text-[var(--text-primary)] font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[var(--neon-cyan)]" />
                      {user.email}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">用户名</p>
                    <p className="text-lg text-[var(--text-primary)] font-medium">
                      @{user.username}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">用户ID</p>
                    <p className="text-lg text-[var(--text-primary)] font-medium font-mono text-sm">
                      {user.id}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 安全设置 */}
          <Card className="glass border-[var(--border-subtle)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
                <Lock className="w-5 h-5 text-[var(--neon-cyan)]" />
                安全设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isChangingPassword ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                      当前密码
                    </label>
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                      placeholder="请输入当前密码"
                      className="w-full p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                      新密码
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="至少6个字符"
                      className="w-full p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium mb-2 block">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="再次输入新密码"
                      className="w-full p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setIsChangingPassword(false)}
                      variant="outline"
                      className="flex-1 border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      disabled={saving}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleChangePassword}
                      className="flex-1 bg-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/90 text-[var(--bg-primary)]"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          修改中...
                        </>
                      ) : (
                        '确认修改'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)]">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">修改密码</p>
                    <p className="text-sm text-[var(--text-muted)]">定期更换密码以保护账户安全</p>
                  </div>
                  <Button
                    onClick={() => setIsChangingPassword(true)}
                    variant="outline"
                    className="border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    修改
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
