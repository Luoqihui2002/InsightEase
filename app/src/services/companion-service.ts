/**
 * AI Companion Service — 极简事件通知 + 路由导航
 *
 * 公开 API（被多页面调用，勿删）：
 *   setPage(page)          — 页面挂载时上报当前页
 *   updateContext(update)  — 更新上下文
 *   recordAction(action, dataInfo) — 记录用户行为（如上传完成）
 *   dismiss()              — 关闭当前通知
 *   executeAction(action)  — 执行通知按钮动作
 *   subscribe(listener)    — 订阅状态变化
 *   getState()             — 获取当前状态
 *
 * 状态模型：
 *   visible = false  → companion 仅显示启动器
 *   visible = true   → companion 显示紧凑通知卡片
 *
 * 禁止行为：
 *   不实现聊天/输入/打字态
 *   不实现胶囊/长条/变形 UI
 *   不调用 LLM
 */

export type CompanionMood = 'idle' | 'thinking' | 'happy' | 'tip';
export type CompanionPosition = 'bottom-right' | 'dock';

export interface CompanionSuggestion {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface CompanionState {
  visible: boolean;
  mood: CompanionMood;
  message: string;
  suggestions: CompanionSuggestion[];
  position: CompanionPosition;
  canDismiss: boolean;
}

export interface UserContext {
  page: string;
  hasData: boolean;
  dataInfo?: {
    rowCount: number;
    colCount: number;
    fileName: string;
  };
  recentAction?: string;
  idleTime: number;
  visitCount: number;
}

interface TriggerConfig {
  id: string;
  condition: (ctx: UserContext) => boolean;
  cooldown: number;
  priority: number;
  getContent: (ctx: UserContext) => CompanionState;
}

// 内容模板
const CONTENT_TEMPLATES: Record<string, (ctx: UserContext) => CompanionState> = {
  'first-visit': () => ({
    visible: true,
    mood: 'happy',
    message: '👋 欢迎来到 InsightEase！我是你的数据分析助手。需要我带你快速了解一下吗？',
    suggestions: [
      { id: 'tour', label: '✨ 带我看看', action: 'start-tour' },
      { id: 'upload', label: '📁 直接上传数据', action: 'goto-upload' },
      { id: 'skip', label: '我自己探索', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),

  'upload-complete': (ctx) => ({
    visible: true,
    mood: 'happy',
    message: `📊 收到 "${ctx.dataInfo?.fileName}"！共 ${ctx.dataInfo?.rowCount?.toLocaleString() ?? '-'} 行数据。`,
    suggestions: [
      { id: 'datasets', label: '查看数据理解', action: 'goto-datasets' },
      { id: 'workshop', label: '⚙️ 进入数据工坊', action: 'goto-workshop' },
      { id: 'later', label: '稍后再说', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),
};

class CompanionService {
  private triggers: TriggerConfig[] = [
    {
      id: 'first-visit',
      condition: (ctx) => ctx.visitCount === 1 && ctx.page === 'dashboard',
      cooldown: Infinity,
      priority: 10,
      getContent: (_ctx) => CONTENT_TEMPLATES['first-visit'](_ctx),
    },
    {
      id: 'upload-complete',
      condition: (ctx) => ctx.recentAction === 'upload' && ctx.hasData,
      cooldown: import.meta.env.DEV ? 10000 : 5 * 60 * 1000,
      priority: 9,
      getContent: (ctx) => CONTENT_TEMPLATES['upload-complete'](ctx),
    },
  ];

  private lastTriggerTime: Record<string, number> = {};
  private currentState: CompanionState = {
    visible: false,
    mood: 'idle',
    message: '',
    suggestions: [],
    position: 'bottom-right',
    canDismiss: true,
  };
  private listeners: Set<(state: CompanionState) => void> = new Set();
  private userContext: UserContext = {
    page: '',
    hasData: false,
    idleTime: 0,
    visitCount: 0,
  };

  constructor() {
    this.loadState();
    this.incrementVisitCount();
  }

  // 状态持久化（仅冷却时间）
  private loadState() {
    const saved = localStorage.getItem('insightease_companion');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.lastTriggerTime = data.lastTriggerTime || {};
      } catch {}
    }
  }

  private saveState() {
    localStorage.setItem('insightease_companion', JSON.stringify({
      lastTriggerTime: this.lastTriggerTime,
    }));
  }

  private incrementVisitCount() {
    const count = parseInt(localStorage.getItem('insightease_visit_count') || '0');
    localStorage.setItem('insightease_visit_count', String(count + 1));
    this.userContext.visitCount = count + 1;
  }

  subscribe(listener: (state: CompanionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentState));
  }

  updateContext(update: Partial<UserContext>) {
    this.userContext = { ...this.userContext, ...update };
    this.checkTriggers();
  }

  setPage(page: string) {
    this.userContext.page = page;
    this.checkTriggers();
  }

  recordAction(action: string, dataInfo?: UserContext['dataInfo']) {
    this.userContext.recentAction = action;
    if (dataInfo) {
      this.userContext.dataInfo = dataInfo;
      this.userContext.hasData = true;
    }
    this.checkTriggers();
  }

  private checkTriggers() {
    if (this.currentState.visible && !this.currentState.canDismiss) {
      return;
    }

    const now = Date.now();
    const sorted = [...this.triggers].sort((a, b) => b.priority - a.priority);

    for (const trigger of sorted) {
      const lastTime = this.lastTriggerTime[trigger.id] || 0;
      if (now - lastTime < trigger.cooldown) continue;
      if (trigger.condition(this.userContext)) {
        this.currentState = trigger.getContent(this.userContext);
        this.lastTriggerTime[trigger.id] = now;
        this.saveState();
        this.notify();
        return;
      }
    }
  }

  dismiss() {
    this.currentState = { ...this.currentState, visible: false };
    this.notify();
  }

  executeAction(action: string): void {
    this.dismiss();

    switch (action) {
      case 'open-chat':
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: 'open-chat' } }));
        break;
      case 'start-tour':
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: 'tour' } }));
        break;
      case 'goto-upload':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/upload' } }));
        break;
      case 'goto-datasets':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/datasets' } }));
        break;
      case 'goto-workshop':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/data-workshop' } }));
        break;
      case 'goto-analysis':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/smart-analysis' } }));
        break;
      case 'auto-analyze':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/smart-analysis' } }));
        break;
      case 'goto-forecast':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/forecast' } }));
        break;
      case 'goto-clustering':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/statistics' } }));
        break;
      case 'goto-association':
        window.dispatchEvent(new CustomEvent('companion-navigate', { detail: { path: '/app/statistics' } }));
        break;
      case 'learn-security':
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: 'learn-security' } }));
        break;
      case 'open-help':
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: 'open-help' } }));
        break;
      case 'report-bug':
        window.open('https://github.com/your-repo/issues', '_blank');
        break;
      default:
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: action } }));
    }
  }

  // 手动显示（开发测试）
  show(templateId: keyof typeof CONTENT_TEMPLATES) {
    const content = CONTENT_TEMPLATES[templateId](this.userContext);
    this.currentState = content;
    this.notify();
  }

  getState(): CompanionState {
    return this.currentState;
  }
}

export const companionService = new CompanionService();
export default companionService;
