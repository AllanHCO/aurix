import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MODAL_PORTAL_Z } from './ModalPortal';

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
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || !open) return;
    const r = el.getBoundingClientRect();
    const pad = 4;
    const top = r.bottom + pad;
    const maxH = Math.min(maxListHeight, Math.max(80, window.innerHeight - top - 12));
    setPanelPos({ top, left: r.left, width: r.width, maxH });
  }, [open, maxListHeight]);

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

  /** Texto no campo: ao abrir = busca; fechado com seleção = rótulo */
  const inputDisplayValue = open ? search : selectedOption?.label ?? '';

  useEffect(() => {
    setHighlightIndex((prev) => Math.min(prev, Math.max(0, itemCount - 1)));
  }, [filteredOptions.length, showAddNew, itemCount]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-searchable-select-panel]')) return;
      setOpen(false);
      setSearch('');
    };
    window.addEventListener('scroll', updatePanelPosition, true);
    window.addEventListener('resize', updatePanelPosition);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true);
      window.removeEventListener('resize', updatePanelPosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, updatePanelPosition]);

  const openPanel = () => {
    if (disabled || loading) return;
    setOpen(true);
    setSearch('');
    setHighlightIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openPanel();
      }
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
        setSearch('');
        return;
      }
      if (allowClear && highlightIndex === 0) {
        handleSelect('');
        return;
      }
      const optIndex = allowClear ? highlightIndex - 1 : highlightIndex;
      const opt = filteredOptions[optIndex];
      if (opt) handleSelect(opt.value);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-main)] mb-1">
          {label}
        </label>
      )}
      <div
        ref={triggerRef}
        className={`rounded-lg border bg-[var(--color-bg-main)] overflow-hidden transition-shadow ${
          open ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25' : 'border-[var(--color-border)]'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="relative flex items-stretch min-h-[44px]">
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            disabled={disabled}
            readOnly={loading}
            value={loading ? '' : inputDisplayValue}
            placeholder={loading ? 'Carregando...' : placeholder}
            onChange={(e) => {
              const v = e.target.value;
              if (!open) {
                setOpen(true);
                setHighlightIndex(0);
              }
              setSearch(v);
            }}
            onFocus={() => {
              if (!disabled && !loading) openPanel();
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 pl-3 pr-10 py-2 sm:py-2.5 bg-transparent text-[var(--color-text-main)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-0 border-0"
            aria-label={label || placeholder}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => (open ? (setOpen(false), setSearch('')) : openPanel())}
            className="shrink-0 px-2 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border-l border-transparent hover:bg-[var(--color-bg-elevated)]/50"
            aria-label={open ? 'Fechar lista' : 'Abrir lista'}
          >
            <span className="material-symbols-outlined text-xl">{open ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>

      {open &&
        panelPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-searchable-select-panel
            role="listbox"
            className="fixed rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl overflow-y-auto overscroll-contain"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxH,
              zIndex: MODAL_PORTAL_Z
            }}
          >
            {allowClear && (
              <button
                type="button"
                role="option"
                data-highlighted={highlightIndex === 0}
                className={`w-full px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 transition-colors ${
                  value === ''
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]'
                } ${highlightIndex === 0 ? 'bg-[var(--color-bg-elevated)]' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect('')}
              >
                {clearLabel}
              </button>
            )}
            {filteredOptions.length === 0 && !showAddNew ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const actualIndex = allowClear ? idx + 1 : idx;
                const isHighlighted = highlightIndex === actualIndex;
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    data-highlighted={isHighlighted}
                    className={`w-full px-3 py-2.5 text-left text-sm flex flex-col gap-0.5 transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-medium'
                        : 'text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
                    } ${isHighlighted ? 'bg-[var(--color-bg-elevated)]' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAddNew?.();
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="material-symbols-outlined text-lg">add</span>
                {addNewLabel}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
