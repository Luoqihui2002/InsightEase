import { useState, useRef, useEffect } from 'react';
import {
  Settings2,
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
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTheme, type ThemeType } from '@/hooks/useTheme';
import { toast } from 'sonner';
import gsap from 'gsap';

import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { ContentGrid } from '@/components/layout/ContentGrid';

// 语言类型
type Language = 'zh-CN' | 'en-US';

// 设置状态接口
interface AppSettings {
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

// 自动清理选项
const autoDeleteOptions = [
  { value: 'never', label: '永不清理' },
  { value: '30', label: '30天后' },
  { value: '90', label: '90天后' },
  { value: '180', label: '180天后' },
  { value: '365', label: '1年后' },
];

export function Settings() {
  const pageRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  // 从 localStorage 加载设置
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('insightease_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const [hasChanges, setHasChanges] = useState(false);
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
  };

  // 更新设置
  const updateSettings = (path: string, value: unknown) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: Record<string, unknown> = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
      return newSettings as AppSettings;
    });
    setHasChanges(true);
  };

  // 清理本地数据
  const handleClearData = () => {
    localStorage.removeItem('insightease_settings');
    localStorage.removeItem('insightease_local_datasets');
    toast.success('本地数据已清理');
    setClearDataDialog(false);
    window.location.reload();
  };

  return (
    <PageShell ref={pageRef}>
      <PageHeader
        title="系统设置"
        subtitle="管理主题、通知、隐私和账户偏好"
        icon={<Settings2 className="w-8 h-8 text-[var(--neon-cyan)]" />}
        actions={
          hasChanges ? (
            <Button
              onClick={saveSettings}
              className="bg-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/90 text-[var(--bg-primary)]"
            >
              <Save className="w-4 h-4 mr-2" />
              保存更改
            </Button>
          ) : undefined
        }
      />

      {/* 数据存储说明 */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--neon-cyan)]" />
            数据存储说明
          </span>
        }
        className="border-l-4 border-l-[var(--neon-cyan)]"
      >
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-[var(--bg-secondary)]">
            <div className="flex items-start gap-3 mb-4">
              <Info className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-2">统一后端处理架构</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  当前正式版本统一由后端处理数据。浏览器本地处理模式已标记为 legacy，
                  不再作为正式功能提供。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]" />
                处理位置：后端服务器
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]" />
                元数据存储：后端数据库
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]" />
                文件存储：服务器本地磁盘 / OSS
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--neon-orange)]/10 border border-[var(--neon-orange)]/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--neon-orange)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-primary)] mb-1">Legacy 模式说明</p>
                <p>浏览器本地处理（IndexedDB、DuckDB-WASM）相关代码已标记为 legacy，保留但不继续开发。如需私有部署，请联系管理员配置后端为本地磁盘模式。</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <ContentGrid cols={2}>
        {/* 外观设置 */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[var(--neon-cyan)]" />
              外观主题
            </span>
          }
        >
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
        </SectionCard>

        {/* 语言设置 */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--neon-cyan)]" />
              语言设置
            </span>
          }
        >
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
        </SectionCard>
      </ContentGrid>

      {/* 通知设置 */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--neon-cyan)]" />
            通知设置
          </span>
        }
      >
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
              <Switch
                checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                onCheckedChange={(checked) => updateSettings(`notifications.${item.key}`, checked)}
                className="data-[state=checked]:bg-[var(--neon-cyan)]"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 隐私与安全 */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--neon-cyan)]" />
            隐私与安全
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div>
              <p className="text-[var(--text-primary)] font-medium">自动清理数据</p>
              <p className="text-xs text-[var(--text-muted)]">自动删除超过指定天数的历史数据</p>
            </div>
            <Select
              value={settings.privacy.autoDeleteAfterDays == null ? 'never' : String(settings.privacy.autoDeleteAfterDays)}
              onValueChange={(value) => updateSettings('privacy.autoDeleteAfterDays', value === 'never' ? null : parseInt(value))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                <SelectValue placeholder="选择天数" />
              </SelectTrigger>
              <SelectContent>
                {autoDeleteOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div>
              <p className="text-[var(--text-primary)] font-medium">使用数据改进服务</p>
              <p className="text-xs text-[var(--text-muted)]">匿名分享使用数据帮助我们改进产品</p>
            </div>
            <Switch
              checked={settings.privacy.shareAnalytics}
              onCheckedChange={(checked) => updateSettings('privacy.shareAnalytics', checked)}
              className="data-[state=checked]:bg-[var(--neon-cyan)]"
            />
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
        </div>
      </SectionCard>

      {/* 关于与帮助 */}
      <SectionCard title="关于">
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
      </SectionCard>

      {/* 清理数据确认对话框 */}
      <AlertDialog open={clearDataDialog} onOpenChange={setClearDataDialog}>
        <AlertDialogContent className="border-[var(--neon-pink)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-[var(--text-primary)]">
              <div className="w-10 h-10 rounded-full bg-[var(--neon-pink)]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--neon-pink)]" />
              </div>
              确认清理数据
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-secondary)]">
              此操作将删除所有本地存储的设置和数据，包括本地模式下的数据集。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearDataDialog(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              className="bg-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/90 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              确认清理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
