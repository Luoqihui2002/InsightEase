import type {
  AnalysisFieldRequirement,
  AnalysisPrefillPayload,
  RecommendedAnalysisType,
} from '@/types/assistant';

const PREFILL_KEY_PREFIX = 'insightease_analysis_prefill_';
const PREFILL_TTL_MS = 24 * 60 * 60 * 1000;

const ANALYSIS_TYPES: RecommendedAnalysisType[] = [
  'descriptive',
  'data_overview',
  'attribution',
  'forecast',
  'path_analysis',
  'ab_test',
  'regression',
  'smart_process',
  'visualization',
];

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function makePrefillKey(payload: AnalysisPrefillPayload): string {
  const safePlanId = payload.plan_id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${PREFILL_KEY_PREFIX}${safePlanId}_${Date.now()}_${suffix}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysisFieldRequirementArray(value: unknown): value is AnalysisFieldRequirement[] {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    const field = item as Partial<AnalysisFieldRequirement>;
    return (
      typeof field.role === 'string' &&
      typeof field.required === 'boolean' &&
      isStringArray(field.candidate_columns) &&
      typeof field.reason === 'string'
    );
  });
}

function isValidPayload(value: unknown): value is AnalysisPrefillPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AnalysisPrefillPayload>;
  const createdAt = payload.created_at ? Date.parse(payload.created_at) : Number.NaN;

  return (
    payload.source === 'ai_workbench' &&
    typeof payload.plan_id === 'string' &&
    ANALYSIS_TYPES.includes(payload.analysis_type as RecommendedAnalysisType) &&
    isStringArray(payload.dataset_ids) &&
    (payload.primary_dataset_id === undefined || typeof payload.primary_dataset_id === 'string') &&
    (payload.relationship_set_id === undefined || typeof payload.relationship_set_id === 'string') &&
    (payload.relationship_set_name === undefined || typeof payload.relationship_set_name === 'string') &&
    (payload.user_question === undefined || typeof payload.user_question === 'string') &&
    isAnalysisFieldRequirementArray(payload.suggested_fields) &&
    Number.isFinite(createdAt) &&
    Date.now() - createdAt <= PREFILL_TTL_MS
  );
}

export function saveAnalysisPrefill(payload: AnalysisPrefillPayload): string {
  const key = makePrefillKey(payload);
  if (!canUseSessionStorage()) return key;

  window.sessionStorage.setItem(key, JSON.stringify(payload));
  return key;
}

export function readAnalysisPrefill(key: string): AnalysisPrefillPayload | null {
  if (!key || !canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidPayload(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function clearAnalysisPrefill(key: string): void {
  if (!key || !canUseSessionStorage()) return;
  window.sessionStorage.removeItem(key);
}

export function getSuggestedColumns(
  payload: AnalysisPrefillPayload | null,
  role: AnalysisFieldRequirement['role']
): string[] {
  if (!payload?.suggested_fields) return [];
  return payload.suggested_fields
    .filter((field) => field.role === role)
    .flatMap((field) => field.candidate_columns);
}

export function getFirstExactSuggestedColumn(
  payload: AnalysisPrefillPayload | null,
  role: AnalysisFieldRequirement['role'],
  availableColumns: string[]
): string | undefined {
  const available = new Set(availableColumns);
  return getSuggestedColumns(payload, role).find((column) => available.has(column));
}
