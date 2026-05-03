/**
 * AI 工作台 - Phase 3.0 智能分析版本
 * 
 * 布局说明：
 * - 上下布局(vertical)：数据预览在上，AI工作台在下
 * - 左右布局(horizontal)：AI工作台在左(62%)，数据预览在右(38%)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Send, Sparkles, BarChart3, TrendingUp, 
  Users, Target, Lightbulb, GitBranch,
  Database, MessageSquare,
  Loader2, Columns2, Rows2,
  History, Trash2, Table2, ArrowLeft,
  ClipboardList, Wand2, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar';

import { RelationshipReviewPanel } from '@/components/assistant/RelationshipReviewPanel';
import { AnalysisPlanCard } from '@/components/assistant/AnalysisPlanCard';
import { GuidedQuickAnalysisPanel } from '@/components/assistant/GuidedQuickAnalysisPanel';
import { getAssistantRuntime } from '@/lib/assistant/getAssistantRuntime';
import { useAssistantContext } from '@/hooks/useAssistantContext';
import type { AssistantAnalysisPlan } from '@/types/assistant';
import { datasetApi } from '@/api';
import type { DatasetPreview } from '@/types/api';
import type { AnalysisType } from '@/services/intent-recognition.service';

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
  plan?: AssistantAnalysisPlan;
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
const ACTIVE_SESSION_STORAGE_KEY = 'insightease_ai_workbench_active_session';

interface AIWorkbenchSessionSnapshot {
  messages: Message[];
  active_tab: 'chat' | 'capabilities' | 'history';
  selected_dataset_id?: string;
  active_relationship_set_id?: string;
  current_plan?: AssistantAnalysisPlan | null;
  current_session_id?: string;
  plan_question?: string;
  main_layout?: 'vertical' | 'horizontal';
  show_preview?: boolean;
  updated_at: string;
}

function reviveMessages(value: unknown): Message[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter((message) => {
      const candidate = message as Partial<Message>;
      return (
        typeof candidate.id === 'string' &&
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string'
      );
    })
    .map((message) => {
      const candidate = message as Partial<Message>;
      return {
        ...candidate,
        id: candidate.id ?? Date.now().toString(),
        role: candidate.role ?? 'assistant',
        content: candidate.content ?? '',
        timestamp: candidate.timestamp ? new Date(candidate.timestamp) : new Date(),
      } as Message;
    });
}

function loadActiveWorkbenchSession(): AIWorkbenchSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AIWorkbenchSessionSnapshot>;
    const messages = reviveMessages(parsed.messages);
    if (!messages || messages.length === 0) return null;

    return {
      messages,
      active_tab:
        parsed.active_tab === 'capabilities' || parsed.active_tab === 'history'
          ? parsed.active_tab
          : 'chat',
      selected_dataset_id:
        typeof parsed.selected_dataset_id === 'string' ? parsed.selected_dataset_id : undefined,
      active_relationship_set_id:
        typeof parsed.active_relationship_set_id === 'string'
          ? parsed.active_relationship_set_id
          : undefined,
      current_plan: parsed.current_plan ?? null,
      current_session_id:
        typeof parsed.current_session_id === 'string' ? parsed.current_session_id : undefined,
      plan_question: typeof parsed.plan_question === 'string' ? parsed.plan_question : '',
      main_layout: parsed.main_layout === 'horizontal' ? 'horizontal' : 'vertical',
      show_preview: typeof parsed.show_preview === 'boolean' ? parsed.show_preview : true,
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveActiveWorkbenchSession(snapshot: AIWorkbenchSessionSnapshot): void {
  try {
    sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota or private-mode failures; in-memory state still remains.
  }
}

export function AIWorkspace({ isOpen, onClose }: AIWorkspaceProps) {
  const restoredSessionRef = useRef<AIWorkbenchSessionSnapshot | null>(loadActiveWorkbenchSession());
  const restoredSession = restoredSessionRef.current;

  // 当前会话消息
  const [messages, setMessages] = useState<Message[]>(restoredSession?.messages ?? [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 InsightEase AI 数据助手。\n\n你可以直接描述想分析的问题；选择数据集后，我可以结合字段结构给出更具体的计划。\n\n例如：\n• "帮我统计一下销售额的平均值"\n• "预测下个月的业绩趋势"\n• "看一下各渠道的相关性"',
      type: 'text',
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(
    restoredSession?.selected_dataset_id ?? null
  );
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'capabilities' | 'history'>(
    restoredSession?.active_tab ?? 'chat'
  );
  const [mainLayout, setMainLayout] = useState<'vertical' | 'horizontal'>(
    restoredSession?.main_layout ?? 'vertical'
  );
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    restoredSession?.current_session_id ?? Date.now().toString()
  );
  const [datasetPreview, setDatasetPreview] = useState<{
    columns: string[];
    rows: Record<string, any>[];
    totalRows: number;
    columnTypes: Record<string, string>;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(restoredSession?.show_preview ?? true);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showAnalysisPlanPanel, setShowAnalysisPlanPanel] = useState(false);
  const [showQuickAnalysisPanel, setShowQuickAnalysisPanel] = useState(false);
  const [planQuestion, setPlanQuestion] = useState(restoredSession?.plan_question ?? '');
  const [generatedPlan, setGeneratedPlan] = useState<AssistantAnalysisPlan | null>(
    restoredSession?.current_plan ?? null
  );
  const [isPlanning, setIsPlanning] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [relationshipSetSearch, setRelationshipSetSearch] = useState('');

  const assistantContext = useAssistantContext();
  const activeRelationshipSet = assistantContext.getActiveRelationshipSet();
  const filteredDatasets = useMemo(() => {
    const query = datasetSearch.trim().toLowerCase();
    if (!query) return datasets;
    return datasets.filter((dataset) => dataset.filename.toLowerCase().includes(query));
  }, [datasetSearch, datasets]);
  const filteredRelationshipSets = useMemo(() => {
    const query = relationshipSetSearch.trim().toLowerCase();
    if (!query) return assistantContext.relationshipSets;
    return assistantContext.relationshipSets.filter((set) => set.name.toLowerCase().includes(query));
  }, [assistantContext.relationshipSets, relationshipSetSearch]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载数据集列表
  useEffect(() => {
    if (isOpen) {
      loadDatasets();
      loadChatHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    const restoredRelationshipSetId = restoredSessionRef.current?.active_relationship_set_id;
    if (restoredRelationshipSetId) {
      assistantContext.setActiveRelationshipSet(restoredRelationshipSetId);
    }
  }, []);

  useEffect(() => {
    saveActiveWorkbenchSession({
      messages,
      active_tab: activeTab,
      selected_dataset_id: selectedDataset ?? undefined,
      active_relationship_set_id: assistantContext.activeRelationshipSetId,
      current_plan: generatedPlan,
      current_session_id: currentSessionId,
      plan_question: planQuestion,
      main_layout: mainLayout,
      show_preview: showPreview,
      updated_at: new Date().toISOString(),
    });
  }, [
    activeTab,
    assistantContext.activeRelationshipSetId,
    currentSessionId,
    generatedPlan,
    mainLayout,
    messages,
    planQuestion,
    selectedDataset,
    showPreview,
  ]);

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
        content: '你好！我是 InsightEase AI 数据助手。\n\n你可以直接描述想分析的问题；选择数据集后，我可以结合字段结构给出更具体的计划。',
        type: 'text',
        timestamp: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    setGeneratedPlan(null);
    setPlanQuestion('');
    setShowAnalysisPlanPanel(false);
    setShowQuickAnalysisPanel(false);
    setShowRelationshipPanel(false);
    setActiveTab('chat');
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

  // Generate plan for a user question (replaces backend analysis from chat)
  const generatePlanForQuestion = async (question: string, baseMessages?: Message[]) => {
    setIsLoading(true);
    const currentMessages = baseMessages || messages;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    try {
      const selectedDatasetIds = selectedDataset ? [selectedDataset] : [];
      const activeSetRelationships = activeRelationshipSet?.relationships ?? [];

      const runtime = getAssistantRuntime();
      const response = await runtime.generateAnalysisPlan({
        question,
        context: {
          selected_dataset_ids: selectedDatasetIds,
          selected_dataset_id: selectedDataset ?? undefined,
          confirmed_relationships: activeSetRelationships,
          relationship_set: activeRelationshipSet,
          available_dataset_nodes: activeRelationshipSet?.dataset_nodes ?? [],
          datasets: datasets.map((d) => ({
            id: d.id,
            filename: d.filename,
            name: d.filename,
            schema: (d.schema || []).map((col: any) => ({
              name: col?.name || '',
              semantic_type: col?.semantic_type || col?.type || '',
            })),
          })),
        },
      });

      const planMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `基于你的问题，我生成了以下分析计划：`,
        type: 'text',
        timestamp: new Date(),
        plan: response.plan,
      };

      const newMessages: Message[] = [...currentMessages, userMessage, planMessage];
      updateCurrentSession(newMessages);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '生成计划失败';
      const newMessages: Message[] = [...currentMessages, userMessage, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `生成计划时出错：${errorMsg}`,
        type: 'error',
        timestamp: new Date(),
      }];
      updateCurrentSession(newMessages);
    } finally {
      setIsLoading(false);
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

  // 发送消息 — 路由到规则型规划器，不直接调用后端分析
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    generatePlanForQuestion(userMsg);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 使用能力卡片 — 数据集依赖型能力需先选数据集
  const useCapability = (cap: AnalysisCapability) => {
    if (!selectedDataset) {
      addMessage({
        role: 'assistant',
        content: `「${cap.name}」需要选择数据集后才能使用。请在上方选择一份数据集，或先在「生成分析计划」中描述你的问题。`,
        type: 'text'
      });
      setActiveTab('chat');
      return;
    }

    const prompt = `帮我做${cap.name}分析`;
    setInputValue(prompt);
    setActiveTab('chat');

    setTimeout(() => {
      generatePlanForQuestion(prompt);
    }, 100);
  };

  // 生成分析计划
  const handleGeneratePlan = async () => {
    if (!planQuestion.trim()) return;
    setIsPlanning(true);
    setGeneratedPlan(null);

    try {
      const selectedDatasetIds = selectedDataset ? [selectedDataset] : [];
      const activeSetRelationships = activeRelationshipSet?.relationships ?? [];

      const runtime = getAssistantRuntime();
      const response = await runtime.generateAnalysisPlan({
        question: planQuestion.trim(),
        context: {
          selected_dataset_ids: selectedDatasetIds,
          selected_dataset_id: selectedDataset ?? undefined,
          confirmed_relationships: activeSetRelationships,
          relationship_set: activeRelationshipSet,
          available_dataset_nodes: activeRelationshipSet?.dataset_nodes ?? [],
          datasets: datasets.map((d) => ({
            id: d.id,
            filename: d.filename,
            name: d.filename,
            schema: (d.schema || []).map((col: any) => ({
              name: col?.name || '',
              semantic_type: col?.semantic_type || col?.type || '',
            })),
          })),
        },
      });

      setGeneratedPlan(response.plan);
    } catch (error) {
      console.error('生成计划失败:', error);
    } finally {
      setIsPlanning(false);
    }
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
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 flex-shrink-0 max-h-[240px] overflow-hidden flex flex-col">
            {/* 数据预览头部 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
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
            <div className="p-3 overflow-auto flex-1">
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
          "flex flex-col min-h-0 overflow-hidden",
          mainLayout === 'horizontal' && showPreview && datasetPreview ? "w-[62%]" : "flex-1"
        )}>
          {/* 头部 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] pl-12 flex-shrink-0">
            <AssistantAvatar variant="default" size="sm" />
            <div className="flex-shrink-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">AI 工作台</h2>
              <p className="text-[10px] text-[var(--text-muted)]">规则型分析规划 · 选择数据集可获得更具体的建议</p>
            </div>
            
            <div className="flex-1"></div>
            
            {/* 数据集选择 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Database className="w-4 h-4 text-[var(--text-muted)]" />
              <div className="flex flex-col gap-1">
                <input
                  value={datasetSearch}
                  onChange={(e) => setDatasetSearch(e.target.value)}
                  placeholder="搜索数据集"
                  className="px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] w-[150px] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
                />
                <select
                  value={selectedDataset || ''}
                  onChange={(e) => setSelectedDataset(e.target.value || null)}
                  className="px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] w-[150px]"
                >
                <option value="">选择数据集...</option>
                {filteredDatasets.map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
                {filteredDatasets.length === 0 && (
                  <option value="" disabled>未找到匹配的数据集</option>
                )}
              </select>
              </div>
            </div>

            {/* 关系组选择 */}
            <div className="flex items-center gap-2 flex-shrink-0" title="关系组用于告诉助手哪些表关系可以作为分析上下文；不会自动 join。">
              <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
              <div className="flex flex-col gap-1">
                <input
                  value={relationshipSetSearch}
                  onChange={(e) => setRelationshipSetSearch(e.target.value)}
                  placeholder="搜索关系组"
                  className="px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] w-[180px] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
                />
                <select
                  value={assistantContext.activeRelationshipSetId || ''}
                  onChange={(e) => assistantContext.setActiveRelationshipSet(e.target.value || undefined)}
                  className="px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] w-[180px]"
                >
                <option value="">不使用关系组</option>
                {filteredRelationshipSets.map((set) => (
                  <option key={set.id} value={set.id}>{set.name}</option>
                ))}
                {filteredRelationshipSets.length === 0 && (
                  <option value="" disabled>未找到匹配的关系组</option>
                )}
              </select>
              </div>
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
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'chat' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* 消息列表 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
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
                        {message.plan && (
                          <div className="mt-3">
                            <AnalysisPlanCard
                              plan={message.plan}
                              onNavigate={(target) => {
                                window.dispatchEvent(new CustomEvent('companion-navigate', { detail: target }));
                                onClose();
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                </div>

                {/* 快速提示芯片 */}
                {!isLoading && (
                  <div className="px-4 pt-3 pb-0 flex-shrink-0">
                    <div className="flex flex-wrap gap-2">
                      {[
                        '预测未来销售额趋势',
                        '分析各渠道转化率',
                        '找出数据中的异常值',
                        '统计各列描述性指标',
                        '分析用户行为路径',
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
                <div className="p-4 border-t border-[var(--border-subtle)] flex-shrink-0">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedDataset
                        ? '描述你想做的分析，比如"预测下月销售额"...'
                        : '描述你想分析的问题，选择数据集后我可以给出更具体的计划...'}
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
                </div>
              </div>
            )}

            {activeTab === 'capabilities' && (
              <>
                {showRelationshipPanel ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
                      <button
                        onClick={() => setShowRelationshipPanel(false)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-[var(--text-primary)]">理清表关系</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <RelationshipReviewPanel
                        datasets={datasets}
                        relationshipSets={assistantContext.relationshipSets}
                        activeRelationshipSetId={assistantContext.activeRelationshipSetId}
                        onCreateRelationshipSet={assistantContext.createRelationshipSet}
                        onUpdateRelationshipSet={assistantContext.updateRelationshipSet}
                        onDeleteRelationshipSet={assistantContext.deleteRelationshipSet}
                        onSetActiveRelationshipSet={assistantContext.setActiveRelationshipSet}
                        onClearActiveRelationshipSet={() =>
                          assistantContext.setActiveRelationshipSet(undefined)
                        }
                      />
                    </div>
                  </div>
                ) : showQuickAnalysisPanel ? (
                  <GuidedQuickAnalysisPanel
                    datasets={datasets}
                    defaultDatasetId={selectedDataset ?? undefined}
                    activeRelationshipSet={activeRelationshipSet}
                    onNavigate={(target) => {
                      window.dispatchEvent(new CustomEvent('companion-navigate', { detail: target }));
                      onClose();
                    }}
                    onBack={() => setShowQuickAnalysisPanel(false)}
                  />
                ) : showAnalysisPlanPanel ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
                      <button
                        onClick={() => { setShowAnalysisPlanPanel(false); setGeneratedPlan(null); }}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-[var(--text-primary)]">生成分析计划</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                      <div className="rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] p-4">
                        <p className="text-sm text-[var(--text-primary)] mb-3">
                          输入你的业务问题，我会基于规则匹配生成一个结构化分析路径建议。
                        </p>
                        <div className="flex gap-2">
                          <input
                            value={planQuestion}
                            onChange={(e) => setPlanQuestion(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && planQuestion.trim()) handleGeneratePlan(); }}
                            placeholder="例如：未来销售额会怎么变化？"
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
                          />
                          <Button
                            onClick={handleGeneratePlan}
                            disabled={!planQuestion.trim() || isPlanning}
                            className="bg-[var(--neon-cyan)] text-[var(--bg-primary)] hover:bg-[var(--neon-cyan)]/80 disabled:opacity-50"
                          >
                            {isPlanning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4" />
                            )}
                            生成计划
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {[
                            '为什么最近转化率下降？',
                            '哪些渠道贡献最高？',
                            '未来销售额会怎么变化？',
                            '哪些用户路径流失最多？',
                            '评论里用户主要在抱怨什么？',
                            '缺失值怎么处理？',
                          ].map((sample) => (
                            <button
                              key={sample}
                              onClick={() => { setPlanQuestion(sample); setGeneratedPlan(null); }}
                              className="px-2.5 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--neon-cyan)]/30 hover:text-[var(--neon-cyan)] transition-all"
                            >
                              {sample}
                            </button>
                          ))}
                        </div>
                      </div>

                      {generatedPlan && (
                        <AnalysisPlanCard
                          plan={generatedPlan}
                          onNavigate={(target) => {
                            window.dispatchEvent(new CustomEvent('companion-navigate', { detail: target }));
                            onClose();
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                    {/* 上下文无关能力 */}
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                        通用能力
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* 生成分析计划 — 规则型分析规划 */}
                        <button
                          onClick={() => setShowAnalysisPlanPanel(true)}
                          className="p-4 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/20 transition-colors">
                              <ClipboardList className="w-5 h-5 text-[var(--neon-cyan)]" />
                            </div>
                            <div>
                              <h3 className="font-medium text-[var(--text-primary)]">生成分析计划</h3>
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                输入业务问题，生成结构化分析路径建议
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* 快速分析向导 — 引导式数据集选择 + 计划生成 */}
                        <button
                          onClick={() => setShowQuickAnalysisPanel(true)}
                          className="p-4 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/20 transition-colors">
                              <Zap className="w-5 h-5 text-[var(--neon-cyan)]" />
                            </div>
                            <div>
                              <h3 className="font-medium text-[var(--text-primary)]">快速分析向导</h3>
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                从选择数据集开始，逐步理解数据并生成分析路径
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* 理清表关系 — 多表关系推断 */}
                        <button
                          onClick={() => setShowRelationshipPanel(true)}
                          className="p-4 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-transparent hover:border-[var(--neon-cyan)]/30 transition-all text-left group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/20 transition-colors">
                              <Table2 className="w-5 h-5 text-[var(--neon-cyan)]" />
                            </div>
                            <div>
                              <h3 className="font-medium text-[var(--text-primary)]">理清表关系</h3>
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                选择多张数据表，推断可能的 join key 和表关系
                              </p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* 数据集依赖能力 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                          分析工具
                        </p>
                        {!selectedDataset && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            请选择数据集后使用
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>
            )}
              </>
            )}

            {activeTab === 'history' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">对话历史</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { createNewSession(); setActiveTab('chat'); }}
                    className="text-[var(--neon-cyan)]"
                    title="新对话只会清空当前对话，不会清空你已确认的表关系"
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

        </div>

        {/* ========== 左右布局：数据预览在右侧 ========== */}
        {mainLayout === 'horizontal' && showPreview && datasetPreview && (
          <div className="w-[38%] border-l border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 flex flex-col min-h-0 overflow-hidden">
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
