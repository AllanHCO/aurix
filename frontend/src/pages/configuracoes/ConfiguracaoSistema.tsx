import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface DemoStatus {
  is_demo: boolean;
}

export default function ConfiguracaoSistema() {
  const [loadingDemo, setLoadingDemo] = useState(true);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [gerandoDemo, setGerandoDemo] = useState(false);
  const [resetandoDemo, setResetandoDemo] = useState(false);

  useEffect(() => {
    api.get<DemoStatus>('/configuracoes/demo/status').then((r) => setDemoStatus(r.data)).catch(() => setDemoStatus(null)).finally(() => setLoadingDemo(false));
  }, []);

  const handleGerarDemo = async () => {
    try {
      setGerandoDemo(true);
      await api.post('/configuracoes/demo/gerar');
      toast.success('Modo demo ativado. Dados gerados.');
      const r = await api.get<DemoStatus>('/configuracoes/demo/status');
      setDemoStatus(r.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao gerar dados demo');
    } finally {
      setGerandoDemo(false);
    }
  };

  const handleResetarDemo = async () => {
    if (!window.confirm('Isso vai apagar todos os dados demo (clientes, produtos, vendas, agendamentos). Continuar?')) return;
    try {
      setResetandoDemo(true);
      await api.post('/configuracoes/demo/resetar');
      toast.success('Dados demo removidos.');
      setDemoStatus({ is_demo: false });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao resetar dados demo');
    } finally {
      setResetandoDemo(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Sistema</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">settings</span>
        Sistema
      </h1>
      <p className="text-text-muted">Modo demo e utilidades gerais.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h3 className="font-medium text-text-main">Modo demo</h3>
        <p className="text-sm text-text-muted">Preenche o sistema com dados realistas (últimos 90 dias) para testes e apresentações.</p>
        {loadingDemo ? (
          <p className="text-sm text-text-muted">Carregando status...</p>
        ) : (
          <>
            {demoStatus?.is_demo && (
              <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Modo demo ativo
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGerarDemo}
                disabled={gerandoDemo}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {gerandoDemo ? 'Gerando...' : (demoStatus?.is_demo ? 'Regenerar dados demo' : 'Ativar Modo Demo / Gerar dados')}
                <span className="material-symbols-outlined text-lg">play_circle</span>
              </button>
              <button
                type="button"
                onClick={handleResetarDemo}
                disabled={resetandoDemo || !demoStatus?.is_demo}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-main text-text-main px-4 py-2 text-sm font-medium hover:bg-bg-card disabled:opacity-50"
              >
                {resetandoDemo ? 'Resetando...' : 'Resetar dados demo'}
                <span className="material-symbols-outlined text-lg">restart_alt</span>
              </button>
            </div>
          </>
        )}
        <p className="text-xs text-text-muted mt-2">Logs e informações gerais do sistema: em breve.</p>
      </section>
    </div>
  );
}
