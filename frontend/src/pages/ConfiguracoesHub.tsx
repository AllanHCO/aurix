import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface ConfigResponse {
  empresa: { slug: string | null; link_preview: string | null };
  retencao: { dias_atencao: number; dias_inativo: number };
  agendamentos: { configurado: boolean };
  plano: { plano: string; is_active: boolean };
}

const MODULOS: Array<{
  id: string;
  path: string;
  icon: string;
  titulo: string;
  descricao: string;
  status?: 'ativo' | 'parcial' | 'futuro';
  /** Palavras-chave para busca: configurações internas (ex.: "lembrete", "template confirmação") */
  keywords: string[];
}> = [
  { id: 'empresa', path: '/configuracoes/empresa', icon: 'business', titulo: 'Empresa', descricao: 'Nome, slug, link público e meta de faturamento.', status: 'ativo', keywords: ['nome empresa', 'slug', 'link público', 'logo', 'cor'] },
  {
    id: 'documentos-pdf',
    path: '/configuracoes/documentos-pdf',
    icon: 'picture_as_pdf',
    titulo: 'Documentos (PDF)',
    descricao: 'Logo e cabeçalho do PDF da Ordem de Serviço.',
    status: 'ativo',
    keywords: ['pdf', 'logo', 'ordem de serviço', 'os', 'cabeçalho', 'impressão', 'marca']
  },
  { id: 'areas-negocio', path: '/configuracoes/areas-negocio', icon: 'account_tree', titulo: 'Áreas de negócio', descricao: 'Mecânica, Funilaria, etc. Veja resultado por área ou consolidado.', status: 'ativo', keywords: ['área', 'mecânica', 'funilaria', 'consolidado', 'frente', 'negócio'] },
  { id: 'clientes', path: '/configuracoes/clientes', icon: 'group', titulo: 'Clientes', descricao: 'Configura regras de retenção, dias para atenção e inativo.', status: 'ativo', keywords: ['retenção', 'atenção', 'inativo', 'dados adicionais', 'orçamento', 'venda'] },
  { id: 'vendas', path: '/configuracoes/vendas', icon: 'payments', titulo: 'Vendas', descricao: 'Orçamentos, nome do módulo, OS e textos padrão (garantia/agradecimento no PDF).', status: 'ativo', keywords: ['orçamento', 'atendimentos', 'ordens de serviço', 'fluxo comercial', 'garantia', 'agradecimento', 'pdf', 'os'] },
  { id: 'agendamentos', path: '/configuracoes/agendamento', icon: 'calendar_month', titulo: 'Agendamentos', descricao: 'Agenda pública, horários, bloqueios e confirmação.', status: 'ativo', keywords: ['agendamento', 'agenda', 'link público', 'horário', 'slot', 'buffer', 'bloqueio', 'lembrete', 'confirmação', 'template confirmação', 'lembrete de agendamento'] },
  { id: 'marketing', path: '/configuracoes/marketing', icon: 'campaign', titulo: 'Marketing', descricao: 'Templates WhatsApp e regras de reativação.', status: 'ativo', keywords: ['whatsapp', 'template', 'atenção', 'inativo', 'pós-venda', 'confirmação agendamento', 'lembrete agendamento'] },
  { id: 'relatorios', path: '/configuracoes/relatorios', icon: 'bar_chart', titulo: 'Relatórios', descricao: 'Exportação CSV e comparação entre períodos.', status: 'ativo', keywords: ['csv', 'exportação', 'comparação', 'períodos', 'análises', 'estatísticas'] },
  { id: 'financeiro', path: '/configuracoes/financeiro', icon: 'account_balance_wallet', titulo: 'Financeiro', descricao: 'Controle de despesas, lucro e gráficos.', status: 'parcial', keywords: ['despesas', 'lucro', 'gráfico', 'dashboard'] },
  { id: 'seguranca', path: '/configuracoes/seguranca', icon: 'shield', titulo: 'Segurança', descricao: 'Rate limit, anti-duplicação e validações ativas.', status: 'ativo', keywords: ['rate limit', 'anti-duplicação', 'validação', 'ownership'] },
  { id: 'plano', path: '/configuracoes/plano', icon: 'payments', titulo: 'Plano / Cobrança', descricao: 'Plano atual, trial e status da assinatura.', status: 'ativo', keywords: ['plano', 'cobrança', 'trial', 'assinatura', 'bloqueio'] },
  { id: 'personalizacao', path: '/configuracoes/personalizacao', icon: 'tune', titulo: 'Personalização', descricao: 'Presets por nicho e nomes dos módulos.', status: 'ativo', keywords: ['preset', 'nicho', 'barbearia', 'mecânica', 'estética', 'renomear', 'ativar', 'desativar'] },
  { id: 'sistema', path: '/configuracoes/sistema', icon: 'settings', titulo: 'Sistema', descricao: 'Modo demo e utilidades gerais.', status: 'ativo', keywords: ['demo', 'resetar', 'regenerar'] },
  {
    id: 'integracoes',
    path: '/configuracoes/integracoes/google-calendar',
    icon: 'link',
    titulo: 'Integrações',
    descricao: 'Conexões externas: Google Calendar e sincronização de agendamentos.',
    status: 'ativo',
    keywords: ['google', 'agenda', 'calendar', 'integração', 'integrações', 'sincronizar', 'ical', 'oauth']
  },
];

