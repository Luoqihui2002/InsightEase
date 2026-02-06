import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, authStorage, type User, type LoginForm, type RegisterForm } from '@/api/auth';
import { toast } from 'sonner';

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const initialized = useRef(false);

  // 初始化 - 检查本地存储的登录状态
  // 只在应用启动时执行一次，且不在登录/注册页面执行
  useEffect(() => {
    // 避免在登录/注册页面执行验证
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
    if (isAuthPage) {
      setIsLoading(false);
      return;
    }
    
    // 避免重复初始化
    if (initialized.current) return;
    initialized.current = true;
    
    const initAuth = async () => {
      const token = authStorage.getToken();
      const savedUser = authStorage.getUser();
      
      if (token && savedUser) {
        setUser(savedUser);
        setIsAuthenticated(true);
        
        // 验证token是否有效
        try {
          const res: any = await authApi.getMe();
          if (res) {
            setUser(res);
            authStorage.setUser(res);
          }
        } catch {
          // token失效，清除登录状态
          authStorage.clear();
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      
      setIsLoading(false);
    };
    
    initAuth();
  }, [location.pathname]);

  // 登录
  const login = useCallback(async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const res = await authApi.login(data) as any;
      
      if (res?.code === 200 && res?.data) {
        const { access_token } = res.data;
        authStorage.setToken(access_token);
        
        // 获取用户信息
        const userRes: any = await authApi.getMe();
        if (userRes) {
          setUser(userRes);
          authStorage.setUser(userRes);
          setIsAuthenticated(true);
          toast.success('登录成功');
          return { success: true };
        }
      }
      
      throw new Error(res.message || '登录失败');
    } catch (error: any) {
      toast.error(error.message || '登录失败');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 注册
  const register = useCallback(async (data: RegisterForm) => {
    try {
      setIsLoading(true);
      const res = await authApi.register(data) as any;
      
      if (res.code === 201 && res.data) {
        toast.success('注册成功，请登录');
        return { success: true };
      }
      
      throw new Error(res.message || '注册失败');
    } catch (error: any) {
      toast.error(error.message || '注册失败');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    toast.success('已退出登录');
    navigate('/login');
  }, [navigate]);

  // 更新用户信息
  const updateUser = useCallback(async (data: Partial<User>) => {
    try {
      const res = await authApi.updateMe(data) as any;
      if (res) {
        setUser(res);
        authStorage.setUser(res);
        toast.success('更新成功');
        return { success: true };
      }
      throw new Error(res.message || '更新失败');
    } catch (error: any) {
      toast.error(error.message || '更新失败');
      return { success: false, error: error.message };
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };
}
