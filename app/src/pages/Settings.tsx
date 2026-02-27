import { useState, useRef, useEffect } from 'react';
import {
  Settings2,
  Cloud,
  HardDrive,
  Palette,
  Globe,
  Bell,
  Shield,
  Database,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Moon,
  Sun,
  Monitor,
  Zap,
  ChevronRight,
  Lock,
  Save,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme, type ThemeType } from '@/hooks/useTheme';
import { toast } from 'sonner';
import gsap from 'gsap';
import { localStorageService } from '@/services';

// 存储模式类型
type StorageMode = 'cloud' | 'local';

// 语言类型
type Language = 'zh-CN' | 'en-US';

// 设置状态接口
interface AppSettings {
  storageMode: StorageMode;
  language: Language;
  notifications: {
    analysisComplete: boolean;
    datasetUpload: boolean;
    weeklyReport: boolean;
    systemUpdates: boolean;
  };
  privacy: {
    autoDeleteAfterDays: number | null;
    shareAnalytics: boolean;
  };
}

// 默认设置
const defaultSettings: AppSettings = {
  storageMode: 'cloud',
  language: 'zh-CN',
  notifications: {
    analysisComplete: true,
    datasetUpload: true,
    weeklyReport: false,
    systemUpdates: true,
  },
  privacy: {
    autoDeleteAfterDays: null,
    shareAnalytics: false,
  },
};

// 主题配置
const themes: { id: ThemeType; name: string; desc: string; icon: typeof Moon; gradient: string }[] = [
  { 
    id: 'cyberpunk', 
    name: 'Deep Space', 
    desc: '深邃太空紫',
    icon: Zap,
    gradient: 'from-[var(--neon-cyan)] to-[var(--neon-purple)]'
  },
  { 
    id: 'matrix', 
    name: 'Matrix', 
    desc: '黑客帝国绿',
    icon: Monitor,
    gradient: 'from-green-500 to-emerald-700'
  },
  { 
    id: 'sunset', 
    name: 'Sunset', 
    desc: '暖阳橙黄',
    icon: Sun,
    gradient: 'from-orange-400 to-pink-500'
  },
];

