import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  badges?: string[];
  keywords?: string[];
  disabled?: boolean;
}

interface SearchableSelectProps {
  value?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onChange: (value: string | undefined) => void;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  options,
  placeholder = '选择或搜索...',
  searchPlaceholder = '输入关键词...',
  emptyText = '未找到匹配项',
  onChange,
  allowClear = false,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [
        option.label,
        option.description,
        ...(option.badges ?? []),
        ...(option.keywords ?? []),
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(normalized))
    );
  }, [options, query]);

  const handleSelect = (nextValue: string) => {
    const option = options.find((item) => item.value === nextValue);
    if (option?.disabled) return;
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'w-full min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2',
          'flex items-center justify-between gap-2 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className={cn('truncate', selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="清空选择"
              onClick={(event) => {
                event.stopPropagation();
                onChange(undefined);
                setQuery('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(undefined);
                  setQuery('');
                }
              }}
              className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[220px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-xl">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-muted)]">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left transition-colors',
                    value === option.value
                      ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
                    option.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{option.label}</span>
                    {option.badges && option.badges.length > 0 && (
                      <span className="flex shrink-0 flex-wrap justify-end gap-1">
                        {option.badges.slice(0, 3).map((badge) => (
                          <span
                            key={badge}
                            className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                          >
                            {badge}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{option.description}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
