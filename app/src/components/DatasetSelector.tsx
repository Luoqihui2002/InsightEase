import { useState, useEffect } from 'react';
import { datasetApi } from '@/api/datasets';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { Dataset } from '@/types/api';
import { Loader2 } from 'lucide-react';

interface DatasetSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DatasetSelector({ value, onChange, placeholder = "选择数据集" }: DatasetSelectorProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);

  // 调试：监听 value 变化
  useEffect(() => {
    console.log('DatasetSelector received value:', value);
  }, [value]);

  // 加载数据集
  useEffect(() => {
    let mounted = true;
    
    const loadDatasets = async () => {
      setLoading(true);
      try {
        const res: any = await datasetApi.list(1, 100);
        // API 现在直接返回 { items: [...] }
        const items = res.items || res.data?.items || [];
        console.log('DatasetSelector loaded datasets:', items.length || 0);
        if (mounted) {
          setDatasets(items);
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    loadDatasets();
    
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative">
      {loading ? (
        <div className="flex items-center gap-2 p-2 rounded border" style={{ 
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-muted)'
        }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      ) : (
        <SearchableSelect
          value={value || undefined}
          onChange={(nextValue) => onChange(nextValue ?? '')}
          options={datasets.map((dataset) => ({
            value: dataset.id,
            label: dataset.filename,
            description: `${dataset.row_count?.toLocaleString() ?? '-'} 行 · ${dataset.col_count ?? '-'} 列`,
            keywords: [
              dataset.id,
              dataset.filename,
              ...(dataset.schema ?? []).map((field) => field.name),
            ],
          }))}
          placeholder={placeholder || '选择或搜索数据集...'}
          searchPlaceholder="选择或搜索数据集..."
          emptyText="未找到匹配的数据集"
          allowClear
        />
      )}
    </div>
  );
}
