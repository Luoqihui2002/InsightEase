/**
 * DataWorkshop 前端操作 -> 后端 Transform API 操作适配器
 * Phase 3D-2
 */

import type { WorkshopOperation } from '@/types/workshop';

export interface AdapterResult {
  operations: WorkshopOperation[];
  unsupported: string[];
}

/**
 * 将 DataWorkshop 操作链映射为后端 WorkshopOperation[]
 * @param operations DataWorkshop 操作列表
 * @param initialColumns 初始列名（用于 transform.remove -> select 转换）
 */
export function mapDataWorkshopOperationsToBackend(
  operations: Array<{ type: string; config: Record<string, any> }>,
  initialColumns: string[]
): AdapterResult {
  const backendOps: WorkshopOperation[] = [];
  const unsupported: string[] = [];
  let currentColumns = [...initialColumns];

  for (const op of operations) {
    switch (op.type) {
      case 'filter':
        backendOps.push({ type: 'filter', config: op.config as any });
        break;

      case 'dedup': {
        const cfg = op.config;
        backendOps.push({
          type: 'dedup',
          config: {
            columns: cfg.columns || [],
            keep: cfg.keep || 'first',
            case_sensitive: cfg.caseSensitive !== false,
          },
        });
        break;
      }

      case 'sample':
        backendOps.push({ type: 'sample', config: op.config as any });
        break;

      case 'derive': {
        const cfg = op.config;
        backendOps.push({
          type: 'derive',
          config: { newColumn: cfg.newColumn, formula: cfg.formula },
        });
        if (cfg.newColumn && !currentColumns.includes(cfg.newColumn)) {
          currentColumns.push(cfg.newColumn);
        }
        break;
      }

      case 'transform': {
        const cfg = op.config;
        const actions = cfg.actions || [];
        for (const action of actions) {
          switch (action.type) {
            case 'rename': {
              const mappings = (action.mappings || []).map((m: any) => ({
                old: m.oldName || m.old,
                new: m.newName || m.new,
              }));
              if (mappings.length > 0) {
                backendOps.push({ type: 'rename', config: { mappings } });
                currentColumns = currentColumns.map(c => {
                  const m = mappings.find((x: any) => x.old === c);
                  return m ? m.new : c;
                });
              }
              break;
            }
            case 'remove': {
              const colsToRemove = new Set(action.columns || []);
              const keepColumns = currentColumns.filter(c => !colsToRemove.has(c));
              if (keepColumns.length > 0) {
                backendOps.push({ type: 'select', config: { columns: keepColumns } });
                currentColumns = keepColumns;
              }
              break;
            }
            default:
              unsupported.push(`transform.${action.type}`);
              break;
          }
        }
        break;
      }

      case 'join':
        unsupported.push('join');
        break;
      case 'pivot':
        unsupported.push('pivot');
        break;
      case 'reshape':
        unsupported.push('reshape');
        break;
      case 'output':
        unsupported.push('output');
        break;
      default:
        unsupported.push(op.type);
        break;
    }
  }

  return { operations: backendOps, unsupported };
}
