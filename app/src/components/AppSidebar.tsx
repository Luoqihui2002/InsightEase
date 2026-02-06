import { NavLink, useLocation } from 'react-router-dom';
import { 
  Upload, 
  Sparkles, 
  Brain,
  Wand2,
  BarChart3, 
  PieChart,
  Filter, 
  TrendingUp,
  Target,
  Database,
  Route,
  Bot,
  ChevronRight,
  Settings2
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const sidebarItems = [
  { 
    category: '数据管理',
    items: [
      { path: '/app/upload', label: '上传数据', icon: Upload },
    ]
  },
  { 
    category: '智能分析',
    items: [
      { path: '/app/smart-analysis', label: '智能分析向导', icon: Brain },
      { path: '/app/smart-process', label: '数据预处理', icon: Wand2 },
      { path: '/app/semantic', label: '语义分析', icon: Sparkles },
    ]
  },
  { 
    category: '分析工具',
    items: [
      { path: '/app/visualization', label: '可视化分析', icon: PieChart },
      { path: '/app/statistics', label: '统计分析', icon: BarChart3 },
      { path: '/app/attribution', label: '归因分析', icon: Filter },
      { path: '/app/forecast', label: '时序预测', icon: TrendingUp },
      { path: '/app/goal-planner', label: '指标规划', icon: Target },
      { path: '/app/data-workshop', label: '数据工坊', icon: Database },
      { path: '/app/path', label: '路径分析', icon: Route },
    ]
  },
  { 
    category: '系统',
    items: [
      { path: '/app/settings', label: '设置', icon: Settings2 },
    ]
  },
];

interface AppSidebarProps {
  onOpenAIAssistant: () => void;
}

export function AppSidebar({ onOpenAIAssistant }: AppSidebarProps) {
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    sidebarItems.map(item => item.category)
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <aside className="w-64 h-[calc(100vh-4rem)] glass border-r border-[var(--border-subtle)] flex flex-col sticky top-16">
      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto p-4">
        {sidebarItems.map((section) => {
          const isExpanded = expandedCategories.includes(section.category);
          
          return (
            <div key={section.category} className="mb-4">
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(section.category)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text-secondary)] transition-colors"
              >
                {section.category}
                <ChevronRight 
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
              
              {/* 分类项目 */}
              {isExpanded && (
                <div className="mt-1 space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300
                          ${isActive 
                            ? 'bg-[var(--bg-tertiary)] text-[var(--neon-cyan)] border-l-2 border-[var(--neon-cyan)]' 
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border-l-2 border-transparent'
                          }
                        `}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--neon-cyan)]' : ''}`} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* AI 助手入口 */}
      <div className="p-4 border-t border-[var(--border-subtle)]">
        <Button
          onClick={onOpenAIAssistant}
          className="w-full btn-neon flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--neon-purple)]/20 to-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:from-[var(--neon-purple)]/30 hover:to-[var(--neon-cyan)]/30 transition-all duration-300"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--neon-green)] rounded-full animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">AI 助手</div>
            <div className="text-xs text-[var(--text-muted)]">点击开始对话</div>
          </div>
        </Button>
      </div>
    </aside>
  );
}
