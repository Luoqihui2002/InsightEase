import type { AssistantAnalysisPlan } from './assistant';
import type { SafeResultSummary } from './resultSummary';

export type HermesMode = 'disabled' | 'dry_run' | 'live';
export type HermesProvider = 'hermes' | 'mock' | 'disabled';
export type HermesConfidence = 'low' | 'medium' | 'high';
export type HermesAvailability =
  | 'disabled'
  | 'dry_run'
  | 'live_configured'
  | 'live_available'
  | 'live_unavailable'
  | 'misconfigured';

export interface HermesSupports {
  explain_result: boolean;
  plan_analysis: boolean;
  explain_error: boolean;
  tool_calls: boolean;
}

export interface HermesStatusResponse {
  enabled: boolean;
  provider: HermesProvider;
  mode: HermesMode;
  supports: HermesSupports;
  available?: boolean;
  availability?: HermesAvailability;
  platform?: string;
  message?: string;
}

export interface HermesSafetyFlags {
  allow_raw_data: false;
  allow_auto_run: false;
  allow_sql_generation: false;
  allow_dataset_mutation: false;
}

export interface HermesPlanSafetyFlags extends HermesSafetyFlags {
  require_user_confirmation_for_execution: true;
}

export interface HermesExplainResultRequest {
  user_question: string;
  result_summary: SafeResultSummary;
  assistant_context?: {
    selected_dataset_id?: string;
    selected_dataset_name?: string;
    active_relationship_set_id?: string;
    active_relationship_set_name?: string;
    relationship_count?: number;
    reference_dataset_count?: number;
  };
  safety: HermesSafetyFlags;
}

export interface HermesRecommendedAction {
  label: string;
  action_type:
    | 'navigate'
    | 'generate_plan'
    | 'ask_clarifying_question'
    | 'requires_confirmation';
  target?: string;
  reason?: string;
}

export interface HermesExplainResultResponse {
  answer: string;
  key_findings: string[];
  risks_and_caveats: string[];
  suggested_next_steps: string[];
  recommended_actions: HermesRecommendedAction[];
  confidence?: HermesConfidence;
  fallback_used?: boolean;
}

export interface HermesPlanAnalysisRequest {
  user_question: string;
  assistant_context: Record<string, unknown>;
  safety: HermesPlanSafetyFlags;
}

export interface HermesPlanAnalysisResponse {
  plan: AssistantAnalysisPlan | Record<string, unknown>;
  clarifying_questions?: string[];
  warnings: string[];
  confidence?: HermesConfidence;
  fallback_used?: boolean;
}
