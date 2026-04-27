/**
 * Services 模块导出
 */

// LEGACY: Browser-local processing modules have been moved to src/legacy/browser-processing/.
// Main path must NOT import from the legacy directory.
// If DataWorkshop or other experimental features still need them,
// import directly from @/legacy/browser-processing/ (never from @/services).

// AI Companion 服务
export { companionService } from './companion-service';
export type { 
  CompanionState,
  CompanionMood,
  CompanionSuggestion,
  UserContext
} from './companion-service';
