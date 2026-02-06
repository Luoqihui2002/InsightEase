import { useState, useEffect } from 'react';
import { datasetApi } from '@/api/datasets';
import type { Dataset } from '@/types/api';
import { Loader2, ChevronDown } from 'lucide-react';

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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    console.log('DatasetSelector handleChange:', newValue);
    onChange(newValue);
  };

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
        <div className="relative">
          <select
            value={value}
            onChange={handleChange}
            className="w-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/50"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: value ? 'var(--text-primary)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.375rem',
              padding: '0.5rem 2rem 0.5rem 0.75rem',
              fontSize: '0.875rem'
            }}
          >
            <option value="" disabled style={{ color: 'var(--text-muted)' }}>
              {placeholder}
            </option>
            {datasets.map((dataset) => (
              <option 
                key={dataset.id} 
                value={dataset.id}
                style={{ color: 'var(--text-primary)' }}
              >
                {dataset.filename} ({dataset.row_count}行)
              </option>
            ))}
          </select>
          <ChevronDown 
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" 
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      )}
    </div>
  );
}
