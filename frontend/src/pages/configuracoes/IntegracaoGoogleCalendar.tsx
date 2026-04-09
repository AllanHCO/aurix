import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

type Status = {
  configuredOnServer: boolean;
  connected: boolean;
  syncEnabled: boolean;
  googleEmail: string | null;
  calendarId: string;
  /** Banco de produção sem tabela da integração — aplicar migration SQL */
  migrationRequired?: boolean;
};

export default function IntegracaoGoogleCalendar() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Status>('/integrations/google-calendar/status');
      setStatus(res.data);
    } catch {
      setStatus(null);
      toast.error('Não foi possível carregar o status da integração.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (u.get('connected') === '1') {
      toast.success('Google Agenda conectado com sucesso.');
      navigate('/configuracoes/integracoes/google-calendar', { replace: true });
      load();
    } else if (u.get('error')) {
      const raw = decodeURIComponent(u.get('error') || 'erro');
      const hints: Record<string, string> = {
        redirect_uri_mismatch:
          'A URL de callback no servidor não bate com a cadastrada no Google Cloud. Em Fly: GOOGLE_REDIRECT_URI deve ser exatamente https://aurix-prod.fly.dev/api/integrations/google-calendar/callback (e a mesma em Credenciais OAuth).',
        invalid_grant:
          'Código de login expirado ou já usado. Clique de novo em Conectar com Google.',
        invalid_client: 'Client ID ou secret incorretos nas variáveis do servidor.',
        database: 'Erro ao salvar a integração no banco.',
        troca_token:
          'Falha ao trocar o código do Google por token. Confira GOOGLE_REDIRECT_URI, secret e logs do servidor.'
      };
      toast.error(hints[raw] || `Não foi possível conectar (${raw}).`);
      navigate('/configuracoes/integracoes/google-calendar', { replace: true });
    }
  }, [navigate, load]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await api.get<{ url: string }>('/integrations/google-calendar/auth-url');
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('URL de autorização indisponível.');
    } catch {
      toast.error('Não foi possível iniciar a conexão com o Google.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Desconectar o Google Agenda? Os eventos já criados permanecem no Google; novos agendamentos não serão enviados.')) return;
    setBusy(true);
    try {
      await api.post('/integrations/google-calendar/disconnect');
      toast.success('Google Agenda desconectado.');
      await load();
    } catch {
      toast.error('Não foi possível desconectar.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSync = async (next: boolean) => {
    setBusy(true);
    try {
      await api.patch('/integrations/google-calendar', { sync_enabled: next });
      setStatus((s) => (s ? { ...s, syncEnabled: next } : s));
      toast.success(next ? 'Sincronização automática ativada.' : 'Sincronização automática desativada.');
    } catch {
      toast.error('Não foi possível atualizar a preferência.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 px-1">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">
          Configurações
        </Link>
        <span>/</span>
        <span className="text-text-main">Integrações</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">link</span>
        Integrações
      </h1>

      <p className="text-sm font-medium text-text-main">Google Calendar</p>

      <p className="text-text-muted text-sm sm:text-base">
        Conecte seu Google Agenda para sincronizar automaticamente os agendamentos do Aurix. Os horários criados, alterados ou
        cancelados aqui serão refletidos no seu calendário principal do Google (somente envio Aurix → Google).
      </p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-5 sm:p-6 space-y-4">
        {loading ? (
          <p className="text-text-muted text-sm">Carregando…</p>
        ) : !status?.configuredOnServer ? (
          <div className="space-y-2">
            <p className="font-medium text-text-main">Integração não configurada no servidor</p>
            <p className="text-sm text-text-muted">
              É necessário definir as credenciais OAuth do Google (Client ID, secret e URL de callback) no ambiente do backend. Entre em
              contato com o suporte ou administrador.
            </p>
          </div>
        ) : status.migrationRequired ? (
          <div className="space-y-3">
            <p className="font-medium text-amber-800 dark:text-amber-200">Banco de dados precisa da migration da integração</p>
            <p className="text-sm text-text-muted">
              O servidor está configurado, mas o banco em produção ainda não tem a tabela da integração Google. É preciso executar o SQL da
              migration no mesmo Postgres usado pelo Fly (<code className="text-xs bg-bg-main px-1 rounded">DATABASE_URL</code> de
              produção), por exemplo com{' '}
              <code className="text-xs bg-bg-main px-1 rounded break-all">npx prisma db execute</code> apontando para esse banco, ou pelo
              editor SQL do provedor (Supabase, etc.).
            </p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-medium text-text-muted uppercase tracking-wide">Status</h2>
              <p className="text-text-main font-medium mt-1">
                {status.connected
                  ? status.syncEnabled
                    ? 'Conectado — sincronização ativa'
                    : 'Conectado — sincronização pausada'
                  : 'Não conectado'}
              </p>
              {status.connected && status.googleEmail && (
                <p className="text-sm text-text-muted mt-1">Conta: {status.googleEmail}</p>
              )}
              {status.connected && (
                <p className="text-xs text-text-muted mt-2">Calendário: principal do Google ({status.calendarId})</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {!status.connected ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleConnect}
                  className="w-full sm:w-auto text-sm font-semibold px-4 py-3 rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover disabled:opacity-50"
                >
                  Conectar com Google
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDisconnect}
                    className="w-full sm:w-auto text-sm font-medium px-4 py-3 rounded-lg border border-border text-text-main hover:bg-bg-elevated disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                  <label className="flex items-center gap-3 cursor-pointer select-none py-2 sm:py-0">
                    <input
                      type="checkbox"
                      className="rounded border-border w-4 h-4 text-primary focus:ring-primary/30"
                      checked={status.syncEnabled}
                      disabled={busy}
                      onChange={(e) => handleToggleSync(e.target.checked)}
                    />
                    <span className="text-sm text-text-main">Sincronização automática</span>
                  </label>
                </>
              )}
            </div>

            <p className="text-xs text-text-muted border-t border-border pt-4">
              Se a sincronização falhar (por exemplo, token expirado), o agendamento continua salvo no Aurix; você verá o status no
              detalhe do agendamento quando disponível.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
