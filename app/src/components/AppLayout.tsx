import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { AIWorkspace } from '@/pages/AIWorkspace';
import { AICompanion } from './AICompanion';

export function AppLayout() {
  const navigate = useNavigate();
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // 监听 AI Companion 的动作事件
  useEffect(() => {
    const handleCompanionAction = (e: CustomEvent) => {
      if (e.detail?.type === 'open-chat') {
        setIsAIAssistantOpen(true);
      }
    };

    window.addEventListener('companion-action', handleCompanionAction as EventListener);
    return () => window.removeEventListener('companion-action', handleCompanionAction as EventListener);
  }, []);

  // 监听 AI Companion 的导航事件（替代 window.location.href 整页刷新）
  useEffect(() => {
    const handleCompanionNavigate = (e: CustomEvent) => {
      const path = e.detail?.path;
      if (path && typeof path === 'string') {
        navigate(path);
      }
    };

    window.addEventListener('companion-navigate', handleCompanionNavigate as EventListener);
    return () => window.removeEventListener('companion-navigate', handleCompanionNavigate as EventListener);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 顶部导航 */}
      <AppHeader />
      
      {/* 主内容区 */}
      <div className="flex">
        {/* 侧边栏 */}
        <AppSidebar onOpenAIAssistant={() => setIsAIAssistantOpen(true)} />
        
        {/* 内容区域 */}
        <main className="flex-1 p-6 min-h-[calc(100vh-4rem)] relative z-10">
          <Outlet />
        </main>
      </div>
      
      {/* AI 工作台 - 全屏智能分析助手 */}
      <AIWorkspace 
        isOpen={isAIAssistantOpen} 
        onClose={() => setIsAIAssistantOpen(false)} 
      />
      
      {/* AI Companion - 主动式引导助手（工作台打开时隐藏） */}
      {!isAIAssistantOpen && <AICompanion />}
    </div>
  );
}
