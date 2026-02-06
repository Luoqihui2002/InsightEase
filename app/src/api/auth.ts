import { request } from '@/lib/request';
import type { ApiResponse } from '@/types/api';

export interface User {
  id: string;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}

export const authApi = {
  // 登录
  login: (data: LoginForm) =>
    request.post<ApiResponse<TokenData>>('/auth/login/json', data),

  // 注册
  register: (data: RegisterForm) =>
    request.post<ApiResponse<User>>('/auth/register', data),

  // 获取当前用户信息
  getMe: () =>
    request.get<ApiResponse<User>>('/auth/me'),

  // 更新用户信息
  updateMe: (data: Partial<User>) =>
    request.put<ApiResponse<User>>('/auth/me', data),

  // 修改密码
  changePassword: (data: { old_password: string; new_password: string }) =>
    request.post<ApiResponse<null>>('/auth/me/password', data),

  // 检查用户名是否可用
  checkUsername: (username: string) =>
    request.get<ApiResponse<{ available: boolean }>>('/auth/check-username', {
      params: { username }
    }),

  // 检查邮箱是否可用
  checkEmail: (email: string) =>
    request.get<ApiResponse<{ available: boolean }>>('/auth/check-email', {
      params: { email }
    }),
};

// 本地存储操作
export const authStorage = {
  setToken: (token: string) => localStorage.setItem('access_token', token),
  getToken: () => localStorage.getItem('access_token'),
  removeToken: () => localStorage.removeItem('access_token'),
  
  setUser: (user: User) => localStorage.setItem('user_info', JSON.stringify(user)),
  getUser: (): User | null => {
    const user = localStorage.getItem('user_info');
    return user ? JSON.parse(user) : null;
  },
  removeUser: () => localStorage.removeItem('user_info'),
  
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
  }
};
