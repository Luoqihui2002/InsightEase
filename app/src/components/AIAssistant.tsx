import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, MessageSquare, Lightbulb, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { aiApi } from '@/api';  // 新增：导入 API

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;  // 新增：标记是否正在流式输出
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contextId?: string;  // 新增：当前数据集ID或分析ID，作为上下文传入
}

const quickQuestions = [
  { label: '结果解读', icon: MessageSquare },
  { label: '优化建议', icon: Lightbulb },
  { label: '异常检测', icon: AlertTriangle },
];

export function AIAssistant({ isOpen, onClose, contextId }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 InsightEase AI 助手。我可以帮你解读数据分析结果、提供优化建议，或者回答任何关于数据的问题。',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);  // 新增：加载状态
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // 添加 AI 占位消息（空内容，准备流式填充）
    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // 构建历史记录（保留最近10轮对话）
    const history = messages
      .filter(m => m.id !== 'welcome')  // 过滤掉欢迎语
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    // 调用后端 SSE API
    aiApi.chatStream(userMessage.content, (_chunk, fullText) => {
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: fullText }
          : msg
      ));
    }, {
      context: contextId,  // 传入当前页面上下文（数据集ID等）
      history: history,
      onError: (err) => {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: `❌ 服务错误：${err}`, isStreaming: false }
            : msg
        ));
        setIsLoading(false);
      },
      onFinish: () => {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        setIsLoading(false);
      }
    });
  };

  const handleQuickQuestion = (question: string) => {
    setInputValue(`请帮我${question}`);
    setTimeout(() => handleSend(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 z-50 animate-in slide-in-from-right duration-300">
      <div className="h-full glass border-l border-[var(--border-subtle)] flex flex-col">
        {/* 头部 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-cyan)] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">AI 助手</h3>
              <p className="text-xs text-[var(--text-muted)]">{isLoading ? '思考中...' : 'Powered by Kimi'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--neon-cyan)]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 快捷问题 */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-muted)] mb-2">快捷提问</p>
          <div className="flex gap-2">
            {quickQuestions.map((q) => {
              const Icon = q.icon;
              return (
                <Button
                  key={q.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuestion(q.label)}
                  disabled={isLoading}
                  className="flex-1 text-xs border-[var(--border-subtle)] hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] bg-transparent disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {q.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 text-[var(--text-primary)]'
                      : 'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3 h-3 text-[var(--neon-cyan)]" />
                      <span className="text-xs text-[var(--neon-cyan)]">AI</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-[var(--neon-cyan)] animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {/* 加载指示器 */}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[var(--neon-cyan)] animate-spin" />
                    <span className="text-xs text-[var(--text-muted)]">正在连接服务器...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 输入框 */}
        <div className="p-4 border-t border-[var(--border-subtle)]">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "请等待回复完成..." : "输入你的问题..."}
              disabled={isLoading}
              className="flex-1 bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--neon-cyan)] focus:ring-[var(--neon-cyan)]/20 disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}