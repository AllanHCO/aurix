import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TableActionsMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

interface TableActionsMenuProps {
  items: TableActionsMenuItem[];
  /** Conteúdo opcional antes do menu (ex.: botão WhatsApp) */
  children?: React.ReactNode;
  /** Classe no container do botão + children */
  className?: string;
  /** Tamanho do ícone do botão 3 pontinhos */
  iconSize?: 'md' | 'lg';
}

/** z-index alto para o dropdown ficar na frente de tabelas com overflow e sidebars */
const DROPDOWN_Z = 9999;

/**
 * Menu de ações padrão para tabelas (3 pontinhos).
 * Agrupa Visualizar, Editar, Excluir etc. Ação destrutiva em vermelho.
 * O dropdown é renderizado em portal para não ser cortado por overflow da tabela.
 */
export default function TableActionsMenu({ items, children, className = '', iconSize = 'lg' }: TableActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    setPosition({
      top: rect.bottom + 4,
      left
    });
  };

  const handleToggle = () => {
    if (!open) {
      updatePosition();
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest?.('[data-table-actions-dropdown]')) setOpen(false);
      }
    };
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  const iconClass = iconSize === 'lg' ? 'text-lg' : 'text-base';

  const dropdownContent = open && position && typeof document !== 'undefined' && (
    <div
      data-table-actions-dropdown
      role="menu"
      className="fixed min-w-[160px] py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        zIndex: DROPDOWN_Z
      }}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick();
            setOpen(false);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-elevated)] ${
            item.danger ? 'text-[var(--color-error)]' : 'text-[var(--color-text-main)]'
          }`}
        >
          {item.icon && <span className="material-symbols-outlined text-lg">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className={`relative flex items-center justify-end gap-1 ${className}`}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="p-1.5 sm:p-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-main)] touch-manipulation"
        aria-label="Mais ações"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={`material-symbols-outlined ${iconClass}`}>more_vert</span>
      </button>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
