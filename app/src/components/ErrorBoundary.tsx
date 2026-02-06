import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: '' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || ''
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      // 自定义错误提示UI
      return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="glass border-[var(--border-subtle)] rounded-lg p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-pink)]/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-[var(--neon-pink)]" />
              </div>
              
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                出错了
              </h2>
              
              <p className="text-sm text-[var(--text-muted)] mb-4">
                页面遇到了问题，但数据是安全的。
              </p>
              
              {this.state.error && (
                <div className="mb-4 p-3 rounded bg-[var(--bg-secondary)] text-left">
                  <p className="text-xs text-[var(--neon-pink)] font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleGoBack}
                  className="px-4 py-2 rounded text-sm bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  返回上一页
                </button>
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 rounded text-sm bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新页面
                </button>
              </div>
              
              <p className="text-[10px] text-[var(--text-muted)] mt-4">
                如果问题持续存在，请检查数据格式或联系管理员
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 简化的错误提示组件（用于局部错误）
export function ErrorFallback({ 
  error, 
  reset 
}: { 
  error: Error; 
  reset?: () => void;
}) {
  return (
    <div className="p-4 rounded-lg bg-[var(--neon-pink)]/10 border border-[var(--neon-pink)]/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[var(--neon-pink)] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">
            操作失败
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {error.message || '发生了未知错误'}
          </p>
          {reset && (
            <button
              onClick={reset}
              className="mt-2 text-xs px-3 py-1.5 rounded bg-[var(--bg-secondary)] text-[var(--neon-cyan)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 安全的数值格式化函数
export function safeToFixed(value: number | null | undefined, digits: number = 2): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  try {
    return value.toFixed(digits);
  } catch (e) {
    return 'N/A';
  }
}

// 安全的属性访问
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result == null) return defaultValue;
      result = result[key];
    }
    return result ?? defaultValue;
  } catch (e) {
    return defaultValue;
  }
}
