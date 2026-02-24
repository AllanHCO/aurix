import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AssinaturaBloqueio() {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const r = sessionStorage.getItem('plan_blocked_reason');
    if (r) {
      setReason(r);
      sessionStorage.removeItem('plan_blocked_reason');
    }
  }, []);

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-center">
      <div className="rounded-xl border border-border bg-bg-card p-8 shadow-sm">
        <span className="material-symbols-outlined text-5xl text-warning mb-4 block">info</span>
        <h1 className="text-xl font-bold text-text-main mb-2">Sua assinatura está pendente</h1>
        <p className="text-text-muted text-sm mb-4">
          Entre em contato para regularizar e voltar a usar o sistema.
        </p>
        {reason && (
          <p className="text-text-muted text-xs mb-6 bg-bg-elevated rounded-lg p-3 text-left">
            {reason}
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate('/configuracoes')}
          className="px-4 py-2 rounded-lg border border-border text-text-main hover:bg-bg-elevated"
        >
          Ir para Configurações
        </button>
      </div>
    </div>
  );
}
