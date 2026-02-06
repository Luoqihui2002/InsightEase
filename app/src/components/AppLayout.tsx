import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { AIAssistant } from './AIAssistant';

export function AppLayout() {
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

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
      
      {/* AI 助手侧边栏 */}
      <AIAssistant 
        isOpen={isAIAssistantOpen} 
        onClose={() => setIsAIAssistantOpen(false)} 
      />
      
      {/* 遮罩层 */}
      {isAIAssistantOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsAIAssistantOpen(false)}
        />
      )}
    </div>
  );
}
