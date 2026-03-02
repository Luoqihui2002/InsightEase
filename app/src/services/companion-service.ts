/**
 * AI 陪伴服务 - 主动引导用户
 * 
 * 策略：平衡触发（关键节点提示）+ 混合内容（规则+AI）
 */

import { aiApi } from '@/api/ai';
import { localStorageService } from './local-storage.service';

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

// 触发器配置
interface TriggerConfig {
  id: string;
  condition: (ctx: UserContext) => boolean;
  cooldown: number; // 冷却时间（毫秒）
  priority: number;
  getContent: (ctx: UserContext) => Promise<CompanionState> | CompanionState;
}

// 内容模板（规则部分）
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
    mood: 'thinking',
    message: `📊 收到 "${ctx.dataInfo?.fileName}"！共 ${ctx.dataInfo?.rowCount} 行数据。要我帮你快速分析一下吗？`,
    suggestions: [
      { id: 'auto-analyze', label: '🔍 自动洞察', action: 'auto-analyze' },
      { id: 'workshop', label: '⚙️ 进入数据工坊', action: 'goto-workshop' },
      { id: 'later', label: '稍后再说', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),

  'idle-with-data': (ctx) => ({
    visible: true,
    mood: 'tip',
    message: '💡 小提示：你可以用「数据工坊」进行多步骤处理，或者用「分析」功能快速获取洞察。',
    suggestions: [
      { id: 'workshop', label: '⚙️ 打开数据工坊', action: 'goto-workshop' },
      { id: 'analysis', label: '📈 快速分析', action: 'goto-analysis' },
      { id: 'dismiss', label: '知道了', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),

  'large-file': (ctx) => ({
    visible: true,
    mood: 'tip',
    message: `⚡ 检测到大文件（${ctx.dataInfo?.rowCount} 行）。已自动启用 DuckDB 高性能引擎，处理速度会更快哦！`,
    suggestions: [
      { id: 'ok', label: '👍 明白了', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),

  'security-mode-enabled': () => ({
    visible: true,
    mood: 'happy',
    message: '🔒 安全模式已开启！你的数据将只保存在本地浏览器，不会上传到任何服务器。',
    suggestions: [
      { id: 'learn', label: '了解更多', action: 'learn-security' },
      { id: 'ok', label: '好的', action: 'dismiss' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),

  'error-help': () => ({
    visible: true,
    mood: 'tip',
    message: '❌ 看起来遇到了一些问题。需要我帮你排查一下吗？',
    suggestions: [
      { id: 'help', label: '🆘 寻求帮助', action: 'open-help' },
      { id: 'report', label: '🐛 反馈问题', action: 'report-bug' },
    ],
    position: 'bottom-right',
    canDismiss: true,
  }),
};

// AI 动态生成内容
async function generateAIContent(ctx: UserContext): Promise<CompanionState> {
  const prompt = `作为 InsightEase 数据助手，根据以下用户状态，生成一句友好的提示语（不超过50字）和2-3个操作建议：

用户状态：
- 当前页面：${ctx.page}
- 是否有数据：${ctx.hasData ? '是' : '否'}
- 数据规模：${ctx.dataInfo ? `${ctx.dataInfo.rowCount}行×${ctx.dataInfo.colCount}列` : '无'}
- 最近操作：${ctx.recentAction || '无'}
- 闲置时间：${Math.round(ctx.idleTime / 1000)}秒

请返回JSON格式：
{
  "message": "提示语",
  "suggestions": [{"label": "按钮文字", "action": "操作标识"}]
}`;

  try {
    // 这里可以调用AI API，暂时用模拟实现
    // const response = await aiApi.chat(prompt);
    
    // 模拟AI响应（实际项目中替换为真实API调用）
    const mockResponses: CompanionState[] = [
      {
        visible: true,
        mood: 'thinking',
        message: '🔍 我注意到你有销售数据，试试「关联分析」找出商品间的购买规律？',
        suggestions: [
          { id: '关联', label: '🔍 关联分析', action: 'goto-association' },
          { id: '聚类', label: '📊 客户分群', action: 'goto-clustering' },
        ],
        position: 'bottom-right',
        canDismiss: true,
      },
      {
        visible: true,
        mood: 'tip',
        message: '💡 发现你的数据有时间字段，可以做趋势预测哦！',
        suggestions: [
          { id: 'forecast', label: '📈 趋势预测', action: 'goto-forecast' },
          { id: 'dismiss', label: '暂时不需要', action: 'dismiss' },
        ],
        position: 'bottom-right',
        canDismiss: true,
      },
    ];
    
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  } catch (e) {
    // AI失败时返回默认提示
    return CONTENT_TEMPLATES['idle-with-data'](ctx);
  }
}

class CompanionService {
  private triggers: TriggerConfig[] = [
    {
      id: 'first-visit',
      condition: (ctx) => ctx.visitCount === 1 && ctx.page === 'dashboard',
      cooldown: Infinity, // 只触发一次
      priority: 10,
      getContent: () => CONTENT_TEMPLATES['first-visit'](),
    },
    {
      id: 'upload-complete',
      condition: (ctx) => ctx.recentAction === 'upload' && ctx.hasData,
      cooldown: process.env.NODE_ENV === 'development' ? 10000 : 5 * 60 * 1000, // 开发环境10秒，生产5分钟
      priority: 9,
      getContent: (ctx) => CONTENT_TEMPLATES['upload-complete'](ctx),
    },
    {
      id: 'large-file',
      condition: (ctx) => ctx.recentAction === 'upload' && (ctx.dataInfo?.rowCount || 0) > 50000,
      cooldown: 10 * 60 * 1000, // 10分钟
      priority: 8,
      getContent: (ctx) => CONTENT_TEMPLATES['large-file'](ctx),
    },
    {
      id: 'security-mode-enabled',
      condition: (ctx) => ctx.recentAction === 'enable-security-mode',
      cooldown: 24 * 60 * 60 * 1000, // 24小时
      priority: 8,
      getContent: () => CONTENT_TEMPLATES['security-mode-enabled'](),
    },
    {
      id: 'idle-with-data',
      condition: (ctx) => ctx.idleTime > 60000 && ctx.hasData && ctx.page === 'datasets',
      cooldown: 3 * 60 * 1000, // 3分钟
      priority: 5,
      getContent: (ctx) => generateAIContent(ctx),
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
  private idleTimer: number | null = null;

  constructor() {
    this.loadState();
    this.startIdleTracking();
    this.incrementVisitCount();
  }

  // 状态持久化
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

  // 访问计数
  private incrementVisitCount() {
    const count = parseInt(localStorage.getItem('insightease_visit_count') || '0');
    localStorage.setItem('insightease_visit_count', String(count + 1));
    this.userContext.visitCount = count + 1;
  }

  // 闲置时间追踪
  private startIdleTracking() {
    let lastActivity = Date.now();
    
    const resetIdle = () => {
      lastActivity = Date.now();
      this.userContext.idleTime = 0;
    };

    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      window.addEventListener(event, resetIdle);
    });

    this.idleTimer = window.setInterval(() => {
      this.userContext.idleTime = Date.now() - lastActivity;
      this.checkTriggers();
    }, 5000);
  }

  // 订阅状态变化
  subscribe(listener: (state: CompanionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentState));
  }

  // 更新用户上下文
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

  // 检查触发器
  private async checkTriggers() {
    // 如果当前正在显示且不可关闭，不触发新的
    if (this.currentState.visible && !this.currentState.canDismiss) {
      return;
    }

    const now = Date.now();
    const sortedTriggers = [...this.triggers].sort((a, b) => b.priority - a.priority);

    for (const trigger of sortedTriggers) {
      // 检查冷却时间
      const lastTime = this.lastTriggerTime[trigger.id] || 0;
      if (now - lastTime < trigger.cooldown) {
        continue;
      }

      // 检查条件
      if (trigger.condition(this.userContext)) {
        // 触发
        const content = await trigger.getContent(this.userContext);
        this.currentState = content;
        this.lastTriggerTime[trigger.id] = now;
        this.saveState();
        this.notify();
        return; // 一次只触发一个
      }
    }
  }

  // 用户操作
  dismiss() {
    this.currentState = { ...this.currentState, visible: false };
    this.notify();
  }

  async executeAction(action: string): Promise<void> {
    this.dismiss();

    switch (action) {
      case 'start-tour':
        // 启动引导流程
        window.dispatchEvent(new CustomEvent('companion-action', { detail: { type: 'tour' } }));
        break;
      case 'goto-upload':
        window.location.href = '/app/upload';
        break;
      case 'goto-workshop':
        window.location.href = '/app/data-workshop';
        break;
      case 'goto-analysis':
        window.location.href = '/app/smart-analysis';
        break;
      case 'auto-analyze':
        // 跳转到智能分析向导页面
        window.location.href = '/app/smart-analysis';
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

  // 手动显示（用于开发测试）
  show(templateId: keyof typeof CONTENT_TEMPLATES) {
    const content = CONTENT_TEMPLATES[templateId](this.userContext);
    this.currentState = content;
    this.notify();
  }

  // 获取当前状态
  getState(): CompanionState {
    return this.currentState;
  }

  // 销毁
  destroy() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
    }
  }

  // 调试：清除所有冷却时间
  debugResetCooldowns() {
    this.lastTriggerTime = {};
    this.saveState();
    console.log('[AI Companion] 冷却时间已重置');
  }

  // 调试：获取当前上下文
  debugGetContext() {
    return { ...this.userContext };
  }
}

export const companionService = new CompanionService();
export default companionService;

// 暴露到全局便于调试
if (typeof window !== 'undefined') {
  (window as any).companionDebug = companionService;
}
