/**
 * useAssistantContext — browser-local assistant metadata context.
 *
 * Relationship sets are the primary model. The old flat confirmed edge list is
 * migrated once into a named legacy set and is no longer written.
 */

import { useState, useEffect, useCallback } from 'react';
import type { RelationshipSet, TableRelationship } from '@/types/assistant';

const LEGACY_CONFIRMED_KEY = 'insightease_assistant_confirmed_relationships';
const LEGACY_REJECTED_KEY = 'insightease_assistant_rejected_relationship_ids';
const RELATIONSHIP_SETS_KEY = 'insightease_assistant_relationship_sets';
const ACTIVE_SET_KEY = 'insightease_assistant_active_relationship_set_id';

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

function getDatasetIds(relationships: TableRelationship[]): string[] {
  return Array.from(
    new Set(
      relationships.flatMap((rel) => [rel.source_dataset_id, rel.target_dataset_id])
    )
  );
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRelationshipSet(raw: unknown): RelationshipSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<RelationshipSet>;
  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    !Array.isArray(item.relationships) ||
    !item.relationships.every(isValidRelationship)
  ) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: item.id,
    name: item.name,
    description: typeof item.description === 'string' ? item.description : undefined,
    relationships: item.relationships,
    dataset_ids: Array.isArray(item.dataset_ids)
      ? item.dataset_ids.filter((id): id is string => typeof id === 'string')
      : getDatasetIds(item.relationships),
    created_at: typeof item.created_at === 'string' ? item.created_at : now,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : now,
    is_default: item.is_default,
    source: item.source === 'manual' || item.source === 'mixed' ? item.source : 'inferred',
  };
}

function loadLegacyConfirmed(): TableRelationship[] {
  try {
    const raw = localStorage.getItem(LEGACY_CONFIRMED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isValidRelationship)) {
      return parsed;
    }
  } catch {
    // ignore corrupt legacy data
  }
  return [];
}

function loadLegacyRejected(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_REJECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed;
    }
  } catch {
    // ignore corrupt legacy data
  }
  return [];
}

function loadRelationshipSets(): RelationshipSet[] {
  try {
    const raw = localStorage.getItem(RELATIONSHIP_SETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeRelationshipSet)
          .filter((set): set is RelationshipSet => Boolean(set));
      }
    }
  } catch {
    // ignore corrupt set data
  }

  const legacyRelationships = loadLegacyConfirmed();
  if (legacyRelationships.length === 0) return [];

  const now = new Date().toISOString();
  return [
    {
      id: 'legacy_confirmed_relationships',
      name: '旧版已确认关系',
      description: '从旧版全局已确认关系自动迁移而来。',
      relationships: legacyRelationships.map((rel) => ({
        ...rel,
        status: 'confirmed',
        confirmed_at: rel.confirmed_at || now,
      })),
      dataset_ids: getDatasetIds(legacyRelationships),
      created_at: now,
      updated_at: now,
      is_default: true,
      source: 'inferred',
    },
  ];
}

function loadActiveRelationshipSetId(sets: RelationshipSet[]): string | undefined {
  try {
    const saved = localStorage.getItem(ACTIVE_SET_KEY) || undefined;
    if (saved && sets.some((set) => set.id === saved)) return saved;
  } catch {
    // ignore corrupt active id
  }
  return sets[0]?.id;
}

function saveRelationshipSets(sets: RelationshipSet[]) {
  localStorage.setItem(RELATIONSHIP_SETS_KEY, JSON.stringify(sets));
}

function saveActiveRelationshipSetId(id?: string) {
  if (id) {
    localStorage.setItem(ACTIVE_SET_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SET_KEY);
  }
}

export interface CreateRelationshipSetInput {
  name: string;
  description?: string;
  relationships: TableRelationship[];
}

export interface AssistantContext {
  relationshipSets: RelationshipSet[];
  activeRelationshipSetId?: string;
  confirmedRelationships: TableRelationship[];
  rejectedRelationshipIds: string[];
  createRelationshipSet: (input: CreateRelationshipSetInput) => RelationshipSet;
  updateRelationshipSet: (
    id: string,
    patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships'>>
  ) => void;
  deleteRelationshipSet: (id: string) => void;
  setActiveRelationshipSet: (id?: string) => void;
  getActiveRelationshipSet: () => RelationshipSet | undefined;
  getRelationshipsForActiveSet: () => TableRelationship[];
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
  const [relationshipSets, setRelationshipSets] = useState<RelationshipSet[]>(loadRelationshipSets);
  const [activeRelationshipSetId, setActiveRelationshipSetIdState] = useState<string | undefined>(() =>
    loadActiveRelationshipSetId(loadRelationshipSets())
  );
  const [rejected, setRejected] = useState<string[]>(loadLegacyRejected);

  useEffect(() => {
    saveRelationshipSets(relationshipSets);
  }, [relationshipSets]);

  useEffect(() => {
    saveActiveRelationshipSetId(activeRelationshipSetId);
  }, [activeRelationshipSetId]);

  useEffect(() => {
    if (
      activeRelationshipSetId &&
      !relationshipSets.some((set) => set.id === activeRelationshipSetId)
    ) {
      setActiveRelationshipSetIdState(relationshipSets[0]?.id);
    }
  }, [activeRelationshipSetId, relationshipSets]);

  const getActiveRelationshipSet = useCallback(
    () => relationshipSets.find((set) => set.id === activeRelationshipSetId),
    [activeRelationshipSetId, relationshipSets]
  );

  const getRelationshipsForActiveSet = useCallback(
    () => getActiveRelationshipSet()?.relationships ?? [],
    [getActiveRelationshipSet]
  );

