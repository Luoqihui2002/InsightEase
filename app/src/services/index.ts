/**
 * Services 模块导出
 */

// NOTE: Browser-local processing (legacy/browser-processing) has been removed in Phase 3E-2B.
// All data processing now uses backend APIs exclusively.

// AI Companion 服务
export { companionService } from './companion-service';
export type { 
  CompanionState,
  CompanionMood,
  CompanionSuggestion,
  UserContext
} from './companion-service';
