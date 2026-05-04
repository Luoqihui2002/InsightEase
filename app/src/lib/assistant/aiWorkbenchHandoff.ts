import type { SafeResultSummary } from '@/types/resultSummary';

export const AI_WORKBENCH_HANDOFF_STORAGE_KEY = 'insightease_ai_workbench_handoff';
export const AI_WORKBENCH_OPEN_EVENT = 'insightease:open-ai-workbench';
export const AI_WORKBENCH_HANDOFF_EVENT = 'insightease:ai-workbench-handoff';

const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export interface AIWorkbenchHandoffPayload {
  source: 'analysis_result' | 'history';
  analysis_id?: string;
  safe_result_summary?: SafeResultSummary;
  suggested_prompts?: string[];
  created_at: string;
}

export const DEFAULT_RESULT_FOLLOWUP_PROMPTS = [
  '帮我解释这个结果',
  '指出这个结果里的异常和风险',
  '下一步建议做什么分析',
  '帮我整理成一段报告文字',
];

export function saveAIWorkbenchHandoff(payload: AIWorkbenchHandoffPayload): void {
  try {
    sessionStorage.setItem(AI_WORKBENCH_HANDOFF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Handoff is a convenience path; ignore quota/private-mode failures.
  }
}

export function readAIWorkbenchHandoff(): AIWorkbenchHandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(AI_WORKBENCH_HANDOFF_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AIWorkbenchHandoffPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.source !== 'analysis_result' && parsed.source !== 'history') return null;
    if (typeof parsed.created_at !== 'string') return null;

    const createdAt = new Date(parsed.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > HANDOFF_TTL_MS) {
      clearAIWorkbenchHandoff();
      return null;
    }

    return {
      source: parsed.source,
      analysis_id: typeof parsed.analysis_id === 'string' ? parsed.analysis_id : undefined,
      safe_result_summary: isSafeResultSummary(parsed.safe_result_summary)
        ? parsed.safe_result_summary
        : undefined,
      suggested_prompts: Array.isArray(parsed.suggested_prompts)
        ? parsed.suggested_prompts.filter((item): item is string => typeof item === 'string').slice(0, 6)
        : undefined,
      created_at: parsed.created_at,
    };
  } catch {
    return null;
  }
}

export function clearAIWorkbenchHandoff(): void {
  try {
    sessionStorage.removeItem(AI_WORKBENCH_HANDOFF_STORAGE_KEY);
  } catch {
    // Non-critical cleanup only.
  }
}

export function dispatchAIWorkbenchHandoff(payload: AIWorkbenchHandoffPayload): void {
  saveAIWorkbenchHandoff(payload);
  window.dispatchEvent(new CustomEvent(AI_WORKBENCH_HANDOFF_EVENT, { detail: payload }));
  window.dispatchEvent(new CustomEvent(AI_WORKBENCH_OPEN_EVENT));
}

function isSafeResultSummary(value: unknown): value is SafeResultSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SafeResultSummary>;
  return (
    typeof candidate.analysis_id === 'string' &&
    typeof candidate.analysis_type === 'string' &&
    typeof candidate.status === 'string' &&
    Array.isArray(candidate.result_keys) &&
    Array.isArray(candidate.metrics) &&
    Array.isArray(candidate.tables) &&
    Array.isArray(candidate.charts) &&
    Array.isArray(candidate.warnings)
  );
}
