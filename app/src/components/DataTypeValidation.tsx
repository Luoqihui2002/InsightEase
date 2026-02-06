import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface ColumnInfo {
  name: string;
  dtype: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'other';
  sample?: any[];
}

export type AnalysisType = 
  | 'attribution' 
  | 'funnel' 
  | 'path' 
  | 'clustering' 
  | 'key_path' 
  | 'sequence_mining'
  | 'forecast'
  | 'statistics'
  | 'clustering_analysis';

interface Requirement {
  type: 'required' | 'optional' | 'recommended';
  columnTypes: string[];
  description: string;
  examples: string[];
}

interface AnalysisRequirements {
  [key: string]: Requirement[];
}

const ANALYSIS_REQUIREMENTS: AnalysisRequirements = {
  attribution: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id', 'device_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '触点/渠道列',
      examples: ['channel', 'source', 'touchpoint', 'page', 'event', 'channel_name', 'utm_source']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time', 'dt']
    },
    {
      type: 'optional',
      columnTypes: ['numeric', 'categorical'],
      description: '转化标记列（0/1）',
      examples: ['converted', 'is_convert', 'conversion', 'target']
    },
    {
      type: 'optional',
      columnTypes: ['numeric'],
      description: '转化价值列',
      examples: ['revenue', 'value', 'amount', 'price', 'order_amount']
    }
  ],
  funnel: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '事件/页面列',
      examples: ['page', 'event', 'page_name', 'event_name', 'screen', 'step']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time']
    }
  ],
  path: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '事件/页面列',
      examples: ['page', 'event', 'page_name', 'event_name', 'screen']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time']
    }
  ],
  clustering: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '事件/页面列',
      examples: ['page', 'event', 'page_name', 'event_name', 'screen']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time']
    },
    {
      type: 'optional',
      columnTypes: ['numeric'],
      description: '数值特征列（自定义模式）',
      examples: ['age', 'spend', 'score', 'duration', 'amount']
    }
  ],
  key_path: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '事件/页面列',
      examples: ['page', 'event', 'page_name', 'event_name', 'screen']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time']
    }
  ],
  sequence_mining: [
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '用户ID列',
      examples: ['user_id', 'userId', 'uid', 'user', 'session_id']
    },
    {
      type: 'required',
      columnTypes: ['categorical', 'other'],
      description: '事件/页面列',
      examples: ['page', 'event', 'page_name', 'event_name', 'screen']
    },
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '时间戳列',
      examples: ['timestamp', 'time', 'date', 'created_at', 'event_time']
    },
    {
      type: 'optional',
      columnTypes: ['numeric', 'categorical'],
      description: '转化标记列（高转化模式挖掘）',
      examples: ['converted', 'is_convert', 'conversion', 'target']
    }
  ],
  forecast: [
    {
      type: 'required',
      columnTypes: ['datetime', 'categorical'],
      description: '日期列',
      examples: ['date', 'datetime', 'timestamp', 'day', 'month', 'period', 'ds']
    },
    {
      type: 'required',
      columnTypes: ['numeric'],
      description: '数值列（预测目标）',
      examples: ['value', 'amount', 'revenue', 'sales', 'quantity', 'count', 'y']
    }
  ],
  statistics: [
    {
      type: 'recommended',
      columnTypes: ['numeric', 'categorical', 'datetime'],
      description: '任意列',
      examples: ['任意数据列']
    }
  ],
  clustering_analysis: [
    {
      type: 'required',
      columnTypes: ['numeric'],
      description: '数值列（聚类特征）',
      examples: ['age', 'income', 'score', 'spend', 'frequency', 'amount']
    }
  ]
};

interface ValidationResult {
  isValid: boolean;
  missing: Requirement[];
  matched: { requirement: Requirement; columns: string[] }[];
  warnings: string[];
}

