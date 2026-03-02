/**
 * AI 工作台 - 透明悬浮层版本
 * 
 * 特点：
 * - 半透明背景，与原网页融为一体
 * - 对话+能力区占屏幕中央 70-80%
 * - 结果展示在下方或右侧（可收起）
 * - 悬浮层形式，不跳转页面
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Send, Sparkles, BarChart3, TrendingUp, 
  Users, Target, Lightbulb, GitBranch, Brain,
  ChevronDown, ChevronUp, Database, MessageSquare,
  Loader2, PanelRight, PanelBottom
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KimiAvatar } from '@/components/KimiAvatar';
import { aiApi } from '@/api/ai';
import { datasetApi } from '@/api';
import type { Dataset } from '@/types/api';
import { cn } from '@/lib/utils';

interface AnalysisCapability {
  id: string;
  name: string;
  icon: any;
  description: string;
  keywords: string[];
}

const capabilities: AnalysisCapability[] = [
  { id: 'visualization', name: '智能可视化', icon: BarChart3, description: '自动生成最佳图表', keywords: ['图表', '可视化', '画图'] },
  { id: 'forecast', name: '趋势预测', icon: TrendingUp, description: '预测未来趋势', keywords: ['预测', '趋势', '未来'] },
  { id: 'clustering', name: '智能聚类', icon: Users, description: '发现数据分组', keywords: ['聚类', '分组', '分群'] },
  { id: 'attribution', name: '归因分析', icon: Target, description: '分析驱动因素', keywords: ['归因', '因素', '原因'] },
  { id: 'correlation', name: '关联分析', icon: GitBranch, description: '发现变量关系', keywords: ['相关', '关联', '关系'] },
  { id: 'anomaly', name: '异常检测', icon: Lightbulb, description: '识别异常点', keywords: ['异常', '离群', '检测'] },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'chart' | 'analysis';
  data?: any;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIWorkspace({ isOpen, onClose }: AIWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的 AI 数据分析助手。\n\n告诉我你想分析什么，我可以帮你自动生成图表、预测趋势、发现数据洞察...',
      type: 'text',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'capabilities'>('chat');
  const [showResult, setShowResult] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [resultPosition, setResultPosition] = useState<'bottom' | 'right'>('bottom');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadDatasets();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadDatasets = async () => {
    try {
      const res = await datasetApi.list(1, 100) as any;
      setDatasets(res?.items || res?.data?.items || []);
    } catch (error) {
      console.error('加载数据集失败:', error);
    }
  };

  const detectIntent = (text: string): AnalysisCapability | null => {
    const lowerText = text.toLowerCase();
    for (const cap of capabilities) {
      if (cap.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
        return cap;
      }
    }
    return null;
  };

  const executeAnalysis = async (intent: AnalysisCapability, userMessage: string) => {
    if (!selectedDataset) {
      addMessage({
        role: 'assistant',
        content: '请先选择一份数据集，我才能帮你分析哦~',
      });
      return;
    }

    setIsLoading(true);
    setShowResult(false);

    try {
      // 模拟分析过程
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = {
        type: intent.id,
        title: `${intent.name}结果`,
        summary: `已完成${intent.name}，发现了关键洞察...`,
        data: {},
      };

      setAnalysisResult(result);
      setShowResult(true);

      addMessage({
        role: 'assistant',
        content: `${intent.name}完成！详细结果${resultPosition === 'bottom' ? '在下方' : '在右侧'}展示。`,
      });
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: '分析过程中出现了错误，请重试。',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneralAnalysis = async (prompt: string) => {
    addMessage({ role: 'assistant', content: '', isStreaming: true });

    let fullText = '';
    await aiApi.chatStream(prompt, (chunk, text) => {
      fullText = text;
      updateLastMessage({ content: text });
    }, {
      onFinish: () => updateLastMessage({ isStreaming: false }),
      onError: (err) => updateLastMessage({ content: `抱歉：${err}`, isStreaming: false }),
    });
  };

  const addMessage = (msg: Partial<Message>) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      type: 'text',
      timestamp: new Date(),
      ...msg,
    }]);
  };

  const updateLastMessage = (updates: Partial<Message>) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, ...updates }];
      }
      return prev;
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
    }]);

    const intent = detectIntent(userMsg);
    if (intent) {
      await executeAnalysis(intent, userMsg);
    } else {
      await handleGeneralAnalysis(userMsg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 半透明背景 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[var(--bg-primary)]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 主面板 - 占屏幕 70-80% */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          "relative flex flex-col rounded-3xl overflow-hidden",
          "bg-[var(--bg-secondary)]/80 backdrop-blur-xl",
          "border border-[var(--border-subtle)]",
          "shadow-2xl shadow-black/50",
          resultPosition === 'right' && showResult ? "w-[95vw] h-[90vh] flex-row" : "w-[85vw] max-w-[1200px] h-[85vh]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 左侧/主区域 - 对话和能力 */}
        <div className={cn(
          "flex flex-col h-full",
          resultPosition === 'right' && showResult ? "flex-1" : "w-full"
        )}>
          {/* 头部 */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border-subtle)] min-w-0">
            <KimiAvatar size="sm" mood="happy" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] whitespace-nowrap">AI 工作台</h2>
              <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">智能数据分析助手</p>
            </div>
            
            {/* 数据集选择 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Database className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <select
                value={selectedDataset || ''}
                onChange={(e) => setSelectedDataset(e.target.value || null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] min-w-[150px]"
              >
                <option value="">选择数据集...</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
            </div>

            {/* 结果位置切换 */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0">
              <button
                onClick={() => setResultPosition('bottom')}
                className={cn(
                  "p-1.5 rounded transition-colors flex-shrink-0",
                  resultPosition === 'bottom' ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]" : "text-[var(--text-muted)]"
                )}
                title="结果在下方"
              >
                <PanelBottom className="w-4 h-4 flex-shrink-0" />
              </button>
              <button
                onClick={() => setResultPosition('right')}
                className={cn(
                  "p-1.5 rounded transition-colors flex-shrink-0",
                  resultPosition === 'right' ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]" : "text-[var(--text-muted)]"
                )}
                title="结果在右侧"
              >
                <PanelRight className="w-4 h-4 flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* 标签切换 */}
          <div className="flex border-b border-[var(--border-subtle)] px-6 flex-shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "py-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'chat' 
                  ? "text-[var(--neon-cyan)] border-[var(--neon-cyan)]" 
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"
              )}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              对话
            </button>
            <button
              onClick={() => setActiveTab('capabilities')}
              className={cn(
                "py-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'capabilities' 
                  ? "text-[var(--neon-cyan)] border-[var(--neon-cyan)]" 
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"
              )}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              能力
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? (
              <div className="h-full flex flex-col">
                {/* 消息列表 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <KimiAvatar size="sm" mood={message.isStreaming ? 'thinking' : 'happy'} />
                      )}
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-[var(--neon-purple)]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-[var(--neon-purple)]">我</span>
                        </div>
                      )}
                      
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-3 text-sm",
                          message.role === 'user'
                            ? 'bg-[var(--neon-cyan)]/20 text-[var(--text-primary)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                        )}
                      >
                        <div className="whitespace-pre-wrap">
                          {message.content}
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-[var(--neon-cyan)] animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 输入框 */}
                <div className="p-4 border-t border-[var(--border-subtle)]">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedDataset ? '描述你想做的分析...' : '先选择一份数据集...'}
                      disabled={isLoading || !selectedDataset}
                      className="flex-1 bg-[var(--bg-tertiary)]"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading || !selectedDataset}
                      className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
                {capabilities.map((cap) => (
                  <button
                    key={cap.id}
                    onClick={() => {
                      setInputValue(`帮我做${cap.name}：${cap.description}`);
                      setActiveTab('chat');
                    }}
                    className="p-4 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/20 transition-colors">
                        <cap.icon className="w-5 h-5 text-[var(--neon-cyan)]" />
                      </div>
                      <div>
                        <h3 className="font-medium text-[var(--text-primary)]">{cap.name}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{cap.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 下方结果区（当选择bottom时） */}
          {resultPosition === 'bottom' && showResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-[var(--text-primary)]">{analysisResult?.title}</h3>
                  <button 
                    onClick={() => setShowResult(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    收起
                  </button>
                </div>
                <div className="h-32 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                  <p className="text-sm text-[var(--text-muted)]">{analysisResult?.summary}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 右侧结果区（当选择right时） */}
        {resultPosition === 'right' && showResult && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '350px', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 overflow-hidden"
          >
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-[var(--text-primary)]">{analysisResult?.title}</h3>
                <button 
                  onClick={() => setShowResult(false)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <p className="text-sm text-[var(--text-secondary)]">{analysisResult?.summary}</p>
                </div>
                <div className="h-40 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-[var(--neon-cyan)]/30" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default AIWorkspace;