  const setActiveRelationshipSet = useCallback(
    (id?: string) => {
      if (id && !relationshipSets.some((set) => set.id === id)) return;
      setActiveRelationshipSetIdState(id);
    },
    [relationshipSets]
  );

  const createRelationshipSet = useCallback((input: CreateRelationshipSetInput) => {
    const now = new Date().toISOString();
    const relationships = input.relationships.map((rel) => ({
      ...rel,
      status: 'confirmed' as const,
      confirmed_at: rel.confirmed_at || now,
    }));
    const hasCustom = relationships.some((rel) => rel.is_custom || rel.risk_level === 'high');
    const set: RelationshipSet = {
      id: createId('relset'),
      name: input.name.trim() || '未命名关系组',
      description: input.description?.trim() || undefined,
      relationships,
      dataset_ids: getDatasetIds(relationships),
      created_at: now,
      updated_at: now,
      source: hasCustom ? 'mixed' : 'inferred',
    };

    setRelationshipSets((prev) => [set, ...prev]);
    setActiveRelationshipSetIdState(set.id);
    return set;
  }, []);

  const updateRelationshipSet = useCallback(
    (
      id: string,
      patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships'>>
    ) => {
      setRelationshipSets((prev) =>
        prev.map((set) => {
          if (set.id !== id) return set;
          const relationships = patch.relationships ?? set.relationships;
          return {
            ...set,
            ...patch,
            name: patch.name?.trim() || set.name,
            description:
              patch.description !== undefined
                ? patch.description.trim() || undefined
                : set.description,
            relationships,
            dataset_ids: getDatasetIds(relationships),
            updated_at: new Date().toISOString(),
            source: relationships.some((rel) => rel.is_custom || rel.risk_level === 'high')
              ? 'mixed'
              : set.source,
          };
        })
      );
    },
    []
  );

  const deleteRelationshipSet = useCallback(
    (id: string) => {
      setRelationshipSets((prev) => {
        const next = prev.filter((set) => set.id !== id);
        if (activeRelationshipSetId === id) {
          setActiveRelationshipSetIdState(next[0]?.id);
        }
        return next;
      });
    },
    [activeRelationshipSetId]
  );

  const confirmRelationship = useCallback(
    (rel: TableRelationship) => {
      const now = new Date().toISOString();
      const confirmedRel: TableRelationship = {
        ...rel,
        status: 'confirmed',
        confirmed_at: rel.confirmed_at || now,
      };

      if (activeRelationshipSetId) {
        updateRelationshipSet(activeRelationshipSetId, {
          relationships: [
            ...getRelationshipsForActiveSet().filter((r) => r.id !== rel.id),
            confirmedRel,
          ],
        });
      } else {
        createRelationshipSet({
          name: '临时已确认关系',
          description: '由兼容确认操作创建。建议重命名为明确的关系组。',
          relationships: [confirmedRel],
        });
      }
      setRejected((prev) => prev.filter((id) => id !== rel.id));
    },
    [
      activeRelationshipSetId,
      createRelationshipSet,
      getRelationshipsForActiveSet,
      updateRelationshipSet,
    ]
  );

  const rejectRelationship = useCallback((rel: TableRelationship) => {
    setRejected((prev) => (prev.includes(rel.id) ? prev : [...prev, rel.id]));
  }, []);

  const resetRelationship = useCallback(
    (rel: TableRelationship) => {
      if (activeRelationshipSetId) {
        updateRelationshipSet(activeRelationshipSetId, {
          relationships: getRelationshipsForActiveSet().filter((r) => r.id !== rel.id),
        });
      }
      setRejected((prev) => prev.filter((id) => id !== rel.id));
    },
    [activeRelationshipSetId, getRelationshipsForActiveSet, updateRelationshipSet]
  );

  const clearConfirmedRelationships = useCallback(() => {
    if (!activeRelationshipSetId) return;
    updateRelationshipSet(activeRelationshipSetId, { relationships: [] });
  }, [activeRelationshipSetId, updateRelationshipSet]);

  const clearRejectedRelationships = useCallback(() => {
    setRejected([]);
  }, []);

  const clearAllRelationshipState = useCallback(() => {
    setRelationshipSets([]);
    setActiveRelationshipSetIdState(undefined);
    setRejected([]);
  }, []);

  const getConfirmedForDatasets = useCallback(
    (datasetIds: string[]) => {
      const relationships = getRelationshipsForActiveSet();
      if (datasetIds.length === 0) return [];
      const idSet = new Set(datasetIds);
      if (datasetIds.length === 1) {
        return relationships.filter(
          (r) => idSet.has(r.source_dataset_id) || idSet.has(r.target_dataset_id)
        );
      }
      return relationships.filter(
        (r) => idSet.has(r.source_dataset_id) && idSet.has(r.target_dataset_id)
      );
    },
    [getRelationshipsForActiveSet]
  );

  const isConfirmed = useCallback(
    (relId: string) => getRelationshipsForActiveSet().some((r) => r.id === relId),
    [getRelationshipsForActiveSet]
  );

  const isRejected = useCallback((relId: string) => rejected.includes(relId), [rejected]);

  return {
    relationshipSets,
    activeRelationshipSetId,
    confirmedRelationships: getRelationshipsForActiveSet(),
    rejectedRelationshipIds: rejected,
    createRelationshipSet,
    updateRelationshipSet,
    deleteRelationshipSet,
    setActiveRelationshipSet,
    getActiveRelationshipSet,
    getRelationshipsForActiveSet,
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
