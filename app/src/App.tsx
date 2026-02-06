import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ParticleBackground } from '@/components/ParticleBackground';
import { DigitalRain } from '@/components/DigitalRain';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LandingPage } from '@/sections/LandingPage';
import { AppLayout } from '@/components/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Datasets } from '@/pages/Datasets';
import { History } from '@/pages/History';
import { Upload } from '@/pages/Upload';
import { SmartAnalysis } from '@/pages/SmartAnalysis';
import { SmartProcess } from '@/pages/SmartProcess';
import { Semantic } from '@/pages/Semantic';
import { Statistics } from '@/pages/Statistics';
import { Attribution } from '@/pages/Attribution';
import { Forecast } from '@/pages/Forecast';
import { GoalPlanner } from '@/pages/GoalPlanner';
import { DataWorkshop } from '@/pages/DataWorkshop';
import { Visualization } from '@/pages/Visualization';
import { PathAnalysis } from '@/pages/PathAnalysis';
import { Profile } from '@/pages/Profile';
import { Settings } from '@/pages/Settings';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { useTheme } from '@/hooks/useTheme';
import { authStorage } from '@/api/auth';

// 需要登录的路由守卫
function ProtectedRoute() {
  const token = authStorage.getToken();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
}

// 已登录用户访问登录/注册页的重定向
function GuestRoute() {
  const token = authStorage.getToken();
  
  if (token) {
    return <Navigate to="/app/dashboard" replace />;
  }
  
  return <Outlet />;
}

// 背景组件（只在非登录/注册页面显示）
function BackgroundEffects() {
  const { theme } = useTheme();
  const location = useLocation();
  
  // 登录和注册页面不显示背景动画
  const hideBackground = location.pathname === '/login' || location.pathname === '/register';
  
  if (hideBackground) {
    return null;
  }
  
  return (
    <>
      <ParticleBackground />
      {theme === 'matrix' && <DigitalRain />}
    </>
  );
}

function AppContent() {
  const { theme } = useTheme();

  // 初始化主题
  useEffect(() => {
    document.documentElement.classList.remove('theme-matrix', 'theme-sunset');
    if (theme === 'matrix') {
      document.documentElement.classList.add('theme-matrix');
    } else if (theme === 'sunset') {
      document.documentElement.classList.add('theme-sunset');
    }
  }, [theme]);

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)]">
      {/* 背景效果 - 只在非登录/注册页面显示 */}
      <BackgroundEffects />
      
      <Routes>
        {/* Landing Page */}
        <Route 
          path="/" 
          element={
            <LandingPage onEnterApp={() => {}} />
          } 
        />
        
        {/* 登录/注册 - 已登录用户重定向到首页 */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        
        {/* 需要登录的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="datasets" element={<ErrorBoundary><Datasets /></ErrorBoundary>} />
            <Route path="history" element={<ErrorBoundary><History /></ErrorBoundary>} />
            <Route path="upload" element={<ErrorBoundary><Upload /></ErrorBoundary>} />
            <Route path="smart-analysis" element={<ErrorBoundary><SmartAnalysis /></ErrorBoundary>} />
            <Route path="smart-process" element={<ErrorBoundary><SmartProcess /></ErrorBoundary>} />
            <Route path="semantic" element={<ErrorBoundary><Semantic /></ErrorBoundary>} />
            <Route path="statistics" element={<ErrorBoundary><Statistics /></ErrorBoundary>} />
            <Route path="attribution" element={<ErrorBoundary><Attribution /></ErrorBoundary>} />
            <Route path="forecast" element={<ErrorBoundary><Forecast /></ErrorBoundary>} />
            <Route path="goal-planner" element={<ErrorBoundary><GoalPlanner /></ErrorBoundary>} />
            <Route path="data-workshop" element={<ErrorBoundary><DataWorkshop /></ErrorBoundary>} />
            <Route path="visualization" element={<ErrorBoundary><Visualization /></ErrorBoundary>} />
            <Route path="path" element={<ErrorBoundary><PathAnalysis /></ErrorBoundary>} />
            <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          </Route>
        </Route>
        
        {/* 404 Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Toast 通知 */}
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