export default function ConfiguracoesHub() {
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  useEffect(() => {
    api.get<ConfigResponse>('/configuracoes').then((r) => setConfig(r.data)).catch(() => setConfig(null));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MODULOS;
    return MODULOS.filter(
      (m) =>
        m.titulo.toLowerCase().includes(q) ||
        m.descricao.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.keywords.some((kw) => kw.toLowerCase().includes(q) || q.split(/\s+/).some((w) => w.length >= 2 && kw.toLowerCase().includes(w)))
    );
  }, [search]);

  /** Para cada módulo filtrado, quais keywords bateram na busca (para exibir "configurações relacionadas") */
  const matchedKeywordsByMod = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    const words = q.split(/\s+/).filter((w) => w.length >= 2);
    filtered.forEach((m) => {
      const matched = m.keywords.filter(
        (kw) =>
          kw.toLowerCase().includes(q) ||
          words.some((w) => kw.toLowerCase().includes(w))
      );
      if (matched.length) map.set(m.id, matched);
    });
    return map;
  }, [search, filtered]);

  const getPreview = (id: string): string | null => {
    if (!config) return null;
    if (id === 'clientes') return `Atenção: ${config.retencao.dias_atencao} dias · Inativo: ${config.retencao.dias_inativo} dias`;
    if (id === 'agendamentos' && config.agendamentos.configurado) return 'Agenda configurada';
    if (id === 'plano') return `${config.plano.plano} · ${config.plano.is_active ? 'Ativo' : 'Inativo'}`;
    if (id === 'empresa' && config.empresa.slug) return `Link: /agenda/${config.empresa.slug}`;
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Configurações</h1>
        <p className="text-text-muted mt-1">Central de módulos. Escolha o que deseja configurar.</p>
      </header>

      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Buscar configuração</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar configuração..."
          className="w-full rounded-lg border border-border bg-bg-main px-3 py-2.5 text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((mod) => {
          const preview = getPreview(mod.id);
          const isFuturo = mod.status === 'futuro';
          return (
            <Link
              key={mod.id}
              to={mod.path}
              className={`rounded-xl border border-border bg-bg-card shadow-sm p-6 flex items-start gap-4 text-left transition-all duration-200 ${isFuturo ? 'opacity-60 pointer-events-none' : 'hover:scale-[1.02] hover:shadow-md hover:ring-2 hover:ring-primary/50 hover:border-primary/40 cursor-pointer'}`}
            >
              <span className="material-symbols-outlined text-3xl text-primary shrink-0">{mod.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-text-main">{mod.titulo}</h2>
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      mod.status === 'ativo' ? 'bg-green-500' : mod.status === 'parcial' ? 'bg-amber-500' : 'bg-gray-400'
                    }`}
                    title={mod.status === 'ativo' ? 'Ativo' : mod.status === 'parcial' ? 'Parcialmente ativo' : 'Desativado'}
                    aria-label={mod.status === 'ativo' ? 'Ativo' : mod.status === 'parcial' ? 'Parcialmente ativo' : 'Desativado'}
                  />
                </div>
                <p className="text-sm text-text-muted mt-0.5">{mod.descricao}</p>
                {preview && (
                  <p className="text-xs text-primary mt-2 font-medium">{preview}</p>
                )}
                {matchedKeywordsByMod.get(mod.id)?.length ? (
                  <p className="text-xs text-text-muted mt-1.5">
                    Também relacionado: {matchedKeywordsByMod.get(mod.id)!.slice(0, 4).join(', ')}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-text-muted text-center py-8">Nenhum módulo encontrado para &quot;{search}&quot;.</p>
      )}
    </div>
  );
}
