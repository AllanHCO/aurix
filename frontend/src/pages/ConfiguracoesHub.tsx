import { useNavigate } from 'react-router-dom';

export default function ConfiguracoesHub() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Configurações</h1>
        <p className="text-text-muted mt-1">Escolha o que deseja configurar.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card Agendamento — ativo */}
        <button
          type="button"
          onClick={() => navigate('/configuracoes/agendamento')}
          className="rounded-xl border border-border-light bg-surface-light shadow-sm p-6 text-left hover:bg-surface-elevated hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 shrink-0">
              <span className="material-symbols-outlined text-2xl">schedule</span>
            </div>
            <span className="text-sm font-medium text-primary">Abrir</span>
          </div>
          <h2 className="text-lg font-semibold text-text-main mt-3">Agendamento</h2>
          <p className="text-sm text-text-muted mt-1">
            Horários, duração, antecedência e bloqueios.
          </p>
        </button>

        {/* Placeholder: Faturamento — Em breve */}
        <div className="rounded-xl border border-border-light bg-surface-light shadow-sm p-6 text-left opacity-75 cursor-not-allowed">
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center text-text-muted shrink-0">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <span className="text-xs font-medium text-text-muted bg-surface-elevated px-2 py-0.5 rounded">
              Em breve
            </span>
          </div>
          <h2 className="text-lg font-semibold text-text-main mt-3">Faturamento</h2>
          <p className="text-sm text-text-muted mt-1">
            Formas de pagamento e cobrança.
          </p>
        </div>

        {/* Placeholder: Notificações */}
        <div className="rounded-xl border border-border-light bg-surface-light shadow-sm p-6 text-left opacity-75 cursor-not-allowed">
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center text-text-muted shrink-0">
              <span className="material-symbols-outlined text-2xl">notifications</span>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-text-main mt-3">Notificações</h2>
          <p className="text-sm text-text-muted mt-1">
            Alertas e lembretes por e-mail ou WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
