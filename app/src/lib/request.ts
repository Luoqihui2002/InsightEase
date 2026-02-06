import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const request = axios.create({
  baseURL,
  timeout: 10000, // 10秒默认超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 创建短超时版本用于列表查询
export const quickRequest = axios.create({
  baseURL,
  timeout: 5000, // 5秒超时用于快速查询
  headers: {
    'Content-Type': 'application/json',
  },
});

// 复制拦截器配置到 quickRequest
quickRequest.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

quickRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || '请求失败';
    
    if (status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
      return Promise.reject(new Error('请先登录'));
    }
    
    console.error('API Error:', msg);
    return Promise.reject(new Error(msg));
  }
);

// 请求拦截器 - 自动添加token
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 统一错误处理
request.interceptors.response.use(
  (response) => response.data, // 直接返回data
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || '请求失败';
    
    // 401 未授权 - 清除token并跳转登录
    if (status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
      return Promise.reject(new Error('请先登录'));
    }
    
    console.error('API Error:', msg);
    return Promise.reject(new Error(msg));
  }
);
