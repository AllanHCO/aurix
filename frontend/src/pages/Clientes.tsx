import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency } from '../utils/format';
import ClienteModal from '../components/ClienteModal';
import ClienteImportModal from '../components/ClienteImportModal';

type TabClientes = 'lista' | 'retencao';
type PeriodoRetencao = 'semana' | 'mes' | 'trimestre';

interface ClienteEmRisco {
  id: string;
  nome: string;
  telefone: string | null;
  ultimaCompra: string;
  diasSemComprar: number;
  receitaMedia: number;
}

interface ClienteRecuperado {
  id: string;
  nome: string;
  dataNovaCompra: string;
  valorVenda: number;
  diasFicouSemComprar: number;
}

export type ClienteStatusAuto = 'ativo' | 'atencao' | 'inativo';

type FiltroRapido =
  | 'TODOS'
  | 'ativo'
  | 'atencao'
  | 'inativo'
  | 'novos_no_mes'
  | 'retornaram_no_mes';

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status: ClienteStatusAuto;
  ultimaCompra: string | null;
  diasInativo: number | null;
}

const LIMITE_POR_PAGINA = 20;

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [filtro, setFiltro] = useState<FiltroRapido>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('status') === 'inativo') return 'inativo';
    if (p.get('status') === 'atencao') return 'atencao';
    if (p.get('novos_no_mes') === '1') return 'novos_no_mes';
    if (p.get('retornaram_no_mes') === '1') return 'retornaram_no_mes';
    return 'TODOS';
  });
  const [busca, setBusca] = useState('');
  const [buscaDebounce, setBuscaDebounce] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [mensagensWhatsApp, setMensagensWhatsApp] = useState<{
    msg_whatsapp_atencao: string;
    msg_whatsapp_inativo: string;
    msg_whatsapp_pos_venda: string | null;
  } | null>(null);
  const [tab, setTab] = useState<TabClientes>(() => (searchParams.get('tab') === 'retencao' ? 'retencao' : 'lista'));
  const [periodoRetencao, setPeriodoRetencao] = useState<PeriodoRetencao>('mes');
  const [clientesEmRisco, setClientesEmRisco] = useState<ClienteEmRisco[]>([]);
  const [clientesRecuperados, setClientesRecuperados] = useState<ClienteRecuperado[]>([]);
  const [loadingRetencao, setLoadingRetencao] = useState(false);

  useEffect(() => {
    api.get<{
      msg_whatsapp_atencao: string;
      msg_whatsapp_inativo: string;
      msg_whatsapp_pos_venda: string | null;
    }>('/configuracoes/mensagens')
      .then((r) => setMensagensWhatsApp(r.data))
      .catch(() => setMensagensWhatsApp(null));
  }, []);

  const buildParams = useCallback(
    (pagina: number) => {
      const params: Record<string, string | number> = {
        sort: 'dias_inativo_desc',
        page: pagina,
        limit: LIMITE_POR_PAGINA
      };
      if (filtro === 'ativo' || filtro === 'atencao' || filtro === 'inativo') {
        params.status = filtro;
      } else if (filtro === 'novos_no_mes') {
        params.novos_no_mes = 'true';
      } else if (filtro === 'retornaram_no_mes') {
        params.retornaram_no_mes = 'true';
      }
      if (searchParams.get('reativar') === '1') params.reativar = '1';
      if (buscaDebounce.trim()) params.search = buscaDebounce.trim();
      return params;
    },
    [filtro, buscaDebounce, searchParams]
  );

  const loadClientes = useCallback(
    async (pagina: number = 1) => {
      try {
        setLoading(true);
        const res = await api.get<{ data: Cliente[]; total: number }>('/clientes', {
          params: buildParams(pagina)
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const totalCount = typeof res.data?.total === 'number' ? res.data.total : 0;
        setClientes(
          list.map((c: any) => ({
            id: c.id || '',
            nome: c.nome || '',
            telefone: c.telefone ?? null,
            observacoes: c.observacoes ?? null,
            status: c.status === 'atencao' || c.status === 'inativo' ? c.status : 'ativo',
            ultimaCompra: c.ultimaCompra ?? null,
            diasInativo: c.diasInativo !== undefined ? c.diasInativo : null
          }))
        );
        setTotal(totalCount);
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Erro ao carregar clientes';
        toast.error(msg);
        setClientes([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounce(busca);
      setPaginaAtual(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'inativo') setFiltro('inativo');
    else if (status === 'atencao') setFiltro('atencao');
    else if (searchParams.get('reativar') === '1') setFiltro('TODOS');
    else if (searchParams.get('novos_no_mes') === '1') setFiltro('novos_no_mes');
    else if (searchParams.get('retornaram_no_mes') === '1') setFiltro('retornaram_no_mes');
    if (searchParams.get('tab') === 'retencao') setTab('retencao');
    else if (searchParams.get('tab') === 'lista') setTab('lista');
  }, [searchParams]);

  const loadRetencao = useCallback(async () => {
    setLoadingRetencao(true);
    try {
      const res = await api.get<{ periodo: PeriodoRetencao; clientesEmRisco: ClienteEmRisco[]; clientesRecuperados: ClienteRecuperado[] }>('/clientes/retencao', {
        params: { periodo: periodoRetencao }
      });
      setClientesEmRisco(res.data.clientesEmRisco ?? []);
      setClientesRecuperados(res.data.clientesRecuperados ?? []);
    } catch {
      toast.error('Erro ao carregar dados de retenção');
      setClientesEmRisco([]);
      setClientesRecuperados([]);
    } finally {
      setLoadingRetencao(false);
    }
  }, [periodoRetencao]);

  useEffect(() => {
    if (tab === 'retencao') loadRetencao();
  }, [tab, loadRetencao]);

  useEffect(() => {
    loadClientes(paginaAtual);
  }, [paginaAtual, filtro, buscaDebounce, searchParams.get('reativar')]);

  const handleFiltro = (f: FiltroRapido) => {
    setFiltro(f);
    setPaginaAtual(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (f === 'TODOS') next.delete('reativar');
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await api.delete(`/clientes/${id}`);
      toast.success('Cliente excluído com sucesso!');
      loadClientes(paginaAtual);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir cliente');
    }
  };

  const handleEdit = (c: Cliente) => {
    setClienteEditando(c);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setClienteEditando(null);
    loadClientes(paginaAtual);
  };

  const getStatusInfo = (status: ClienteStatusAuto) => {
    switch (status) {
      case 'ativo':
        return { cor: 'text-badge-pago-text', bg: 'bg-badge-pago', label: 'Ativo' };
      case 'atencao':
        return { cor: 'text-badge-pendente-text', bg: 'bg-badge-pendente', label: 'Atenção' };
      case 'inativo':
        return { cor: 'text-badge-erro-text', bg: 'bg-badge-erro', label: 'Inativo' };
    }
  };

  const telefoneValido = (telefone: string | null): string | null => {
    if (!telefone) return null;
    const num = telefone.replace(/\D/g, '');
    const semZero = num.startsWith('0') ? num.slice(1) : num;
    return semZero.length >= 10 ? semZero : null;
  };

  const applyVars = (template: string, vars: Record<string, string>): string => {
    let s = template;
    Object.entries(vars).forEach(([k, v]) => {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
    });
    return s.replace(/\{[A-Z_]+\}/g, '').trim() || 'Olá!';
  };

  const mensagemWhatsApp = (c: Cliente): string => {
    const nome = c.nome || 'Cliente';
    const dias = String(c.diasInativo ?? 0);
    const vars = { NOME: nome, DIAS: dias };
    if (c.status === 'atencao' && mensagensWhatsApp?.msg_whatsapp_atencao) {
      return applyVars(mensagensWhatsApp.msg_whatsapp_atencao, vars);
    }
    if (c.status === 'inativo' && mensagensWhatsApp?.msg_whatsapp_inativo) {
      return applyVars(mensagensWhatsApp.msg_whatsapp_inativo, vars);
    }
    if (mensagensWhatsApp?.msg_whatsapp_pos_venda && c.status === 'ativo') {
      return applyVars(mensagensWhatsApp.msg_whatsapp_pos_venda, vars);
    }
    return `Olá ${nome}! Tudo bem? Quer agendar um horário? 🙂`;
  };

  const abrirWhatsApp = (c: Cliente) => {
    const tel = telefoneValido(c.telefone);
    if (!tel) {
      toast.error('Telefone não cadastrado');
      return;
    }
    const msg = mensagemWhatsApp(c);
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_POR_PAGINA));
  const inicio = (paginaAtual - 1) * LIMITE_POR_PAGINA;
  const fim = Math.min(inicio + LIMITE_POR_PAGINA, total);

  if (loading && clientes.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
        <span className="text-text-muted">Carregando...</span>
      </div>
    );
  }

  const setTabAndUrl = (t: TabClientes) => {
    setTab(t);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (t === 'lista') next.delete('tab');
      else next.set('tab', t);
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Clientes</h1>
          <p className="text-sm sm:text-base text-text-muted">
            Centro de retenção — reative quem está parado e não perca vendas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="bg-bg-card hover:bg-bg-elevated text-text-main font-medium px-4 py-3 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0 border border-border"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Importar
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Abas Lista | Retenção */}
      <div className="flex rounded-full border border-border bg-bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setTabAndUrl('lista')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'lista' ? 'bg-primary text-[var(--color-text-on-primary)]' : 'text-text-muted hover:text-text-main'}`}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setTabAndUrl('retencao')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'retencao' ? 'bg-primary text-[var(--color-text-on-primary)]' : 'text-text-muted hover:text-text-main'}`}
        >
          Retenção
        </button>
      </div>

      {tab === 'retencao' ? (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-text-muted">Período:</span>
            {(['semana', 'mes', 'trimestre'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodoRetencao(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${periodoRetencao === p ? 'bg-primary text-[var(--color-text-on-primary)]' : 'bg-bg-card border border-border text-text-main hover:bg-bg-elevated'}`}
              >
                {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Trimestre'}
              </button>
            ))}
          </div>
          {loadingRetencao ? (
            <div className="py-12 text-center text-text-muted">Carregando retenção...</div>
          ) : (
            <div className="space-y-8">
              <section className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="text-lg font-semibold text-text-main mb-4">Clientes em risco</h2>
                <p className="text-sm text-text-muted mb-4">Compraram no período anterior e não compraram no atual.</p>
                {clientesEmRisco.length === 0 ? (
                  <p className="text-text-muted">Nenhum cliente em risco neste período.</p>
                ) : (
                  <ul className="space-y-3">
                    {clientesEmRisco.map((c) => {
                      const tel = c.telefone?.replace(/\D/g, '');
                      const telNum = tel && tel.length >= 10 ? (tel.startsWith('0') ? tel.slice(1) : tel) : null;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-text-main">{c.nome}</p>
                            <p className="text-sm text-text-muted">Última compra: {formatDate(c.ultimaCompra)} · {c.diasSemComprar} dias sem comprar · Média {formatCurrency(c.receitaMedia)}</p>
                          </div>
                          {telNum && (
                            <a
                              href={`https://wa.me/55${telNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-medium hover:bg-green-700"
                            >
                              <span className="material-symbols-outlined text-lg">chat</span>
                              WhatsApp
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="text-lg font-semibold text-text-main mb-4">Clientes recuperados</h2>
                <p className="text-sm text-text-muted mb-4">Não compraram no período anterior e voltaram a comprar no atual.</p>
                {clientesRecuperados.length === 0 ? (
                  <p className="text-text-muted">Nenhum cliente recuperado neste período.</p>
                ) : (
                  <ul className="space-y-3">
                    {clientesRecuperados.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border last:border-0">
                        <div>
                          <p className="font-medium text-text-main">{c.nome}</p>
                          <p className="text-sm text-text-muted">
                            Nova compra: {formatDate(c.dataNovaCompra)} · {formatCurrency(c.valorVenda)} · Ficou {c.diasFicouSemComprar} dias sem comprar
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <>
      {/* Busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xl">
            search
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card text-text-main"
          />
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['TODOS', 'Todos'],
            ['ativo', 'Ativos'],
            ['atencao', 'Atenção'],
            ['inativo', 'Inativos'],
            ['novos_no_mes', 'Novos no mês'],
            ['retornaram_no_mes', 'Retornaram']
          ] as [FiltroRapido, string][]
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => handleFiltro(valor)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filtro === valor
                ? 'bg-primary text-text-on-primary'
                : 'bg-bg-card text-text-main hover:bg-bg-elevated border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {total === 0 && !loading ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">group</span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhum cliente encontrado</h3>
          <p className="text-text-muted mb-6">
            {buscaDebounce || filtro !== 'TODOS'
              ? 'Tente outro filtro ou busca.'
              : 'Cadastre seu primeiro cliente.'}
          </p>
          {!buscaDebounce && filtro === 'TODOS' && (
            <button
              onClick={() => setModalOpen(true)}
              className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
            >
              Adicionar Cliente
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-bg-elevated border-b border-border">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Nome
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Telefone
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Última compra
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Dias inativo
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientes.map((c) => {
                    const statusInfo = getStatusInfo(c.status);
                    const temTelefone = !!telefoneValido(c.telefone);
                    return (
                      <tr key={c.id} className="hover:bg-bg-elevated">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-text-main">
                          {c.nome}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">
                          {c.telefone || '—'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">
                          {c.ultimaCompra ? formatDate(c.ultimaCompra) : '—'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-text-muted text-sm">
                          {c.diasInativo !== null
                            ? `${c.diasInativo} ${c.diasInativo === 1 ? 'dia' : 'dias'}`
                            : 'Sem compra'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.cor}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                            {temTelefone ? (
                              <button
                                type="button"
                                onClick={() => abrirWhatsApp(c)}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-success hover:bg-success/10 rounded touch-manipulation"
                                title="Abrir WhatsApp"
                              >
                                <span className="material-symbols-outlined">chat</span>
                              </button>
                            ) : (
                              <span
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted cursor-not-allowed rounded"
                                title="Telefone não cadastrado"
                              >
                                <span className="material-symbols-outlined">chat</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEdit(c)}
                              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-primary hover:bg-primary/10 rounded touch-manipulation"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-error hover:bg-badge-erro/20 rounded touch-manipulation"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPaginas > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-bg-card rounded-xl border border-border p-4">
              <p className="text-xs sm:text-sm text-text-muted text-center sm:text-left">
                Mostrando {inicio + 1} a {fim} de {total} clientes
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                  className="px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-2 text-text-muted text-sm">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}

      {modalOpen && (
        <ClienteModal
          cliente={clienteEditando ? { id: clienteEditando.id, nome: clienteEditando.nome, telefone: clienteEditando.telefone, observacoes: clienteEditando.observacoes } : null}
          onClose={handleCloseModal}
        />
      )}
      {importOpen && (
        <ClienteImportModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => { setImportOpen(false); loadClientes(1); setPaginaAtual(1); }}
        />
      )}
    </div>
  );
}
