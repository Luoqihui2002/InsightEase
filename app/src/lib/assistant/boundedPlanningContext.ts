import type { AssistantContext } from './assistantRuntime';
import type {
  BoundedPlanningContext,
  PlanningDatasetMetadata,
} from '@/types/assistant';

const MAX_DATASETS = 20;
const MAX_COLUMNS_PER_DATASET = 100;
const MAX_TOTAL_COLUMNS = 500;
const MAX_RELATIONSHIPS = 200;

export function buildBoundedPlanningContext(context: AssistantContext): BoundedPlanningContext {
  const datasets = context.datasets ?? [];
  const catalogById = new Map(
    (context.dataset_catalog ?? []).map((item) => [item.dataset_id, item])
  );
  const profileById = new Map(
    (context.dataset_profiles ?? []).map((item) => [item.dataset_id, item])
  );

  const priorityIds = uniqueStrings([
    context.selected_dataset_id,
    ...context.selected_dataset_ids,
    ...(context.available_dataset_nodes ?? [])
      .filter((node) => node.included_in_context)
      .map((node) => node.dataset_id),
    ...datasets.map((dataset) => dataset.id),
  ]).slice(0, MAX_DATASETS);
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));

  let remainingColumns = MAX_TOTAL_COLUMNS;
  const boundedDatasets: PlanningDatasetMetadata[] = [];
  for (const datasetId of priorityIds) {
    const dataset = datasetById.get(datasetId);
    if (!dataset) continue;
    const profile = profileById.get(datasetId);
    const catalog = catalogById.get(datasetId);
    const profileColumns = new Map(
      (profile?.columns ?? []).map((column) => [column.name, column])
    );
    const schema = dataset.schema
      .slice(0, Math.min(MAX_COLUMNS_PER_DATASET, remainingColumns))
      .map((column) => {
        const profileColumn = profileColumns.get(column.name);
        return {
          name: column.name,
          dtype: column.dtype,
          semantic_type: profileColumn?.semantic_type ?? column.semantic_type,
          role: profileColumn?.role ?? column.role,
          null_rate: profileColumn?.null_rate,
          unique_rate: profileColumn?.unique_rate,
        };
      });
    remainingColumns -= schema.length;
    boundedDatasets.push({
      id: dataset.id,
      name: dataset.name,
      filename: dataset.filename,
      schema,
      table_type: profile?.classification.table_type,
      business_category: catalog?.business_category,
      data_type: catalog?.data_type,
      analysis_tags: catalog?.analysis_tags ?? dataset.analysis_tags ?? [],
      recommended_analyses:
        profile?.classification.recommended_analyses ?? dataset.recommended_analyses ?? [],
      quality_warnings: profile?.quality_warnings ?? dataset.quality_warnings ?? [],
    });
    if (remainingColumns <= 0) break;
  }

  const includedIds = new Set(boundedDatasets.map((dataset) => dataset.id));
  const relationshipSet = context.relationship_set;
  const boundedRelationshipSet = relationshipSet
    ? {
        id: relationshipSet.id,
        name: relationshipSet.name,
        dataset_nodes: relationshipSet.dataset_nodes
          .filter((node) => node.included_in_context && includedIds.has(node.dataset_id))
          .map((node) => ({
            dataset_id: node.dataset_id,
            dataset_name: node.dataset_name ?? node.filename,
            role:
              node.role === 'connected'
                ? 'connected' as const
                : node.role === 'isolated'
                  ? 'isolated' as const
                  : 'reference_only' as const,
            joinable: node.role === 'connected' && node.joinable,
          })),
        relationships: relationshipSet.relationships
          .filter(
            (relationship) =>
              relationship.status === 'confirmed' &&
              includedIds.has(relationship.source_dataset_id) &&
              includedIds.has(relationship.target_dataset_id)
          )
          .slice(0, MAX_RELATIONSHIPS)
          .map((relationship) => ({
            id: relationship.id,
            source_dataset_id: relationship.source_dataset_id,
            source_column: relationship.source_column,
            target_dataset_id: relationship.target_dataset_id,
            target_column: relationship.target_column,
            relationship_type: relationship.relationship_type,
            risk_level: relationship.risk_level,
            status: 'confirmed' as const,
          })),
      }
    : undefined;

  return {
    selected_dataset_ids: context.selected_dataset_ids.filter((id) => includedIds.has(id)),
    selected_dataset_id:
      context.selected_dataset_id && includedIds.has(context.selected_dataset_id)
        ? context.selected_dataset_id
        : undefined,
    datasets: boundedDatasets,
    relationship_set: boundedRelationshipSet,
    analysis_history_summary: context.analysis_history_summary,
  };
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
