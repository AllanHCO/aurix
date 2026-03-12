import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';

const CACHE_TTL_MS = 60_000;

interface SummaryPayload {
  receitaEmRisco?: { clientesNaoVoltaram: number; vendasPendentesCount: number };
  retencao?: { clientesInativo: number };
  operacional?: {
    estoqueBaixoCount: number;
    proximosAgendamentos: unknown[];
  };
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { getModuleConfig } = usePersonalizacao();
  const produtosConfig = getModuleConfig('produtos');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = 'notificationBell:summary';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { payload, expiresAt } = JSON.parse(cached);
        if (expiresAt > Date.now()) {
          setData(payload);
          setLoading(false);
          return;
        }
      } catch (_) {}
    }
    setLoading(true);
    api
      .get<SummaryPayload>('/dashboard/summary', { params: { periodo: 'ultimos_30_dias' } })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data;
        setData(payload);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ payload, expiresAt: Date.now() + CACHE_TTL_MS }));
        } catch (_) {}
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const receitaEmRisco = data?.receitaEmRisco;
  const operacional = data?.operacional;
  const alertasCount =
    (data?.retencao?.clientesInativo ? 1 : 0) +
    (produtosConfig?.controlar_estoque && (operacional?.estoqueBaixoCount ?? 0) > 0 ? 1 : 0);
  const temAlgumAlerta =
    (receitaEmRisco?.clientesNaoVoltaram ?? 0) > 0 ||
    (produtosConfig?.controlar_estoque && (operacional?.estoqueBaixoCount ?? 0) > 0) ||
    (receitaEmRisco?.vendasPendentesCount ?? 0) > 0 ||
    (operacional?.proximosAgendamentos?.length ?? 0) > 0;

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-main)] transition-colors"
        aria-label="Notificações"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {!loading && alertasCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-error)]" />
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-2 z-50"
          role="dialog"
          aria-label="Alertas"
        >
          <p className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-border)]">
            Alertas
          </p>
          {(receitaEmRisco?.clientesNaoVoltaram ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => go('/clientes?tab=retencao')}
              className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-elevated)] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-amber-500">person_off</span>
              <span className="text-sm text-[var(--color-text-main)]">
                {receitaEmRisco.clientesNaoVoltaram} cliente(s) há mais de 30 dias sem voltar
              </span>
            </button>
          )}
          {produtosConfig?.controlar_estoque && (operacional?.estoqueBaixoCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => go('/produtos?filtro=estoque_baixo')}
              className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-elevated)] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-red-400">inventory_2</span>
              <span className="text-sm text-[var(--color-text-main)]">
                {operacional!.estoqueBaixoCount} produto(s) com estoque baixo
              </span>
            </button>
          )}
          {(receitaEmRisco?.vendasPendentesCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => go('/pendencias')}
              className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-elevated)] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-primary">pending_actions</span>
              <span className="text-sm text-[var(--color-text-main)]">
                {receitaEmRisco.vendasPendentesCount} venda(s) pendente(s) de pagamento
              </span>
            </button>
          )}
          {(operacional?.proximosAgendamentos?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => go('/agendamentos')}
              className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-elevated)] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-green-500">event</span>
              <span className="text-sm text-[var(--color-text-main)]">Agendamentos próximos</span>
            </button>
          )}
          {!temAlgumAlerta && (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">Nenhum alerta no momento.</p>
          )}
        </div>
      )}
    </div>
  );
}