// 语言选项
const languages: { id: Language; name: string; flag: string }[] = [
  { id: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { id: 'en-US', name: 'English', flag: '🇺🇸' },
];

export function Settings() {
  const pageRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  
  // 从 localStorage 加载设置，并同步安全模式状态
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('insightease_settings');
    const parsedSettings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    
    // 同步安全模式状态到 localStorageService
    const isSecurityMode = parsedSettings.storageMode === 'local';
    localStorageService.setSecurityMode(isSecurityMode);
    
    return parsedSettings;
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [showLocalModeAlert, setShowLocalModeAlert] = useState(false);
  const [clearDataDialog, setClearDataDialog] = useState(false);
  
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
  
  // 保存设置到 localStorage
  const saveSettings = () => {
    localStorage.setItem('insightease_settings', JSON.stringify(settings));
    setHasChanges(false);
    toast.success('设置已保存');
    
    // 同步安全模式状态
    const isSecurityMode = settings.storageMode === 'local';
    localStorageService.setSecurityMode(isSecurityMode);
    
    // 如果切换到本地模式，显示提示
    if (settings.storageMode === 'local') {
      toast.info('本地模式已启用，您的数据将不会上传到云端', { duration: 5000 });
    }
  };
  
  // 更新设置
  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
    setHasChanges(true);
  };
  
  // 切换存储模式
  const handleStorageModeChange = (mode: StorageMode) => {
    if (mode === 'local') {
      setShowLocalModeAlert(true);
    }
    updateSettings('storageMode', mode);
    
    // 立即同步安全模式状态（无需等待保存按钮）
    const isSecurityMode = mode === 'local';
    localStorageService.setSecurityMode(isSecurityMode);
    
    // 显示切换提示
    if (mode === 'local') {
      toast.info('已切换到本地存储模式，数据将保存在浏览器中', { duration: 3000 });
    } else {
      toast.info('已切换到云端存储模式，数据将上传到服务器', { duration: 3000 });
    }
  };
  
  // 清理本地数据
  const handleClearData = () => {
    localStorage.removeItem('insightease_settings');
    localStorage.removeItem('insightease_local_datasets');
    toast.success('本地数据已清理');
    setClearDataDialog(false);
    window.location.reload();
  };
  
  // 获取存储模式描述
  const getStorageModeInfo = (mode: StorageMode) => {
    switch (mode) {
      case 'cloud':
        return {
          title: '云端存储',
          desc: '数据上传到服务器，可在多设备同步，适合团队协作',
          features: ['多设备同步', '自动备份', '团队共享', '云端分析'],
          warning: null,
        };
      case 'local':
        return {
          title: '本地存储',
          desc: '数据仅保存在浏览器本地，不上传到任何服务器，适合敏感数据',
          features: ['数据隐私', '离线使用', '零网络传输', '企业合规'],
          warning: '注意：清理浏览器数据将导致数据丢失，请定期导出备份',
        };
    }
  };
  
  const currentModeInfo = getStorageModeInfo(settings.storageMode);
  
  return (
    <div ref={pageRef} className="space-y-6 max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="p-6 rounded-xl glass border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading-1 text-[var(--text-primary)] flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-[var(--neon-cyan)]" />
              系统设置
            </h1>
            <p className="text-body text-[var(--text-secondary)] mt-2">
              自定义您的使用偏好和数据存储方式
            </p>
          </div>
          {hasChanges && (
            <Button
              onClick={saveSettings}
              className="bg-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/90 text-[var(--bg-primary)]"
            >
              <Save className="w-4 h-4 mr-2" />
              保存更改
            </Button>
          )}
        </div>
      </div>
      
      {/* 存储模式设置 - 重点功能 */}
      <Card className="glass border-[var(--border-subtle)] border-l-4 border-l-[var(--neon-cyan)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
            数据存储模式
            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]">
              企业级
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 模式选择 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 云端模式 */}
            <div
              onClick={() => handleStorageModeChange('cloud')}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                settings.storageMode === 'cloud'
                  ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  settings.storageMode === 'cloud' 
                    ? 'bg-[var(--neon-cyan)]/20' 
                    : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <Cloud className={`w-6 h-6 ${
                    settings.storageMode === 'cloud' ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)]'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[var(--text-primary)]">云端存储</h3>
                    {settings.storageMode === 'cloud' && (
                      <CheckCircle2 className="w-4 h-4 text-[var(--neon-cyan)]" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    数据安全存储在云端服务器
                  </p>
                </div>
              </div>
            </div>
            
            {/* 本地模式 */}
            <div
              onClick={() => handleStorageModeChange('local')}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                settings.storageMode === 'local'
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--neon-green)]/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  settings.storageMode === 'local' 
                    ? 'bg-[var(--neon-green)]/20' 
                    : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <HardDrive className={`w-6 h-6 ${
                    settings.storageMode === 'local' ? 'text-[var(--neon-green)]' : 'text-[var(--text-muted)]'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[var(--text-primary)]">本地存储</h3>
                    {settings.storageMode === 'local' && (
                      <CheckCircle2 className="w-4 h-4 text-[var(--neon-green)]" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    数据仅保存在本地浏览器
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 当前模式详情 */}
          <div className="p-5 rounded-xl bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-3 mb-3">
              {settings.storageMode === 'cloud' ? (
                <Cloud className="w-5 h-5 text-[var(--neon-cyan)]" />
              ) : (
                <Lock className="w-5 h-5 text-[var(--neon-green)]" />
              )}
              <h4 className="font-bold text-[var(--text-primary)]">{currentModeInfo.title}</h4>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{currentModeInfo.desc}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {currentModeInfo.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    settings.storageMode === 'cloud' ? 'bg-[var(--neon-cyan)]' : 'bg-[var(--neon-green)]'
                  }`} />
                  {feature}
                </div>
              ))}
            </div>
            
            {currentModeInfo.warning && (
              <div className="mt-4 p-3 rounded-lg bg-[var(--neon-orange)]/10 border border-[var(--neon-orange)]/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--neon-orange)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--neon-orange)]">{currentModeInfo.warning}</p>
              </div>
            )}
          </div>
          
          {/* 本地模式提示 */}
          {settings.storageMode === 'local' && (
            <div className="p-4 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-[var(--neon-green)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-secondary)]">
                  <p className="font-medium text-[var(--text-primary)] mb-1">本地模式说明</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>所有数据仅存储在浏览器 IndexedDB 中</li>
                    <li>不会向服务器发送任何数据内容</li>
                    <li>分析计算在本地 WASM 中完成（部分高级功能受限）</li>
                    <li>建议定期导出数据备份</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 外观设置 */}
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Palette className="w-5 h-5 text-[var(--neon-cyan)]" />
              外观主题
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      theme === t.id
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                        : 'border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.gradient} mx-auto mb-2 flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* 语言设置 */}
        <Card className="glass border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--neon-cyan)]" />
              语言设置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {languages.map((lang) => (
                <div
                  key={lang.id}
                  onClick={() => updateSettings('language', lang.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                    settings.language === lang.id
                      ? 'bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30'
                      : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-[var(--text-primary)]">{lang.name}</span>
                  </div>
                  {settings.language === lang.id && (
                    <CheckCircle2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              * 多语言支持正在完善中，部分界面可能仍显示中文
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* 通知设置 */}
      <Card className="glass border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--neon-cyan)]" />
            通知设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { key: 'analysisComplete', label: '分析完成通知', desc: '当数据分析任务完成时接收通知' },
              { key: 'datasetUpload', label: '数据集上传完成', desc: '当数据集上传和处理完成时通知' },
              { key: 'weeklyReport', label: '周度数据报告', desc: '每周生成数据洞察报告' },
              { key: 'systemUpdates', label: '系统更新', desc: '接收新功能和改进的更新通知' },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
              >
                <div>
                  <p className="text-[var(--text-primary)] font-medium">{item.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                </div>
                <button
                  onClick={() => updateSettings(`notifications.${item.key}`, !settings.notifications[item.key as keyof typeof settings.notifications])}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.notifications[item.key as keyof typeof settings.notifications]
                      ? 'bg-[var(--neon-cyan)]'
                      : 'bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.notifications[item.key as keyof typeof settings.notifications]
                      ? 'left-7'
                      : 'left-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* 隐私与安全 */}
      <Card className="glass border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--neon-cyan)]" />
            隐私与安全
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div>
              <p className="text-[var(--text-primary)] font-medium">自动清理数据</p>
              <p className="text-xs text-[var(--text-muted)]">自动删除超过指定天数的历史数据</p>
            </div>
            <select
              value={settings.privacy.autoDeleteAfterDays || ''}
              onChange={(e) => updateSettings('privacy.autoDeleteAfterDays', e.target.value ? parseInt(e.target.value) : null)}
              className="p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
            >
              <option value="">永不清理</option>
              <option value="30">30天后</option>
              <option value="90">90天后</option>
              <option value="180">180天后</option>
              <option value="365">1年后</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div>
              <p className="text-[var(--text-primary)] font-medium">使用数据改进服务</p>
              <p className="text-xs text-[var(--text-muted)]">匿名分享使用数据帮助我们改进产品</p>
            </div>
            <button
              onClick={() => updateSettings('privacy.shareAnalytics', !settings.privacy.shareAnalytics)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.privacy.shareAnalytics
                  ? 'bg-[var(--neon-cyan)]'
                  : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.privacy.shareAnalytics
                  ? 'left-7'
                  : 'left-1'
              }`} />
            </button>
          </div>
          
          {/* 清理数据按钮 */}
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <Button
              variant="outline"
              onClick={() => setClearDataDialog(true)}
              className="w-full border-[var(--neon-pink)]/50 text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清理所有本地数据
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* 关于与帮助 */}
      <Card className="glass border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--text-primary)]">关于</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
              <span className="text-[var(--text-primary)]">版本信息</span>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span className="text-sm">v2.0.0</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
              <span className="text-[var(--text-primary)]">使用文档</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
              <span className="text-[var(--text-primary)]">隐私政策</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 清理数据确认对话框 */}
      {clearDataDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4 p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--neon-pink)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--neon-pink)]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--neon-pink)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">确认清理数据</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6">
              此操作将删除所有本地存储的设置和数据，包括本地模式下的数据集。此操作不可恢复。
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setClearDataDialog(false)}
                variant="outline"
                className="flex-1 border-[var(--border-subtle)]"
              >
                取消
              </Button>
              <Button
                onClick={handleClearData}
                className="flex-1 bg-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/90 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                确认清理
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* 本地模式切换提示 */}
      {showLocalModeAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4 p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--neon-green)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--neon-green)]/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[var(--neon-green)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">切换到本地模式</h3>
            </div>
            <div className="space-y-3 text-[var(--text-secondary)] text-sm mb-6">
              <p>切换到本地模式后：</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>新上传的数据将只保存在本地浏览器</li>
                <li>已上传到云端的数据仍可在云端访问</li>
                <li>部分需要云端计算的高级功能将不可用</li>
                <li>请确保定期导出重要数据备份</li>
              </ul>
            </div>
            <Button
              onClick={() => setShowLocalModeAlert(false)}
              className="w-full bg-[var(--neon-green)] hover:bg-[var(--neon-green)]/90 text-[var(--bg-primary)]"
            >
              我知道了
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
