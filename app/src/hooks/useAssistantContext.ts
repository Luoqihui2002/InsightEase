/**
 * useAssistantContext — 轻量级助手上下文状态管理
 *
 * 管理跨 AI Workbench 能力共享的状态：
 *   - 已确认的表关系 (confirmed relationships)
 *   - 已忽略的表关系 ID (rejected relationship ids)
 *
 * 持久化：localStorage（前端-only，安全校验）
 *
 * 语义说明：
 *   - 已确认关系是数据集级别的本地助手上下文，不是对话消息。
 *   - 新对话不会清除已确认关系。
 *   - 用户可以随时取消确认或清空全部状态。
 *   - 传递给规划器时，只传递与当前选中数据集相关的已确认关系。
 */

import { useState, useEffect, useCallback } from 'react';
import type { TableRelationship } from '@/types/assistant';

const CONFIRMED_KEY = 'insightease_assistant_confirmed_relationships';
const REJECTED_KEY = 'insightease_assistant_rejected_relationship_ids';

function isValidRelationship(r: unknown): r is TableRelationship {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof (r as Record<string, unknown>).id === 'string' &&
    typeof (r as Record<string, unknown>).source_dataset_id === 'string' &&
    typeof (r as Record<string, unknown>).target_dataset_id === 'string' &&
    typeof (r as Record<string, unknown>).source_column === 'string' &&
    typeof (r as Record<string, unknown>).target_column === 'string'
  );
}

function loadConfirmed(): TableRelationship[] {
  try {
    const raw = localStorage.getItem(CONFIRMED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isValidRelationship)) {
      return parsed;
    }
  } catch {
    // ignore corrupt data
  }
  return [];
}

function loadRejected(): string[] {
  try {
    const raw = localStorage.getItem(REJECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed;
    }
  } catch {
    // ignore corrupt data
  }
  return [];
}

function saveConfirmed(list: TableRelationship[]) {
  localStorage.setItem(CONFIRMED_KEY, JSON.stringify(list));
}

function saveRejected(ids: string[]) {
  localStorage.setItem(REJECTED_KEY, JSON.stringify(ids));
}

export interface AssistantContext {
  confirmedRelationships: TableRelationship[];
  rejectedRelationshipIds: string[];
  confirmRelationship: (rel: TableRelationship) => void;
  rejectRelationship: (rel: TableRelationship) => void;
  resetRelationship: (rel: TableRelationship) => void;
  clearConfirmedRelationships: () => void;
  clearRejectedRelationships: () => void;
  clearAllRelationshipState: () => void;
  getConfirmedForDatasets: (datasetIds: string[]) => TableRelationship[];
  isConfirmed: (relId: string) => boolean;
  isRejected: (relId: string) => boolean;
}

export function useAssistantContext(): AssistantContext {
  const [confirmed, setConfirmed] = useState<TableRelationship[]>(loadConfirmed);
  const [rejected, setRejected] = useState<string[]>(loadRejected);

  // Persist on change
  useEffect(() => {
    saveConfirmed(confirmed);
  }, [confirmed]);

  useEffect(() => {
    saveRejected(rejected);
  }, [rejected]);

  const confirmRelationship = useCallback((rel: TableRelationship) => {
    setConfirmed((prev) => {
      const filtered = prev.filter((r) => r.id !== rel.id);
      return [...filtered, rel];
    });
    setRejected((prev) => prev.filter((id) => id !== rel.id));
  }, []);

  const rejectRelationship = useCallback((rel: TableRelationship) => {
    setRejected((prev) => {
      if (prev.includes(rel.id)) return prev;
      return [...prev, rel.id];
    });
    setConfirmed((prev) => prev.filter((r) => r.id !== rel.id));
  }, []);

  const resetRelationship = useCallback((rel: TableRelationship) => {
    setConfirmed((prev) => prev.filter((r) => r.id !== rel.id));
    setRejected((prev) => prev.filter((id) => id !== rel.id));
  }, []);

  const clearConfirmedRelationships = useCallback(() => {
    setConfirmed([]);
  }, []);

  const clearRejectedRelationships = useCallback(() => {
    setRejected([]);
  }, []);

  const clearAllRelationshipState = useCallback(() => {
    setConfirmed([]);
    setRejected([]);
  }, []);

  /**
   * Get confirmed relationships scoped to the given dataset IDs.
   *
   * Scoping rules:
   *   - 0 datasets → return []
   *   - 1 dataset  → return relationships touching that dataset (source OR target)
   *   - 2+ datasets → return relationships where BOTH endpoints are in the selected set
   */
  const getConfirmedForDatasets = useCallback(
    (datasetIds: string[]) => {
      if (datasetIds.length === 0) return [];
      const idSet = new Set(datasetIds);
      if (datasetIds.length === 1) {
        return confirmed.filter(
          (r) => idSet.has(r.source_dataset_id) || idSet.has(r.target_dataset_id)
        );
      }
      return confirmed.filter(
        (r) => idSet.has(r.source_dataset_id) && idSet.has(r.target_dataset_id)
      );
    },
    [confirmed]
  );

  const isConfirmed = useCallback(
    (relId: string) => confirmed.some((r) => r.id === relId),
    [confirmed]
  );

  const isRejected = useCallback(
    (relId: string) => rejected.includes(relId),
    [rejected]
  );

  return {
    confirmedRelationships: confirmed,
    rejectedRelationshipIds: rejected,
    confirmRelationship,
    rejectRelationship,
    resetRelationship,
    clearConfirmedRelationships,
    clearRejectedRelationships,
    clearAllRelationshipState,
    getConfirmedForDatasets,
    isConfirmed,
    isRejected,
  };
}