export function validateDataset(
  columns: ColumnInfo[],
  analysisType: AnalysisType
): ValidationResult {
  const requirements = ANALYSIS_REQUIREMENTS[analysisType] || [];
  const missing: Requirement[] = [];
  const matched: { requirement: Requirement; columns: string[] }[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    const matchingCols = columns.filter(col => 
      req.columnTypes.some(type => col.type === type || (type === 'other' && !['numeric', 'categorical', 'datetime'].includes(col.type)))
    );

    if (matchingCols.length === 0) {
      if (req.type === 'required') {
        missing.push(req);
      }
    } else {
      matched.push({
        requirement: req,
        columns: matchingCols.map(c => c.name)
      });
    }
  }

  // 检查是否有用户ID列的提示
  const hasUserIdLike = columns.some(col => 
    /user|id|uid|session/i.test(col.name)
  );
  if (!hasUserIdLike && ['attribution', 'funnel', 'path', 'clustering', 'key_path', 'sequence_mining'].includes(analysisType)) {
    warnings.push('未检测到类似用户ID的列，请确保选择一个能唯一标识用户的列');
  }

  return {
    isValid: missing.filter(r => r.type === 'required').length === 0,
    missing,
    matched,
    warnings
  };
}

interface DataTypeValidationProps {
  columns: ColumnInfo[];
  analysisType: AnalysisType;
  className?: string;
}

export function DataTypeValidation({ columns, analysisType, className = '' }: DataTypeValidationProps) {
  if (columns.length === 0) return null;

  const validation = validateDataset(columns, analysisType);
  const analysisName = {
    attribution: '归因分析',
    funnel: '漏斗分析',
    path: '路径分析',
    clustering: '路径聚类',
    key_path: '关键路径',
    sequence_mining: '序列模式挖掘',
    forecast: '预测分析',
    statistics: '统计分析',
    clustering_analysis: '聚类分析'
  }[analysisType] || analysisType;

  // 全部满足
  if (validation.isValid && validation.missing.length === 0) {
    return (
      <div className={`p-3 rounded-lg border ${className}`} style={{ 
        backgroundColor: 'rgba(34, 197, 94, 0.15)', 
        borderColor: 'rgba(34, 197, 94, 0.4)' 
      }}>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
          <div className="text-xs">
            <p className="font-medium" style={{ color: '#22c55e' }}>数据类型检查通过</p>
            <p className="text-[var(--text-secondary)] mt-1">
              您的数据集符合{analysisName}的要求，已自动推荐相关列。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 有缺失的必需列
  if (!validation.isValid) {
    return (
      <div className={`p-3 rounded-lg border ${className}`} style={{ 
        backgroundColor: 'rgba(236, 72, 153, 0.15)', 
        borderColor: 'rgba(236, 72, 153, 0.4)' 
      }}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ec4899' }} />
          <div className="text-xs space-y-2">
            <p className="font-medium" style={{ color: '#ec4899' }}>数据类型不满足{analysisName}要求</p>
            <p className="text-[var(--text-secondary)]">
              当前数据集缺少以下必需列类型：
            </p>
            <ul className="space-y-1.5">
              {validation.missing.map((req, index) => (
                <li key={index} className="text-[var(--text-secondary)]">
                  <span style={{ color: '#ec4899' }}>•</span>{' '}
                  <span className="font-medium">{req.description}</span>
                  <span className="text-[var(--text-muted)] ml-1">
                    (需要: {req.columnTypes.join('/')})
                  </span>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 ml-3">
                    建议列名: {req.examples.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
              您可以：1) 上传包含相应列的新数据集 或 2) 选择其他分析类型
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 只有可选列缺失或警告
  return (
    <div className={`p-3 rounded-lg border ${className}`} style={{ 
      backgroundColor: 'rgba(249, 115, 22, 0.15)', 
      borderColor: 'rgba(249, 115, 22, 0.4)' 
    }}>
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f97316' }} />
        <div className="text-xs space-y-1">
          <p className="font-medium" style={{ color: '#f97316' }}>数据类型提示</p>
          {validation.missing.length > 0 && (
            <p className="text-[var(--text-secondary)]">
              可选列缺失（不影响基本分析）：{validation.missing.map(r => r.description).join(', ')}
            </p>
          )}
          {validation.warnings.map((warning, index) => (
            <p key={index} className="text-[var(--text-muted)]">• {warning}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DataTypeValidation;
