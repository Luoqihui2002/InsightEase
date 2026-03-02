/**
 * Services 模块导出
 */

export { engineSelector, EngineSelector } from './engine-selector';
export type { 
  EngineType, 
  OperationComplexity, 
  EngineDecision, 
  ThresholdConfig 
} from './engine-selector';

export { 
  db, 
  compression, 
  datasetStorage, 
  operationChainStorage, 
  apiCache, 
  storageManager 
} from './db';
export type { 
  StoredDataset, 
  StoredOperationChain, 
  StoredVisualization,
  APICacheEntry 
} from './db';

export { 
  localStorageService
} from './local-storage.service';
export type { 
  ProcessingResult, 
  LocalStorageStatus 
} from './local-storage.service';

// Phase 2.2: DuckDB-WASM 服务
export {
  initDuckDB,
  importToDuckDB,
  queryDuckDB,
  executeWithDuckDB,
  isDuckDBAvailable,
  waitForDuckDB,
  terminateWorker,
  onDuckDBStatusChange,
  getDuckDBStatus,
} from './duckdb-service';
export type { DuckDBStatus } from './duckdb-service';

// AI Companion 服务
export { companionService } from './companion-service';
export type { 
  CompanionState,
  CompanionMood,
  CompanionSuggestion,
  UserContext
} from './companion-service';
