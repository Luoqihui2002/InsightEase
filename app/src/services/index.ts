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
  localStorageService, 
  LocalStorageService 
} from './local-storage.service';
export type { 
  ProcessingResult, 
  LocalStorageStatus 
} from './local-storage.service';
