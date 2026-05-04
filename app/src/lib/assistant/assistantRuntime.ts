/**
 * Assistant Runtime Types
 *
 * Abstract boundary between AI Workbench UI and the assistant backend/runtime.
 *
 * Current runtime: ruleBasedAssistantRuntime
 * Future runtimes: hermesAssistantRuntime, llmAssistantRuntime
 *
 * The UI (AIWorkspace) calls AssistantRuntime methods; it does not know
 * which concrete runtime is active.
 */

import type {
  AssistantAnalysisPlan,
  TableRelationship,
  DatasetProfile,
  RelationshipSet,
  RelationshipSetDatasetNode,
} from '@/types/assistant';
import type { SafeResultSummary } from '@/types/resultSummary';

export type AssistantRuntimeMode = 'rule_based' | 'hermes' | 'llm';

/* ------------------------------------------------------------------ */
/*  Messages                                                           */
/* ------------------------------------------------------------------ */

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export interface AssistantContext {
  /** IDs of all datasets the user has access to */
  selected_dataset_ids: string[];
  /** Primary dataset the user has selected (if any) */
  selected_dataset_id?: string;
  /** User-confirmed table relationships */
  confirmed_relationships: TableRelationship[];
  /** Active topic-scoped relationship set, used as allowed context graph only */
  relationship_set?: RelationshipSet;
  /** Dataset nodes available from the active relationship set context */
  available_dataset_nodes?: RelationshipSetDatasetNode[];
  /** Optional dataset profiles (metadata only) */
  dataset_profiles?: DatasetProfile[];
  /** Optional lightweight dataset schema info for planning */
  datasets?: Array<{
    id: string;
    filename?: string;
    name?: string;
    schema?: Array<{ name: string; semantic_type?: string }>;
  }>;
  /** Optional bounded summary of selected analysis history context; no raw result tables */
  analysis_history_summary?: SafeResultSummary;
}

/* ------------------------------------------------------------------ */
/*  Plan generation                                                    */
/* ------------------------------------------------------------------ */

export interface AssistantPlanRequest {
  question: string;
  context: AssistantContext;
}

export interface AssistantPlanResponse {
  plan: AssistantAnalysisPlan;
  runtime_mode: AssistantRuntimeMode;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Error explanation                                                  */
/* ------------------------------------------------------------------ */

export interface AssistantErrorExplainRequest {
  raw_error: string;
  user_action?: string;
  current_page?: string;
  dataset_id?: string;
  analysis_type?: string;
}

export interface AssistantErrorExplainResponse {
  title: string;
  summary: string;
  likely_causes: string[];
  suggested_fixes: string[];
}

/* ------------------------------------------------------------------ */
/*  Result explanation                                                 */
/* ------------------------------------------------------------------ */

export interface AssistantResultExplainRequest {
  analysis_id?: string;
  result?: unknown;
}

export interface AssistantResultExplainResponse {
  summary: string;
  key_findings: string[];
  caveats: string[];
}

/* ------------------------------------------------------------------ */
/*  Runtime interface                                                  */
/* ------------------------------------------------------------------ */

export interface AssistantRuntime {
  mode: AssistantRuntimeMode;

  generateAnalysisPlan(request: AssistantPlanRequest): Promise<AssistantPlanResponse>;

  /** Optional: explain an error in human-friendly terms */
  explainError?(request: AssistantErrorExplainRequest): Promise<AssistantErrorExplainResponse>;

  /** Optional: explain analysis results */
  explainResult?(request: AssistantResultExplainRequest): Promise<AssistantResultExplainResponse>;
}
