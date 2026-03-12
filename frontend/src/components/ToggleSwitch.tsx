import { useId } from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  /** Para agrupar label + switch (padrão: true). Se false, só renderiza o switch. */
  inline?: boolean;
}

/**
 * Toggle switch padrão do sistema para flags booleanas (ativar/desativar, mostrar/ocultar).
 * Não usar para seleção múltipla em tabelas.
 *
 * Especificação: 44×24px, bolinha 18px, ativo = primary, inativo = cinza, transição 0.2s.
 */
export default function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  inline = true
}: ToggleSwitchProps) {
  const id = useId();

  const track = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative w-11 h-6 rounded-full transition-[background-color,box-shadow] duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-main)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-primary' : 'bg-[var(--color-border)]'}
        ${!disabled ? 'cursor-pointer hover:opacity-90' : ''}
      `}
      style={{
        width: '44px',
        height: '24px',
        minWidth: '44px',
        minHeight: '24px'
      }}
    >
      <span
        className={`absolute top-1/2 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'left-[23px] -translate-y-1/2' : 'left-[3px] -translate-y-1/2'
        }`}
      />
    </button>
  );

  if (!inline) return track;

  return (
    <div className={description != null ? 'space-y-1' : ''}>
      <div className="flex flex-wrap items-center gap-3">
        {label != null && (
          <label
            htmlFor={id}
            className={`flex-1 min-w-0 text-sm font-medium text-text-main ${!disabled ? 'cursor-pointer' : ''}`}
          >
            {label}
          </label>
        )}
        <div className="shrink-0">{track}</div>
      </div>
      {description != null && (
        <p className="text-xs text-text-muted pl-0">{description}</p>
      )}
    </div>
  );
}
