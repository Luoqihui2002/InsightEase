/**
 * useAssistantContext — 轻量级助手上下文状态管理
 *
 * 管理跨 AI Workbench 能力共享的状态：
 *   - 已确认的表关系 (confirmed relationships)
 *   - 已忽略的表关系 ID (rejected relationship ids)
 *
 * 持久化：localStorage（前端-only，安全校验）
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

  const getConfirmedForDatasets = useCallback(
    (datasetIds: string[]) => {
      const idSet = new Set(datasetIds);
      return confirmed.filter(
        (r) => idSet.has(r.source_dataset_id) || idSet.has(r.target_dataset_id)
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
    getConfirmedForDatasets,
    isConfirmed,
    isRejected,
  };
}
