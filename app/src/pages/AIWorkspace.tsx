/**
 * AI 工作台 - Phase 3.0 智能分析版本
 * 
 * 布局说明：
 * - 上下布局(vertical)：数据预览在上，AI工作台在下
 * - 左右布局(horizontal)：AI工作台在左(62%)，数据预览在右(38%)
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Send, Sparkles, BarChart3, TrendingUp, 
  Users, Target, Lightbulb, GitBranch,
  ChevronDown, ChevronUp, Database, MessageSquare,
  Loader2, Columns2, Rows2,
  History, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar';
import { AnalysisResultRenderer } from '@/components/AnalysisResultRenderer';
import { datasetApi } from '@/api';
import type { DatasetPreview } from '@/types/api';
import { intentRecognitionService, type AnalysisType } from '@/services/intent-recognition.service';
import { analysisExecutionService, type AnalysisResult as ExecutionResult } from '@/services/analysis-execution.service';

import type { Dataset } from '@/types/api';
import { cn } from '@/lib/utils';

interface AnalysisCapability {
  id: AnalysisType;
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
  { id: 'descriptive', name: '描述统计', icon: Lightbulb, description: '基础统计分析', keywords: ['统计', '均值', '标准差'] },
];

// 聊天消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'analysis' | 'error';
  analysisResult?: ExecutionResult;
  timestamp: Date;
  isStreaming?: boolean;
}

// 对话历史
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface AIWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'ai_workspace_sessions';

export function AIWorkspace({ isOpen, onClose }: AIWorkspaceProps) {
  // 当前会话消息
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 InsightEase AI 数据助手。\n\n当前支持规则型分析导航：选择数据集后，描述你想做的分析，比如：\n• "帮我统计一下销售额的平均值"\n• "预测下个月的业绩趋势"\n• "看一下各渠道的相关性"\n\n自然语言智能规划将在后续阶段开放。',
      type: 'text',
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'capabilities' | 'history'>('chat');
  const [showResult, setShowResult] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ExecutionResult | null>(null);
  const [mainLayout, setMainLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState<{status: string, progress: number} | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<{
    columns: string[];
    rows: Record<string, any>[];
    totalRows: number;
    columnTypes: Record<string, string>;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载数据集列表
  useEffect(() => {
    if (isOpen) {
      loadDatasets();
      loadChatHistory();
      createNewSession();
    }
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 加载数据集列表
  const loadDatasets = async () => {
    try {
      const res = await datasetApi.list(1, 100);
      console.log('数据集列表响应:', res);
      
      // 注意：拦截器已经解包了 response.data
      // 所以 res 直接就是 { code: 200, data: { items: [...] } }
      let items: Dataset[] = [];
      
      const response = res as unknown as { code?: number; data?: { items?: Dataset[] } | Dataset[] };
      if (response?.code === 200 && response.data && 'items' in response.data && Array.isArray(response.data.items)) {
        items = response.data.items;
      } else if (response?.code === 200 && Array.isArray(response.data)) {
        items = response.data;
      }
      
      console.log('解析后的数据集:', items);
      setDatasets(items);
    } catch (error) {
      console.error('加载数据集失败:', error);
    }
  };

  // 加载聊天历史
  const loadChatHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setChatHistory(parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        })));
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
  };

  // 保存聊天历史
  const saveChatHistory = (history: ChatSession[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('保存聊天历史失败:', error);
    }
  };

  // 创建新会话
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [{
        id: 'welcome',
        role: 'assistant',
        content: '你好！我是你的 AI 数据分析助手。\n\n告诉我你想分析什么...',
        type: 'text',
        timestamp: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    setShowResult(false);
    setAnalysisResult(null);
  };

  // 切换到历史会话
  const switchSession = (sessionId: string) => {
    const session = chatHistory.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setActiveTab('chat');
    }
  };

  // 删除历史会话
  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const updated = chatHistory.filter(s => s.id !== sessionId);
    setChatHistory(updated);
    saveChatHistory(updated);
    if (currentSessionId === sessionId) {
      createNewSession();
    }
  };

  // 更新当前会话
  const updateCurrentSession = (newMessages: Message[]) => {
    setMessages(newMessages);
    
    const updatedHistory = chatHistory.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: newMessages,
          updatedAt: new Date(),
          title: newMessages.find(m => m.role === 'user')?.content.slice(0, 20) || '新对话'
        };
      }
      return session;
    });
    
    // 如果是新会话，添加到历史
    if (!chatHistory.find(s => s.id === currentSessionId)) {
      const newSession: ChatSession = {
        id: currentSessionId,
        title: newMessages.find(m => m.role === 'user')?.content.slice(0, 20) || '新对话',
        messages: newMessages,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      updatedHistory.unshift(newSession);
    }
    
    setChatHistory(updatedHistory);
    saveChatHistory(updatedHistory);
  };

  // AI 意图识别 + 执行分析
  const handleAnalysisRequest = async (userMessage: string) => {
    if (!selectedDataset) {
      addMessage({
        role: 'assistant',
        content: '请先选择一份数据集，我才能帮你分析哦~',
        type: 'text'
      });
      return;
    }
    
    // 防止重复提交
    if (isLoading) {
      console.log('分析进行中，忽略重复请求');
      return;
    }

    setIsLoading(true);
    setAnalysisProgress({ status: '正在理解你的需求...', progress: 10 });
    setShowResult(false);

    try {
      // 1. AI 意图识别
      const datasetSchemas = datasets
        .filter(d => d && d.id)
        .map(d => ({
          id: d.id,
          name: d.filename || '未命名数据集',
          row_count: d.row_count || 0,
          columns: (d.schema || []).map((col: any) => ({
            name: col?.name || '',
            type: col?.type || 'other',
            dtype: col?.dtype || col?.type || 'other',
            unique_count: col?.unique_count || 0,
            sample_values: col?.sample_values || [],
          }))
        }));

      const intent = await intentRecognitionService.recognizeIntent(
        userMessage,
        datasetSchemas
      );

      // 2. 数据验证
      if ((intent.type as string) === 'unknown') {
        addMessage({
          role: 'assistant',
          content: `抱歉，我没太理解你的需求。\n\n你可以这样描述：\n• "统计销售额的平均值和标准差"\n• "预测下个月的业绩"\n• "看一下相关性热力图"`,
          type: 'text'
        });
        setIsLoading(false);
        setAnalysisProgress(null);
        return;
      }

      // 3. 执行分析
      addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
        type: 'analysis'
      });

      await analysisExecutionService.executeByIntent(
        intent,
        {
          datasetId: selectedDataset,
          onProgress: (status, progress) => {
            setAnalysisProgress({ status, progress: progress ?? 0 });
          },
          onSuccess: (analysisResult) => {
            setAnalysisResult(analysisResult);
            setShowResult(true);

            updateLastMessage({
              content: `${intent.description}完成！\n\n${analysisResult.summary || ''}`,
              isStreaming: false,
              type: 'analysis',
              analysisResult
            });
          },
          onError: (error) => {
            updateLastMessage({
              content: `分析失败：${error}`,
              isStreaming: false,
              type: 'error'
            });
          }
        }
      );

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '分析失败';
      addMessage({
        role: 'assistant',
        content: `抱歉，分析过程中出现错误：${errorMsg}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
      setAnalysisProgress(null);
    }
  };

  // 普通对话（不走分析流程）
  // const handleGeneralChat = async (prompt: string) => {
  //   addMessage({ role: 'assistant', content: '', isStreaming: true, type: 'text' });

  //   // 构建上下文
  //   const history = messages
  //     .filter(m => m.role !== 'assistant' || !m.isStreaming)
  //     .slice(-6)
  //     .map(m => ({
  //       role: m.role,
  //       content: m.content
  //     }));

  //   await aiApi.chatStream(prompt, (_chunk, text) => {
  //     updateLastMessage({ content: text });
  //   }, {
  //     history,
  //     onFinish: () => updateLastMessage({ isStreaming: false }),
  //     onError: (err) => updateLastMessage({ content: `抱歉：${err}`, isStreaming: false, type: 'error' }),
  //   });
  // };

  // 添加消息
  const addMessage = (msg: Partial<Message>) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      type: 'text',
      timestamp: new Date(),
      ...msg,
    };
    const newMessages = [...messages, newMessage];
    updateCurrentSession(newMessages);
  };

  // 更新最后一条消息
  const updateLastMessage = (updates: Partial<Message>) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        const newMessages = [...prev.slice(0, -1), { ...last, ...updates }];
        setTimeout(() => updateCurrentSession(newMessages), 100);
        return newMessages;
      }
      return prev;
    });
  };

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');

    const newMessages: Message[] = [...messages, {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
    }];
    updateCurrentSession(newMessages);

    await handleAnalysisRequest(userMsg);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 使用能力卡片
  const useCapability = (cap: AnalysisCapability) => {
    const prompt = `帮我做${cap.name}分析`;
    setInputValue(prompt);
    setActiveTab('chat');
    
    setTimeout(() => {
      const newMessages: Message[] = [...messages, {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      }];
      updateCurrentSession(newMessages);
      handleAnalysisRequest(prompt);
    }, 100);
  };

  // 加载数据集预览
  const loadDatasetPreview = async (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (!dataset) return;

    const columnTypesFromSchema: Record<string, string> = {};
    if (dataset.schema) {
      dataset.schema.forEach((s: any) => {
        columnTypesFromSchema[s.name] = s.type || s.dtype || 'unknown';
      });
    }

    try {
      const res = await datasetApi.preview(datasetId, 5);
      console.log('API 原始响应:', res);
      
      // 注意：拦截器已经解包了 response.data
      let responseData = null;
      const response = res as unknown as { code?: number; data?: DatasetPreview };
      if (response?.code === 200 && response.data) {
        responseData = response.data;
      }
      
      if (responseData) {
        setDatasetPreview({
          columns: responseData.columns || [],
          rows: responseData.data || [],
          totalRows: responseData.total_rows || dataset.row_count || 0,
          columnTypes: columnTypesFromSchema
        });
        setShowPreview(true);
      }
    } catch (error) {
      console.error('加载预览失败:', error);
    }
  };

  // 选择数据集时加载预览
  useEffect(() => {
    if (selectedDataset) {
      loadDatasetPreview(selectedDataset);
    } else {
      setDatasetPreview(null);
      setShowPreview(false);
    }
  }, [selectedDataset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 半透明背景 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[var(--bg-primary)]/60 backdrop-blur-sm"
      />

      {/* 主面板 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          "relative flex rounded-3xl overflow-hidden",
          "bg-[var(--bg-secondary)]/80 backdrop-blur-xl",
          "border border-[var(--border-subtle)]",
          "shadow-2xl shadow-black/50",
          "w-[95vw] h-[90vh]",
          mainLayout === 'horizontal' ? "flex-row" : "flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========== 关闭按钮 ========== */}
        <button
          onClick={onClose}
          aria-label="关闭 AI 工作台"
          className={cn(
            "absolute top-3 left-3 z-50",
            "h-9 w-9 flex items-center justify-center",
            "rounded-xl border border-white/10",
            "bg-white/5 text-[var(--text-secondary)]",
            "hover:bg-white/10 hover:text-white hover:border-white/20",
            "transition-colors"
          )}
        >
          <X className="w-4 h-4" />
        </button>

        {/* ========== 上下布局：数据预览在上方 ========== */}
        {mainLayout === 'vertical' && showPreview && datasetPreview && (
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 flex-shrink-0">
            {/* 数据预览头部 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                数据预览（前5行 / 共{datasetPreview.totalRows}行）
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                收起
              </button>
            </div>
            {/* 数据表格 */}
            <div className="p-3 overflow-x-auto" style={{ maxHeight: '200px' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {datasetPreview.columns.map(col => (
                      <th key={col} className="px-2 py-1.5 text-left text-[var(--text-muted)] whitespace-nowrap">
                        {col}
                        <span className="ml-1 text-[10px] opacity-60">
                          ({datasetPreview?.columnTypes[col] || 'unknown'})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetPreview.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-[var(--border-subtle)]/50">
                      {datasetPreview.columns.map(col => (
                        <td key={col} className="px-2 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[150px] truncate">
                          {row[col] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== AI 对话区域 ========== */}
        <div className={cn(
          "flex flex-col",
          mainLayout === 'horizontal' && showPreview && datasetPreview ? "w-[62%]" : "flex-1"
        )}>
          {/* 头部 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] pl-12">
            <AssistantAvatar variant="default" size="sm" />
            <div className="flex-shrink-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">AI 工作台</h2>
              <p className="text-[10px] text-[var(--text-muted)]">规则型数据助手 · 自然语言能力即将开放</p>
            </div>
            
            <div className="flex-1"></div>
            
            {/* 数据集选择 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Database className="w-4 h-4 text-[var(--text-muted)]" />
              <select
                value={selectedDataset || ''}
                onChange={(e) => setSelectedDataset(e.target.value || null)}
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] w-[130px]"
              >
                <option value="">选择数据集...</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
            </div>

            {/* 布局切换 - 左右排版 | 上下排版 */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0">
              <button
                onClick={() => {
                  setMainLayout('horizontal');
                  if (!showPreview) setShowPreview(true);
                }}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  mainLayout === 'horizontal' ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
                title="左右排版（AI工作台在左，数据预览在右）"
              >
                <Columns2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setMainLayout('vertical');
                }}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  mainLayout === 'vertical' ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
                title="上下排版（数据预览在上，AI工作台在下）"
              >
                <Rows2 className="w-4 h-4" />
              </button>
            </div>

            {/* 隐藏/显示预览按钮（仅在上下布局显示） */}
            {mainLayout === 'vertical' && selectedDataset && datasetPreview && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={cn(
                  "px-2 py-1.5 text-xs rounded-lg transition-colors flex-shrink-0",
                  showPreview 
                    ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]" 
                    : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {showPreview ? '隐藏预览' : '显示预览'}
              </button>
            )}
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
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "py-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'history' 
                  ? "text-[var(--neon-cyan)] border-[var(--neon-cyan)]" 
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"
              )}
            >
              <History className="w-4 h-4 flex-shrink-0" />
              历史
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
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
                        <AssistantAvatar variant={message.isStreaming ? 'processing' : 'default'} size="sm" animated />
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
                            : message.type === 'error'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
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
                  
                  {/* 分析进度 */}
                  {analysisProgress && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--neon-cyan)]/5 border border-[var(--neon-cyan)]/20">
                      <Loader2 className="w-5 h-5 text-[var(--neon-cyan)] animate-spin" />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-primary)]">{analysisProgress.status}</div>
                        <div className="mt-2 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--neon-cyan)] transition-all duration-300"
                            style={{ width: `${analysisProgress.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{analysisProgress.progress}%</span>
                    </div>
                  )}
                </div>

                {/* 快速提示芯片（仅数据集已选时显示） */}
                {selectedDataset && !isLoading && (
                  <div className="px-4 pt-3 pb-0">
                    <div className="flex flex-wrap gap-2">
                      {[
                        '统计各列描述',
                        '预测未来趋势',
                        '分析相关性',
                        '找出异常值',
                        '做分类汇总',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => {
                            setInputValue(prompt);
                            inputRef.current?.focus();
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs',
                            'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
                            'border border-[var(--border-subtle)]',
                            'hover:border-[var(--neon-cyan)]/40 hover:text-[var(--neon-cyan)]',
                            'transition-all active:scale-95'
                          )}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 输入框 */}
                <div className="p-4 border-t border-[var(--border-subtle)]">
                  {!selectedDataset ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                      <Database className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      <span className="text-sm text-[var(--text-muted)]">
                        请先在上方的下拉菜单中选择一份数据集，再开始分析
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='描述你想做的分析，比如"预测下月销售额"...'
                        disabled={isLoading}
                        className="flex-1 bg-[var(--bg-tertiary)]"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'capabilities' && (
              <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
                {capabilities.map((cap) => (
                  <button
                    key={cap.id}
                    onClick={() => useCapability(cap)}
                    disabled={!selectedDataset || isLoading}
                    className="p-4 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
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

            {activeTab === 'history' && (
              <div className="p-4 overflow-y-auto h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">对话历史</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={createNewSession}
                    className="text-[var(--neon-cyan)]"
                  >
                    新对话
                  </Button>
                </div>
                <div className="space-y-2">
                  {chatHistory.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-8">暂无历史对话</p>
                  ) : (
                    chatHistory.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => switchSession(session.id)}
                        className={cn(
                          "p-3 rounded-lg cursor-pointer group flex items-center justify-between",
                          currentSessionId === session.id
                            ? "bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30"
                            : "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--text-primary)] truncate">{session.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {session.updatedAt.toLocaleDateString()} {session.messages.length} 条消息
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteSession(e, session.id)}
                          className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 分析结果面板 - 显示在对话区域下方 */}
          {showResult && analysisResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: '45%', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <h3 className="font-medium text-[var(--text-primary)]">分析结果</h3>
                <button 
                  onClick={() => setShowResult(false)}
                  className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="收起结果"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AnalysisResultRenderer result={analysisResult} />
              </div>
            </motion.div>
          )}
          
          {/* 分析结果折叠状态 */}
          {!showResult && analysisResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 cursor-pointer hover:bg-[var(--bg-tertiary)] flex-shrink-0"
              onClick={() => setShowResult(true)}
            >
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)]" />
                  <span className="text-sm text-[var(--text-primary)]">分析结果</span>
                  <span className="text-xs text-[var(--text-muted)]">（点击展开）</span>
                </div>
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </motion.div>
          )}
        </div>

        {/* ========== 左右布局：数据预览在右侧 ========== */}
        {mainLayout === 'horizontal' && showPreview && datasetPreview && (
          <div className="w-[38%] border-l border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 flex flex-col">
            {/* 数据预览头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                数据预览
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                共{datasetPreview.totalRows}行
              </span>
            </div>
            {/* 数据表格 */}
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-tertiary)]">
                  <tr className="border-b border-[var(--border-subtle)]">
                    {datasetPreview.columns.map(col => (
                      <th key={col} className="px-2 py-1.5 text-left text-[var(--text-muted)] whitespace-nowrap">
                        {col}
                        <span className="ml-1 text-[10px] opacity-60">
                          ({datasetPreview?.columnTypes[col] || 'unknown'})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetPreview.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-[var(--border-subtle)]/50">
                      {datasetPreview.columns.map(col => (
                        <td key={col} className="px-2 py-1.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[150px] truncate">
                          {row[col] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default AIWorkspace;
