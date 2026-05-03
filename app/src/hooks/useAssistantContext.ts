/**
 * useAssistantContext — browser-local assistant metadata context.
 *
 * Relationship sets are the primary model. The old flat confirmed edge list is
 * migrated once into a named legacy set and is no longer written.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  RelationshipSet,
  RelationshipSetDatasetNode,
  TableRelationship,
} from '@/types/assistant';

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

function getIncludedNodeDatasetIds(nodes: RelationshipSetDatasetNode[]): string[] {
  return nodes
    .filter((node) => node.included_in_context)
    .map((node) => node.dataset_id);
}

function uniqueDatasetIds(
  relationships: TableRelationship[],
  nodes: RelationshipSetDatasetNode[] = [],
  datasetIds: string[] = []
): string[] {
  return Array.from(
    new Set([
      ...getDatasetIds(relationships),
      ...getIncludedNodeDatasetIds(nodes),
      ...datasetIds,
    ].filter(Boolean))
  );
}

function relationshipEndpointNames(
  relationships: TableRelationship[]
): Map<string, { dataset_name?: string; filename?: string }> {
  const names = new Map<string, { dataset_name?: string; filename?: string }>();
  for (const rel of relationships) {
    if (!names.has(rel.source_dataset_id)) {
      names.set(rel.source_dataset_id, {
        dataset_name: rel.source_dataset_name,
        filename: rel.source_dataset_name,
      });
    }
    if (!names.has(rel.target_dataset_id)) {
      names.set(rel.target_dataset_id, {
        dataset_name: rel.target_dataset_name,
        filename: rel.target_dataset_name,
      });
    }
  }
  return names;
}

function deriveDatasetNodes(
  relationships: TableRelationship[],
  datasetIds: string[] = [],
  reason = '从旧版已确认关系迁移'
): RelationshipSetDatasetNode[] {
  const endpointNames = relationshipEndpointNames(relationships);
  const ids = uniqueDatasetIds(relationships, [], datasetIds);
  return ids.map((datasetId) => {
    const names = endpointNames.get(datasetId);
    return {
      dataset_id: datasetId,
      dataset_name: names?.dataset_name,
      filename: names?.filename,
      role: 'connected',
      reason,
      selected_by_user: false,
      joinable: true,
      included_in_context: true,
    };
  });
}

function normalizeDatasetNode(raw: unknown): RelationshipSetDatasetNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<RelationshipSetDatasetNode>;
  if (typeof item.dataset_id !== 'string') return null;
  const role =
    item.role === 'isolated' ||
    item.role === 'excluded' ||
    item.role === 'reference_only' ||
    item.role === 'connected'
      ? item.role
      : 'connected';
  return {
    dataset_id: item.dataset_id,
    dataset_name: typeof item.dataset_name === 'string' ? item.dataset_name : undefined,
    filename: typeof item.filename === 'string' ? item.filename : undefined,
    role,
    reason: typeof item.reason === 'string' ? item.reason : undefined,
    selected_by_user: Boolean(item.selected_by_user),
    joinable: typeof item.joinable === 'boolean' ? item.joinable : role === 'connected',
    included_in_context:
      typeof item.included_in_context === 'boolean'
        ? item.included_in_context
        : role !== 'excluded',
  };
}

function normalizeDatasetNodesForSet(
  relationships: TableRelationship[],
  rawNodes: unknown,
  rawDatasetIds: unknown
): RelationshipSetDatasetNode[] {
  const datasetIds = Array.isArray(rawDatasetIds)
    ? rawDatasetIds.filter((id): id is string => typeof id === 'string')
    : [];
  const normalized = Array.isArray(rawNodes)
    ? rawNodes
        .map(normalizeDatasetNode)
        .filter((node): node is RelationshipSetDatasetNode => Boolean(node))
    : [];

  if (normalized.length > 0) {
    const missing = uniqueDatasetIds(relationships, [], datasetIds).filter(
      (id) => !normalized.some((node) => node.dataset_id === id)
    );
    if (missing.length === 0) return normalized;
    return [
      ...normalized,
      ...deriveDatasetNodes(relationships, missing, '从旧版关系组字段迁移'),
    ];
  }

  return deriveDatasetNodes(relationships, datasetIds);
}

function mergeConnectedNodesForRelationships(
  existingNodes: RelationshipSetDatasetNode[],
  relationships: TableRelationship[]
): RelationshipSetDatasetNode[] {
  const nodes = [...existingNodes];
  const names = relationshipEndpointNames(relationships);
  for (const datasetId of getDatasetIds(relationships)) {
    if (nodes.some((node) => node.dataset_id === datasetId)) continue;
    const nodeNames = names.get(datasetId);
    nodes.push({
      dataset_id: datasetId,
      dataset_name: nodeNames?.dataset_name,
      filename: nodeNames?.filename,
      role: 'connected',
      reason: '由已确认关系连接',
      selected_by_user: false,
      joinable: true,
      included_in_context: true,
    });
  }
  return nodes;
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
  const dataset_nodes = normalizeDatasetNodesForSet(
    item.relationships,
    (item as Partial<RelationshipSet>).dataset_nodes,
    item.dataset_ids
  );
  return {
    id: item.id,
    name: item.name,
    description: typeof item.description === 'string' ? item.description : undefined,
    relationships: item.relationships,
    dataset_nodes,
    dataset_ids: uniqueDatasetIds(item.relationships, dataset_nodes),
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
  const relationships = legacyRelationships.map((rel) => ({
    ...rel,
    status: 'confirmed' as const,
    confirmed_at: rel.confirmed_at || now,
  }));
  const dataset_nodes = deriveDatasetNodes(
    relationships,
    getDatasetIds(relationships),
    '从旧版已确认关系迁移'
  );
  return [
    {
      id: 'legacy_confirmed_relationships',
      name: '旧版已确认关系',
      description: '从旧版全局已确认关系自动迁移而来。',
      relationships,
      dataset_nodes,
      dataset_ids: uniqueDatasetIds(relationships, dataset_nodes),
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
  dataset_nodes?: RelationshipSetDatasetNode[];
}

export interface AssistantContext {
  relationshipSets: RelationshipSet[];
  activeRelationshipSetId?: string;
  confirmedRelationships: TableRelationship[];
  rejectedRelationshipIds: string[];
  createRelationshipSet: (input: CreateRelationshipSetInput) => RelationshipSet;
  updateRelationshipSet: (
    id: string,
    patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships' | 'dataset_nodes'>>
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
    const dataset_nodes = mergeConnectedNodesForRelationships(
      input.dataset_nodes ?? [],
      relationships
    );
    const hasCustom = relationships.some((rel) => rel.is_custom || rel.risk_level === 'high');
    const set: RelationshipSet = {
      id: createId('relset'),
      name: input.name.trim() || '未命名关系组',
      description: input.description?.trim() || undefined,
      relationships,
      dataset_nodes,
      dataset_ids: uniqueDatasetIds(relationships, dataset_nodes),
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
      patch: Partial<Pick<RelationshipSet, 'name' | 'description' | 'relationships' | 'dataset_nodes'>>
    ) => {
      setRelationshipSets((prev) =>
        prev.map((set) => {
          if (set.id !== id) return set;
          const relationships = patch.relationships ?? set.relationships;
          const dataset_nodes = mergeConnectedNodesForRelationships(
            patch.dataset_nodes ?? set.dataset_nodes ?? [],
            relationships
          );
          return {
            ...set,
            ...patch,
            name: patch.name?.trim() || set.name,
            description:
              patch.description !== undefined
                ? patch.description.trim() || undefined
                : set.description,
            relationships,
            dataset_nodes,
            dataset_ids: uniqueDatasetIds(relationships, dataset_nodes),
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
