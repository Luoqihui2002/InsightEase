/**
 * Safe Tool Registry
 *
 * Contract for all assistant tools. Each tool declares:
 * - What it does
 * - Whether it needs user confirmation before running
 * - Whether it is already implemented
 * - Side-effect level (none → read → execute → write)
 *
 * This registry is used by the UI to decide:
 * - Which tools to show in capability lists
 * - Which actions require an explicit user click
 * - Which tools are safe to call automatically
 *
 * Safety rule: no tool with side_effect_level "execute" or "write"
 * may be called without explicit user confirmation.
 */

export type AssistantToolName =
  | 'profile_dataset'
  | 'infer_relationships'
  | 'generate_analysis_plan'
  | 'navigate_to_module'
  | 'explain_result'
  | 'explain_error'
  | 'preview_join'
  | 'run_analysis';

export interface AssistantToolDefinition {
  name: AssistantToolName;
  description: string;
  requires_confirmation: boolean;
  implemented: boolean;
  side_effect_level: 'none' | 'read' | 'execute' | 'write';
}

export const ASSISTANT_TOOL_REGISTRY: AssistantToolDefinition[] = [
  {
    name: 'profile_dataset',
    description: '读取数据集元数据画像（表类型、字段角色、数据质量）',
    requires_confirmation: false,
    implemented: true,
    side_effect_level: 'read',
  },
  {
    name: 'infer_relationships',
    description: '基于元数据推断多张数据表之间的关联关系',
    requires_confirmation: false,
    implemented: true,
    side_effect_level: 'read',
  },
  {
    name: 'generate_analysis_plan',
    description: '根据用户问题生成结构化分析计划',
    requires_confirmation: false,
    implemented: true,
    side_effect_level: 'none',
  },
  {
    name: 'navigate_to_module',
    description: '导航到指定分析模块页面',
    requires_confirmation: false,
    implemented: true,
    side_effect_level: 'none',
  },
  {
    name: 'explain_result',
    description: '解释分析结果的含义和关键发现',
    requires_confirmation: false,
    implemented: false,
    side_effect_level: 'none',
  },
  {
    name: 'explain_error',
    description: '解释错误原因并提供修复建议',
    requires_confirmation: false,
    implemented: false,
    side_effect_level: 'none',
  },
  {
    name: 'preview_join',
    description: '预览多表 join 后的数据结果',
    requires_confirmation: true,
    implemented: false,
    side_effect_level: 'execute',
  },
  {
    name: 'run_analysis',
    description: '执行分析任务并返回结果',
    requires_confirmation: true,
    implemented: false,
    side_effect_level: 'execute',
  },
];

/** Tools that are safe to call without user confirmation */
export function getSafeTools(): AssistantToolDefinition[] {
  return ASSISTANT_TOOL_REGISTRY.filter((t) => !t.requires_confirmation);
}

/** Tools that are already implemented */
export function getImplementedTools(): AssistantToolDefinition[] {
  return ASSISTANT_TOOL_REGISTRY.filter((t) => t.implemented);
}
