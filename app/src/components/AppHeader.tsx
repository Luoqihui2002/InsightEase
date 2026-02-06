import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  History, 
  Settings, 
  Moon, 
  Sun, 
  Monitor,
  Zap,
  User,
  LogOut
} from 'lucide-react';
import { useTheme, type ThemeType } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/datasets', label: 'Datasets', icon: Database },
  { path: '/app/history', label: 'History', icon: History },
];

const themeIcons: Record<ThemeType, typeof Moon> = {
  cyberpunk: Zap,
  matrix: Monitor,
  sunset: Sun,
};

const themeLabels: Record<ThemeType, string> = {
  cyberpunk: 'Deep Space',
  matrix: 'Matrix',
  sunset: 'Sunset',
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const ThemeIcon = themeIcons[theme];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 获取用户头像显示文字
  const getUserInitials = () => {
    if (user?.nickname) {
      return user.nickname.charAt(0).toUpperCase();
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="h-16 glass border-b border-[var(--border-subtle)] flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] flex items-center justify-center pulse-neon">
          <Zap className="w-5 h-5 text-[var(--bg-primary)]" />
        </div>
        <span className="text-xl font-bold gradient-text hidden sm:block" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          InsightEase
        </span>
      </div>

      {/* 导航链接 */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                ${isActive 
                  ? 'bg-[var(--bg-tertiary)] text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-3">
        {/* 主题切换 */}
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative w-10 h-10 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] transition-all"
            >
              <ThemeIcon className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-40 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
          >
            {(Object.keys(themeLabels) as ThemeType[]).map((t) => {
              const Icon = themeIcons[t];
              return (
                <DropdownMenuItem
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`
                    flex items-center gap-2 cursor-pointer
                    ${theme === t ? 'text-[var(--neon-cyan)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-secondary)]'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {themeLabels[t]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 设置按钮 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/settings')}
          className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] transition-all"
          title="系统设置"
        >
          <Settings className="w-5 h-5" />
        </Button>

        {/* 用户菜单 */}
        <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative w-10 h-10 rounded-full p-0 border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)] transition-all"
            >
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white text-sm font-medium">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
          >
            <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {user?.nickname || user?.username}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {user?.email}
              </p>
            </div>
            
            <DropdownMenuItem
              onClick={() => navigate('/app/profile')}
              className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <User className="w-4 h-4" />
              个人中心
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
            
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
