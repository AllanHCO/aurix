import { Link } from 'react-router-dom';

export default function ConfiguracaoSeguranca() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Segurança</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">shield</span>
        Segurança
      </h1>
      <p className="text-text-muted">Resumo das proteções ativas no sistema (informativo).</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h3 className="font-medium text-text-main">Rate limit</h3>
        <p className="text-sm text-text-muted">
          Endpoints públicos (agendamento) e sensíveis (login) possuem limite de requisições por IP para evitar abuso e ataques de força bruta.
        </p>

        <h3 className="font-medium text-text-main mt-4">Anti-duplicação</h3>
        <p className="text-sm text-text-muted">
          O backend usa idempotência e locks onde necessário para evitar ações duplicadas (ex.: duplo clique em vendas ou agendamentos).
        </p>

        <h3 className="font-medium text-text-main mt-4">Ownership</h3>
        <p className="text-sm text-text-muted">
          Todas as rotas protegidas verificam que o recurso pertence ao usuário/empresa autenticada. Dados de uma empresa não são acessíveis por outra.
        </p>

        <h3 className="font-medium text-text-main mt-4">Validação e sanitização</h3>
        <p className="text-sm text-text-muted">
          Apenas campos esperados são aceitos nas requisições. Há sanitização de entrada e verificação de tipos (Zod) no backend.
        </p>
      </section>
    </div>
  );
}
