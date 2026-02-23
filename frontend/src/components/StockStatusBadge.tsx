/**
 * Badge reutilizável para status de estoque.
 * Mesmo padrão estrutural nos três estados: span, classe base, bolinha.
 */
export type StockStatus = 'ok' | 'low' | 'out';

export function getStockStatus(
  estoque: number,
  estoqueMinimo: number = 0
): StockStatus {
  if (estoque <= 0) return 'out';
  if (estoque <= estoqueMinimo) return 'low';
  return 'ok';
}

export function isStockAvailable(estoque: number): boolean {
  return estoque > 0;
}

function label(status: StockStatus, estoque: number): string {
  if (status === 'out') return 'Esgotado';
  if (status === 'low') return `Baixo Estoque (${estoque})`;
  return `Em Estoque (${estoque})`;
}

interface StockStatusBadgeProps {
  estoque: number;
  estoqueMinimo?: number;
  className?: string;
}

const baseClasses =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap';

export default function StockStatusBadge({
  estoque,
  estoqueMinimo = 0,
  className = ''
}: StockStatusBadgeProps) {
  const status = getStockStatus(estoque, estoqueMinimo);

  if (status === 'ok') {
    return (
      <span
        className={`${baseClasses} bg-badge-pago text-badge-pago-text border-badge-pago ${className}`}
        role="status"
        aria-label={label(status, estoque)}
      >
        <span className="size-1.5 rounded-full bg-success shrink-0" aria-hidden />
        {label(status, estoque)}
      </span>
    );
  }

  if (status === 'low') {
    return (
      <span
        className={`${baseClasses} bg-badge-pendente text-badge-pendente-text border-badge-pendente ${className}`}
        role="status"
        aria-label={label(status, estoque)}
      >
        <span className="size-1.5 rounded-full bg-info shrink-0" aria-hidden />
        {label(status, estoque)}
      </span>
    );
  }

  return (
    <span
      className={`${baseClasses} bg-badge-erro text-badge-erro-text border-badge-erro ${className}`}
      role="status"
      aria-label={label(status, estoque)}
    >
      <span className="size-1.5 rounded-full bg-error shrink-0" aria-hidden />
      {label(status, estoque)}
    </span>
  );
}
