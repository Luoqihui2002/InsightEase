/**
 * AI 工作台 - Phase 3.0 智能分析版本
 * 
 * 布局说明：
 * - 上下布局(vertical)：数据预览在上，AI工作台在下
 * - 左右布局(horizontal)：AI工作台在左(62%)，数据预览在右(38%)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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

import { AIWorkbenchContextPanel } from '@/components/assistant/AIWorkbenchContextPanel';
import { RelationshipReviewPanel } from '@/components/assistant/RelationshipReviewPanel';
import { AnalysisPlanCard } from '@/components/assistant/AnalysisPlanCard';
import { GuidedQuickAnalysisPanel } from '@/components/assistant/GuidedQuickAnalysisPanel';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { getAssistantRuntimeProvider } from '@/lib/assistant/assistantRuntimeConfig';
import { getAssistantRuntime } from '@/lib/assistant/getAssistantRuntime';
import type { AssistantContext as AssistantRuntimeContext } from '@/lib/assistant/assistantRuntime';
import {
  ANALYSIS_TAG_LABELS,
  BUSINESS_CATEGORY_LABELS,
  DATA_TYPE_LABELS,
  inferDatasetCatalogMetadata,
} from '@/lib/datasetCatalog';
import {
  AI_WORKBENCH_HANDOFF_EVENT,
  DEFAULT_RESULT_FOLLOWUP_PROMPTS,
  clearAIWorkbenchHandoff,
  readAIWorkbenchHandoff,
} from '@/lib/assistant/aiWorkbenchHandoff';
import {
  buildResultFollowupResponse,
  detectResultFollowupIntent,
} from '@/lib/assistant/resultFollowupResponder';
import { useAssistantContext } from '@/hooks/useAssistantContext';
import { useHermesStatus } from '@/hooks/useHermesStatus';
import type { AssistantAnalysisPlan, PlanningDatasetMetadata } from '@/types/assistant';
import { datasetApi } from '@/api';
import { assistantApi } from '@/api/assistant';
import type { ApiResponse } from '@/types/api';
import type { HermesExplainResultResponse } from '@/types/hermes';
import type { DatasetPreview } from '@/types/api';
import type { SafeResultSummary } from '@/types/resultSummary';
import type { Dataset } from '@/types/api';
import { cn } from '@/lib/utils';

type AnalysisCapabilityId =
  | 'visualization'
  | 'forecast'
  | 'clustering'
  | 'attribution'
  | 'correlation'
  | 'descriptive';

interface AnalysisCapability {
  id: AnalysisCapabilityId;
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

function getHermesDiagnosticLabel(
  status: ReturnType<typeof useHermesStatus>,
  runtimeProvider: ReturnType<typeof getAssistantRuntimeProvider>
): string {
  if (runtimeProvider === 'hermes_live') return 'Hermes Live advisory planning · deterministic fallback enabled';
  if (runtimeProvider === 'hermes_dry_run') return 'Hermes dry-run runtime · fallback enabled';
  if (status.status === 'dry_run') return 'Hermes dry-run 可用 · 当前仍使用规则模式';
  if (status.status === 'live') return 'Hermes live 已配置 · 当前仍使用规则模式';
  if (status.status === 'disabled') return '本地规则模式 · Hermes disabled';
  if (status.status === 'unavailable') return '本地规则模式 · Hermes 状态不可用';
  return '本地规则模式';
}

function canUseHermesLiveResultExplainer(status: ReturnType<typeof useHermesStatus>): boolean {
  return (
    status.status === 'live' &&
    status.mode === 'live' &&
    status.enabled &&
    status.available !== false &&
    Boolean(status.supports?.explain_result)
  );
}

function formatHermesExplainResult(response: HermesExplainResultResponse): string {
  const sections = [
    'Hermes live generated this from SafeResultSummary only. No analysis was rerun.',
    response.answer,
    response.key_findings.length > 0
      ? ['Key findings:', ...response.key_findings.map((item) => `- ${item}`)].join('\n')
      : undefined,
    response.risks_and_caveats.length > 0
      ? ['Risks and caveats:', ...response.risks_and_caveats.map((item) => `- ${item}`)].join('\n')
      : undefined,
    response.suggested_next_steps.length > 0
      ? ['Suggested next steps:', ...response.suggested_next_steps.map((item, index) => `${index + 1}. ${item}`)].join('\n')
      : undefined,
  ].filter(Boolean);

  return sections.join('\n\n');
}

function unwrapApiData<T>(response: unknown): T | undefined {
  const maybeResponse = response as { data?: unknown };

  if (isApiResponse<T>(maybeResponse?.data)) {
    return maybeResponse.data.data;
  }

  if (isApiResponse<T>(response)) {
    return response.data;
  }

  return undefined;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'code' in value &&
      'message' in value &&
      'data' in value
  );
}

function isHermesExplainResultResponse(value: unknown): value is HermesExplainResultResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HermesExplainResultResponse>;
  return (
    typeof candidate.answer === 'string' &&
    Array.isArray(candidate.key_findings) &&
    Array.isArray(candidate.risks_and_caveats) &&
    Array.isArray(candidate.suggested_next_steps) &&
    Array.isArray(candidate.recommended_actions)
  );
}

interface AIWorkbenchSessionSnapshot {
  messages: Message[];
  active_tab: 'chat' | 'capabilities' | 'history';
  selected_dataset_id?: string;
  active_relationship_set_id?: string;
  selected_analysis_history_id?: string;
  attached_result_summary?: SafeResultSummary;
  result_followup_prompts?: string[];
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
      selected_analysis_history_id:
        typeof parsed.selected_analysis_history_id === 'string'
          ? parsed.selected_analysis_history_id
          : undefined,
      attached_result_summary: parsed.attached_result_summary,
      result_followup_prompts: Array.isArray(parsed.result_followup_prompts)
        ? parsed.result_followup_prompts.filter((item): item is string => typeof item === 'string').slice(0, 6)
        : undefined,
      current_plan: parsed.current_plan ?? null,
      current_session_id:
        typeof parsed.current_session_id === 'string' ? parsed.current_session_id : undefined,
      plan_question: typeof parsed.plan_question === 'string' ? parsed.plan_question : '',
      main_layout: parsed.main_layout === 'vertical' ? 'vertical' : 'horizontal',
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
  const hermesStatus = useHermesStatus(isOpen);
  const runtimeProvider = getAssistantRuntimeProvider();

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
    restoredSession?.main_layout ?? 'horizontal'
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
  const [selectedAnalysisHistoryId, setSelectedAnalysisHistoryId] = useState<string | undefined>(
    restoredSession?.selected_analysis_history_id
  );
  const [attachedResultSummary, setAttachedResultSummary] = useState<SafeResultSummary | undefined>(
    restoredSession?.attached_result_summary
  );
  const [selectedAnalysisHistorySummary, setSelectedAnalysisHistorySummary] = useState<SafeResultSummary | undefined>(
    undefined
  );
  const [resultFollowupPrompts, setResultFollowupPrompts] = useState<string[]>(
    restoredSession?.result_followup_prompts ?? []
  );

  const assistantContext = useAssistantContext();
  const activeRelationshipSet = assistantContext.getActiveRelationshipSet();
  const datasetCatalog = useMemo(
    () => datasets.map((dataset) => inferDatasetCatalogMetadata(dataset)),
    [datasets]
  );
  const datasetSelectOptions = useMemo(
    () =>
      datasets.map((dataset) => {
        const catalog = inferDatasetCatalogMetadata(dataset);
        const categoryLabel = BUSINESS_CATEGORY_LABELS[catalog.business_category];
        const typeLabel = DATA_TYPE_LABELS[catalog.data_type];
        const analysisLabels = catalog.analysis_tags.map((tag) => ANALYSIS_TAG_LABELS[tag]);
        return {
          value: dataset.id,
          label: dataset.filename,
          description: `${dataset.row_count?.toLocaleString() ?? '-'} 行 · ${dataset.col_count ?? '-'} 列`,
          badges: [categoryLabel, typeLabel],
          keywords: [
            dataset.id,
            dataset.filename,
            categoryLabel,
            typeLabel,
            ...analysisLabels,
            ...(dataset.schema ?? []).map((field) => field.name),
          ],
        };
      }),
    [datasets]
  );
  const relationshipSetOptions = useMemo(
    () => [
      {
        value: '__none__',
        label: '不使用关系组',
        description: '仅使用当前数据集或目录候选，不附加关系组上下文。',
        keywords: ['不使用关系组', 'none'],
      },
      ...assistantContext.relationshipSets.map((set) => ({
        value: set.id,
        label: set.name,
        description: `${set.dataset_nodes.filter((node) => node.included_in_context).length} 张表 · ${set.relationships.length} 条关系${set.description ? ` · ${set.description}` : ''}`,
        badges: [`${set.relationships.length} 条关系`],
        keywords: [
          set.id,
          set.name,
          set.description,
          ...set.dataset_nodes.map((node) => node.dataset_name || node.filename || node.dataset_id),
        ].filter((item): item is string => Boolean(item)),
      })),
    ],
    [assistantContext.relationshipSets]
  );
  const activeResultSummary = useMemo(
    () => attachedResultSummary ?? selectedAnalysisHistorySummary ?? null,
    [attachedResultSummary, selectedAnalysisHistorySummary]
  );
  const planningDatasets = useMemo<PlanningDatasetMetadata[]>(
    () => {
      const catalogById = new Map(datasetCatalog.map((item) => [item.dataset_id, item]));
      return datasets.map((dataset) => {
        const catalog = catalogById.get(dataset.id);
        return {
          id: dataset.id,
          filename: dataset.filename,
          name: dataset.filename,
          schema: (dataset.schema ?? []).map((column) => ({
            name: column.name,
            dtype: column.dtype,
            semantic_type: column.semantic_type,
          })),
          business_category: catalog?.business_category,
          data_type: catalog?.data_type,
          analysis_tags: catalog?.analysis_tags ?? [],
          recommended_analyses: [],
          quality_warnings: [],
        };
      });
    },
    [datasetCatalog, datasets]
  );
  const runtimeContext = useMemo<AssistantRuntimeContext>(
    () => ({
      selected_dataset_ids: selectedDataset ? [selectedDataset] : [],
      selected_dataset_id: selectedDataset ?? undefined,
      confirmed_relationships: activeRelationshipSet?.relationships ?? [],
      relationship_set: activeRelationshipSet,
      available_dataset_nodes: activeRelationshipSet?.dataset_nodes ?? [],
      analysis_history_summary: activeResultSummary ?? undefined,
      dataset_catalog: datasetCatalog,
      datasets: planningDatasets,
    }),
    [
      activeRelationshipSet,
      activeResultSummary,
      datasetCatalog,
      planningDatasets,
      selectedDataset,
    ]
  );
  const handleSelectAnalysisHistory = useCallback((analysisId?: string) => {
    setSelectedAnalysisHistoryId(analysisId);
    if (analysisId) {
      setResultFollowupPrompts(DEFAULT_RESULT_FOLLOWUP_PROMPTS);
      return;
    }
    setSelectedAnalysisHistorySummary(undefined);
    setResultFollowupPrompts([]);
  }, []);
  const handleActiveResultSummaryChange = useCallback((summary?: SafeResultSummary) => {
    setSelectedAnalysisHistorySummary(summary);
  }, []);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearChatBottomRef = useRef(true);
  const forceScrollOnNextMessageRef = useRef(false);

  const isChatNearBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  }, []);

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      isNearChatBottomRef.current = true;
    });
  }, []);

  const forceNextMessageScroll = useCallback(() => {
    forceScrollOnNextMessageRef.current = true;
  }, []);

  const handleChatScroll = useCallback(() => {
    isNearChatBottomRef.current = isChatNearBottom();
  }, [isChatNearBottom]);

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
      selected_analysis_history_id: selectedAnalysisHistoryId,
      attached_result_summary: attachedResultSummary,
      result_followup_prompts: resultFollowupPrompts,
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
    attachedResultSummary,
    currentSessionId,
    generatedPlan,
    mainLayout,
    messages,
    planQuestion,
    resultFollowupPrompts,
    selectedAnalysisHistoryId,
    selectedDataset,
    showPreview,
  ]);

  // 自动滚动到底部
  useEffect(() => {
    const shouldForceScroll = forceScrollOnNextMessageRef.current;
    if (shouldForceScroll || isNearChatBottomRef.current) {
      scrollToLatestMessage(shouldForceScroll ? 'smooth' : 'auto');
    }
    forceScrollOnNextMessageRef.current = false;
  }, [messages, scrollToLatestMessage]);

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
    forceNextMessageScroll();
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
      forceNextMessageScroll();
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
    const userMessages: Message[] = [...currentMessages, userMessage];
    forceNextMessageScroll();
    updateCurrentSession(userMessages);

    try {
      const runtime = getAssistantRuntime();
      const response = await runtime.generateAnalysisPlan({
        question,
        context: runtimeContext,
      });

      const planMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `基于你的问题，我生成了以下分析计划：`,
        type: 'text',
        timestamp: new Date(),
        plan: response.plan,
      };

      const newMessages: Message[] = [...userMessages, planMessage];
      updateCurrentSession(newMessages);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '生成计划失败';
      const newMessages: Message[] = [...userMessages, {
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

  // 发送消息 — 路由到 runtime planning boundary，不直接调用分析执行接口
  const consumeWorkbenchHandoff = () => {
    const payload = readAIWorkbenchHandoff();
    if (!payload) return;

    if (payload.analysis_id) {
      setSelectedAnalysisHistoryId(payload.analysis_id);
    }
    if (payload.safe_result_summary) {
      setAttachedResultSummary(payload.safe_result_summary);
    }
    setResultFollowupPrompts(
      payload.suggested_prompts?.length ? payload.suggested_prompts : DEFAULT_RESULT_FOLLOWUP_PROMPTS
    );
    setActiveTab('chat');
    setShowPreview(true);
    addMessage({
      role: 'assistant',
      content:
        '当前结果已作为上下文加入 AI 工作台。系统不会自动重新运行分析，也不会自动生成解释。你可以继续问我：“帮我解释这个结果”或“下一步该怎么分析？”',
      type: 'text',
    });
    clearAIWorkbenchHandoff();
  };

  useEffect(() => {
    const handleHandoff = () => consumeWorkbenchHandoff();
    window.addEventListener(AI_WORKBENCH_HANDOFF_EVENT, handleHandoff);
    if (isOpen) consumeWorkbenchHandoff();
    return () => window.removeEventListener(AI_WORKBENCH_HANDOFF_EVENT, handleHandoff);
  }, [isOpen, messages]);

  const buildResultFollowupContent = async (
    userMessage: string,
    summary: SafeResultSummary,
    followupIntent: ReturnType<typeof detectResultFollowupIntent>
  ): Promise<string> => {
    const fallback = () => buildResultFollowupResponse(summary, followupIntent);

    if (!canUseHermesLiveResultExplainer(hermesStatus)) {
      return fallback();
    }

    try {
      const contextDatasetId = summary.dataset_id ?? selectedDataset ?? undefined;
      const contextDataset = contextDatasetId
        ? datasets.find((dataset) => dataset.id === contextDatasetId)
        : undefined;
      const response = await assistantApi.explainResultWithHermes({
        user_question: userMessage,
        result_summary: summary,
        assistant_context: {
          selected_dataset_id: contextDatasetId,
          selected_dataset_name: summary.dataset_name ?? contextDataset?.filename,
          active_relationship_set_id: activeRelationshipSet?.id,
          active_relationship_set_name: activeRelationshipSet?.name,
          relationship_count: activeRelationshipSet?.relationships.length,
          reference_dataset_count: activeRelationshipSet?.dataset_nodes.filter(
            (node) => node.role === 'isolated' || node.role === 'reference_only'
          ).length,
        },
        safety: {
          allow_raw_data: false,
          allow_auto_run: false,
          allow_sql_generation: false,
          allow_dataset_mutation: false,
        },
      });
      const payload = unwrapApiData<HermesExplainResultResponse>(response);
      if (!isHermesExplainResultResponse(payload) || payload.fallback_used) {
        return `${fallback()}\n\nHermes live explanation unavailable; using local deterministic fallback.`;
      }
      return formatHermesExplainResult(payload);
    } catch {
      return `${fallback()}\n\nHermes live explanation unavailable; using local deterministic fallback.`;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    const followupIntent = detectResultFollowupIntent(userMsg);
    if (followupIntent !== 'unknown') {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMsg,
        timestamp: new Date(),
      };
      const userMessages: Message[] = [...messages, userMessage];
      forceNextMessageScroll();
      updateCurrentSession(userMessages);
      setIsLoading(true);
      try {
        const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: activeResultSummary
          ? await buildResultFollowupContent(userMsg, activeResultSummary, followupIntent)
          : '我还没有看到需要解释的分析结果。请先从历史结果中选择一条，或从结果页点击「带到 AI 工作台 / 让 AI 解读这个结果」。',
        type: 'text',
        timestamp: new Date(),
      };
        updateCurrentSession([...userMessages, responseMessage]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    generatePlanForQuestion(userMsg);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;
    setInputValue(prompt);
    inputRef.current?.focus();

    const followupIntent = detectResultFollowupIntent(prompt);
    if (followupIntent === 'unknown') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    const userMessages: Message[] = [...messages, userMessage];
    setInputValue('');
    forceNextMessageScroll();
    updateCurrentSession(userMessages);
    setIsLoading(true);

    try {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: activeResultSummary
          ? await buildResultFollowupContent(prompt, activeResultSummary, followupIntent)
          : '我还没有看到需要解释的分析结果。请先从历史结果中选择一条，或从结果页点击「带到 AI 工作台 / 让 AI 解读这个结果」。',
        type: 'text',
        timestamp: new Date(),
      };
      updateCurrentSession([...userMessages, responseMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 使用能力卡片 — 数据集依赖型能力需先选数据集
  const handleCapability = (cap: AnalysisCapability) => {
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
      const runtime = getAssistantRuntime();
      const response = await runtime.generateAnalysisPlan({
        question: planQuestion.trim(),
        context: runtimeContext,
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
      setShowPreview(true);
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
        {/* ========== 上下布局：数据预览在上方 ========== */}
        {mainLayout === 'vertical' && showPreview && (
          <AIWorkbenchContextPanel
            selectedDatasetId={selectedDataset ?? undefined}
            selectedDatasetName={datasets.find((dataset) => dataset.id === selectedDataset)?.filename}
            activeRelationshipSet={activeRelationshipSet}
            datasets={datasets}
            layoutMode={mainLayout}
            onSelectDataset={(datasetId) => setSelectedDataset(datasetId)}
            selectedAnalysisHistoryId={selectedAnalysisHistoryId}
            attachedResultSummary={attachedResultSummary}
            onSelectAnalysisHistory={handleSelectAnalysisHistory}
            onActiveResultSummaryChange={handleActiveResultSummaryChange}
            onClearAttachedResultSummary={() => {
              setAttachedResultSummary(undefined);
              if (!selectedAnalysisHistorySummary) setResultFollowupPrompts([]);
            }}
          />
        )}

        {/* ========== AI 对话区域 ========== */}
        <div className={cn(
          "flex flex-col min-h-0 overflow-hidden",
          mainLayout === 'horizontal' ? "w-[62%]" : "flex-1"
        )}>
          {/* 头部 */}
          <div className="flex h-[68px] items-center gap-3 px-4 border-b border-[var(--border-subtle)] flex-shrink-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={onClose}
                aria-label="关闭 AI 工作台"
                className={cn(
                  "h-9 w-9 shrink-0 flex items-center justify-center",
                  "rounded-xl border border-white/10",
                  "bg-white/5 text-[var(--text-secondary)]",
                  "hover:bg-white/10 hover:text-white hover:border-white/20",
                  "transition-colors"
                )}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 shrink-0 flex items-center justify-center">
                <AssistantAvatar variant="default" size="sm" className="shrink-0" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h2 className="truncate text-base font-semibold leading-none text-[var(--text-primary)]">AI 工作台</h2>
                <p
                  className="mt-1 truncate text-[10px] leading-none text-[var(--text-muted)]"
                  title={hermesStatus.message || 'Hermes 状态仅用于诊断，不会改变当前运行时'}
                >
                  {getHermesDiagnosticLabel(hermesStatus, runtimeProvider)}
                </p>
              </div>
            </div>
            
            {/* 数据集选择 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Database className="w-4 h-4 text-[var(--text-muted)]" />
              <SearchableSelect
                className="w-[190px]"
                value={selectedDataset ?? undefined}
                options={datasetSelectOptions}
                placeholder="选择或搜索数据集..."
                searchPlaceholder="选择或搜索数据集..."
                emptyText="未找到匹配的数据集"
                allowClear
                onChange={(value) => setSelectedDataset(value ?? null)}
              />
            </div>

            {/* 关系组选择 */}
            <div className="flex items-center gap-2 flex-shrink-0" title="关系组用于告诉助手哪些表关系可以作为分析上下文；不会自动 join。">
              <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
              <SearchableSelect
                className="w-[220px]"
                value={assistantContext.activeRelationshipSetId || '__none__'}
                options={relationshipSetOptions}
                placeholder="选择或搜索关系组..."
                searchPlaceholder="选择或搜索关系组..."
                emptyText="未找到匹配的关系组"
                onChange={(value) =>
                  assistantContext.setActiveRelationshipSet(!value || value === '__none__' ? undefined : value)
                }
              />
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
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4" ref={scrollRef} onScroll={handleChatScroll}>
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
                  <div ref={messagesEndRef} aria-hidden="true" />

                </div>

                {/* 快速提示芯片 */}
                {!isLoading && (
                  <div className="px-4 pt-3 pb-0 flex-shrink-0">
                    <div className="flex flex-wrap gap-2">
                      {(activeResultSummary
                        ? resultFollowupPrompts.length > 0
                          ? resultFollowupPrompts
                          : DEFAULT_RESULT_FOLLOWUP_PROMPTS
                        : [
                            '预测未来销售额趋势',
                            '分析各渠道转化率',
                            '生成数据质量检查计划',
                            '统计各列描述性指标',
                            '分析用户行为路径',
                          ]
                      ).map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => {
                            void handleQuickPrompt(prompt);
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
                          输入业务问题，系统会生成一份需要你确认的结构化分析计划。
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
                            '用什么图展示销售额变化？',
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
                            onClick={() => handleCapability(cap)}
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
        {mainLayout === 'horizontal' && (
          <AIWorkbenchContextPanel
            selectedDatasetId={selectedDataset ?? undefined}
            selectedDatasetName={datasets.find((dataset) => dataset.id === selectedDataset)?.filename}
            activeRelationshipSet={activeRelationshipSet}
            datasets={datasets}
            layoutMode={mainLayout}
            onSelectDataset={(datasetId) => setSelectedDataset(datasetId)}
            selectedAnalysisHistoryId={selectedAnalysisHistoryId}
            attachedResultSummary={attachedResultSummary}
            onSelectAnalysisHistory={handleSelectAnalysisHistory}
            onActiveResultSummaryChange={handleActiveResultSummaryChange}
            onClearAttachedResultSummary={() => {
              setAttachedResultSummary(undefined);
              if (!selectedAnalysisHistorySummary) setResultFollowupPrompts([]);
            }}
          />
        )}

      </motion.div>
    </div>
  );
}

export default AIWorkspace;
