import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

function getNextEnabledIndex(
  options: SearchableSelectOption[],
  currentIndex: number,
  direction: 1 | -1
) {
  if (options.length === 0) return -1;

  for (let offset = 1; offset <= options.length; offset += 1) {
    const nextIndex = (currentIndex + offset * direction + options.length) % options.length;
    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

function getFirstEnabledIndex(options: SearchableSelectOption[]) {
  return options.findIndex((option) => !option.disabled);
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
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const activeOptionId = `${reactId}-option`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);

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

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  };

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
  };

  const selectOption = (option: SearchableSelectOption | undefined) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    closeDropdown();
  };

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex((currentIndex) => {
      if (filteredOptions[currentIndex] && !filteredOptions[currentIndex].disabled) {
        return currentIndex;
      }
      return getFirstEnabledIndex(filteredOptions);
    });
  }, [filteredOptions, open]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openDropdown();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'Tab') {
      closeDropdown();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        getNextEnabledIndex(filteredOptions, currentIndex, 1)
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        getNextEnabledIndex(
          filteredOptions,
          currentIndex < 0 ? filteredOptions.length : currentIndex,
          -1
        )
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectOption(filteredOptions[highlightedIndex]);
    }
  };

  const clearSelection = () => {
    onChange(undefined);
    closeDropdown();
  };

  const selectedActiveOptionId =
    open && highlightedIndex >= 0 ? `${activeOptionId}-${highlightedIndex}` : undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={selectedOption?.label ?? placeholder}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            closeDropdown();
            return;
          }
          openDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
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
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="清空选择"
              onClick={(event) => {
                event.stopPropagation();
                clearSelection();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  clearSelection();
                }
              }}
              className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)]/30"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-[80] mt-2 w-full min-w-[220px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-xl">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={selectedActiveOptionId}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <div id={listboxId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-muted)]">{emptyText}</div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value === option.value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    id={`${activeOptionId}-${index}`}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(index);
                    }}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]'
                        : 'text-[var(--text-primary)]',
                      isHighlighted && !isSelected && 'bg-[var(--bg-tertiary)]',
                      !option.disabled && 'hover:bg-[var(--bg-tertiary)]',
                      option.disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">{option.label}</span>
                      {option.badges && option.badges.length > 0 && (
                        <span className="flex max-w-[55%] shrink-0 flex-wrap justify-end gap-1">
                          {option.badges.slice(0, 3).map((badge) => (
                            <span
                              key={badge}
                              className="max-w-full truncate rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
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
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
