import { useState, useRef, useEffect, useMemo } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Opcional: segunda linha ou contexto (ex.: telefone, categoria) */
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Mensagem quando não há resultados na busca */
  emptyMessage?: string;
  /** Texto e callback para ação "Adicionar novo" no final da lista */
  addNewLabel?: string;
  onAddNew?: () => void;
  /** Altura máxima da lista (px). Default 260 */
  maxListHeight?: number;
  /** Id para acessibilidade */
  id?: string;
  /** Classe extra no container */
  className?: string;
  /** Exibir valor vazio como opção (ex.: "Nenhum") */
  allowClear?: boolean;
  /** Texto da opção de limpar quando allowClear (default: "Nenhum") */
  clearLabel?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Pesquisar...',
  disabled = false,
  loading = false,
  emptyMessage = 'Nenhum resultado encontrado',
  addNewLabel,
  onAddNew,
  maxListHeight = 260,
  id,
  className = '',
  allowClear = false,
  clearLabel = 'Nenhum'
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q))
    );
  }, [options, search]);

  const showAddNew = Boolean(addNewLabel && onAddNew && search.trim());
  const itemCount = (allowClear ? 1 : 0) + filteredOptions.length + (showAddNew ? 1 : 0);
  const addNewIndex = (allowClear ? 1 : 0) + filteredOptions.length;

  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setHighlightIndex((prev) => Math.min(prev, Math.max(0, itemCount - 1)));
  }, [filteredOptions.length, showAddNew, itemCount]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const highlighted = el.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % itemCount);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + itemCount) % itemCount);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showAddNew && highlightIndex === addNewIndex) {
        onAddNew?.();
        setOpen(false);
        return;
      }
      if (allowClear && highlightIndex === 0) {
        onChange('');
        setOpen(false);
        return;
      }
      const optIndex = allowClear ? highlightIndex - 1 : highlightIndex;
      const opt = filteredOptions[optIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const displayLabel = value && selectedOption ? selectedOption.label : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-main)] mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 sm:py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-left text-[var(--color-text-main)] flex items-center justify-between gap-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || placeholder}
      >
        <span className={displayLabel ? '' : 'text-[var(--color-text-muted)]'}>
          {loading ? 'Carregando...' : displayLabel || placeholder}
        </span>
        <span className="material-symbols-outlined text-[var(--color-text-muted)] shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg overflow-hidden"
          role="listbox"
        >
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] text-sm placeholder-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              aria-label="Buscar"
            />
          </div>
          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: maxListHeight }}
          >
            {allowClear && (
              <button
                type="button"
                data-highlighted={highlightIndex === 0}
                className={`w-full px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 transition-colors ${
                  value === '' ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]'
                } ${highlightIndex === 0 ? 'bg-[var(--color-bg-elevated)]' : ''}`}
                onClick={() => handleSelect('')}
              >
                {clearLabel}
              </button>
            )}
            {filteredOptions.length === 0 && !showAddNew ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const actualIndex = allowClear ? idx + 1 : idx;
                const isHighlighted = highlightIndex === actualIndex;
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-highlighted={isHighlighted}
                    className={`w-full px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 transition-colors ${
                      isSelected ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
                    } ${isHighlighted ? 'bg-[var(--color-bg-elevated)]' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span>{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-[var(--color-text-muted)]">{opt.description}</span>
                    )}
                  </button>
                );
              })
            )}
            {showAddNew && (
              <button
                type="button"
                data-highlighted={highlightIndex === addNewIndex}
                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 border-t border-[var(--color-border)]"
                onClick={() => {
                  onAddNew?.();
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-lg">add</span>
                {addNewLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
