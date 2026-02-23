import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/format';
import ClienteModal from '../components/ClienteModal';

export type ClienteStatusManual = 'ativo' | 'atencao' | 'inativo';
type FiltroStatus = 'TODOS' | ClienteStatusManual;

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status: ClienteStatusManual;
  ultimaCompra: string | null;
  diasInativo: number | null;
}

const ITENS_POR_PAGINA = 10;

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    // Resetar página ao mudar filtro
    setPaginaAtual(1);
  }, [filtroStatus]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clientes');
      
      console.log('Resposta da API:', response.data);
      
      // Validar se os dados estão no formato esperado
      if (Array.isArray(response.data)) {
        // Normalizar os dados para garantir formato correto
        const clientesNormalizados: Cliente[] = response.data.map((cliente: any) => ({
          id: cliente.id || '',
          nome: cliente.nome || cliente.name || '',
          telefone: cliente.telefone || null,
          observacoes: cliente.observacoes || null,
          status: cliente.status === 'atencao' || cliente.status === 'inativo' ? cliente.status : 'ativo',
          ultimaCompra: cliente.ultimaCompra || null,
          diasInativo: cliente.diasInativo !== undefined ? cliente.diasInativo : null
        }));
        
        console.log('Clientes normalizados:', clientesNormalizados);
        setClientes(clientesNormalizados);
      } else {
        console.error('Resposta inválida do servidor:', response.data);
        toast.error('Formato de dados inválido');
        setClientes([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao carregar clientes';
      toast.error(errorMessage);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  // Usar useMemo para calcular clientes filtrados
  const clientesFiltrados = useMemo(() => {
    if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
      return [];
    }
    
    if (filtroStatus === 'TODOS') {
      return clientes;
    }
    return clientes.filter((c) => c && c.status === filtroStatus);
  }, [clientes, filtroStatus]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      await api.delete(`/clientes/${id}`);
      toast.success('Cliente excluído com sucesso!');
      loadClientes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir cliente');
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setClienteEditando(null);
    loadClientes();
  };

  const getStatusInfo = (status: ClienteStatusManual) => {
    switch (status) {
      case 'ativo':
        return { cor: 'text-badge-pago-text', bg: 'bg-badge-pago', label: 'Ativo' };
      case 'atencao':
        return { cor: 'text-badge-pendente-text', bg: 'bg-badge-pendente', label: 'Atenção' };
      case 'inativo':
        return { cor: 'text-badge-erro-text', bg: 'bg-badge-erro', label: 'Inativo' };
    }
  };

  const formatarTelefoneWhatsApp = (telefone: string | null): string | null => {
    if (!telefone) return null;
    // Remove caracteres não numéricos
    const apenasNumeros = telefone.replace(/\D/g, '');
    // Se começar com 0, remove
    const semZeroInicial = apenasNumeros.startsWith('0') ? apenasNumeros.slice(1) : apenasNumeros;
    return semZeroInicial;
  };

  const abrirWhatsApp = (cliente: Cliente) => {
    const telefoneFormatado = formatarTelefoneWhatsApp(cliente.telefone);
    if (!telefoneFormatado) {
      toast.error('Telefone não disponível para este cliente');
      return;
    }
    const dias = cliente.diasInativo ?? null;
    const mensagem = dias !== null
      ? `Olá ${cliente.nome}! Tudo bem? Faz ${dias} ${dias === 1 ? 'dia' : 'dias'} que você não aparece por aqui. Quer agendar um horário? 😊`
      : `Olá ${cliente.nome}! Tudo bem? Quer agendar um horário? 😊`;
    const url = `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  // Paginação usando useMemo
  const { clientesPaginados, totalPaginas, inicio, fim } = useMemo(() => {
    const total = Math.ceil(clientesFiltrados.length / ITENS_POR_PAGINA);
    const inicioIdx = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fimIdx = inicioIdx + ITENS_POR_PAGINA;
    const paginados = clientesFiltrados.slice(inicioIdx, fimIdx);
    
    return {
      clientesPaginados: paginados,
      totalPaginas: total,
      inicio: inicioIdx,
      fim: fimIdx
    };
  }, [clientesFiltrados, paginaAtual]);

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Clientes</h1>
          <p className="text-sm sm:text-base text-text-muted">Gerencie sua base de clientes e monitore a inatividade</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Novo Cliente
        </button>
      </div>

      {/* Filtros rápidos por status */}
      <div className="flex gap-2 flex-wrap">
        {(['TODOS', 'ativo', 'atencao', 'inativo'] as FiltroStatus[]).map((filtro) => {
          const count = filtro === 'TODOS'
            ? (clientes?.length || 0)
            : (clientes?.filter((c) => c && c.status === filtro).length || 0);
          return (
            <button
              key={filtro}
              onClick={() => setFiltroStatus(filtro)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtroStatus === filtro
                  ? 'bg-primary text-text-on-primary'
                  : 'bg-surface-light text-text-main hover:bg-background-light border border-border-light'
              }`}
            >
              {filtro === 'TODOS' ? 'Todos' : filtro === 'ativo' ? 'Ativo' : filtro === 'atencao' ? 'Atenção' : 'Inativo'} ({count})
            </button>
          );
        })}
      </div>

      {!clientes || clientes.length === 0 ? (
        <div className="bg-surface-light rounded-xl border border-border-light p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            group
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhum cliente cadastrado</h3>
          <p className="text-text-muted mb-6">
            Comece adicionando seu primeiro cliente
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
          >
            Adicionar Cliente
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface-light rounded-xl border border-border-light shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="w-full min-w-[640px]">
                <thead className="bg-background-light border-b border-border-light">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Nome
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Telefone
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                      Última Compra
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Dias Inativo
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {clientesPaginados && clientesPaginados.length > 0 ? (
                    clientesPaginados.map((cliente) => {
                        const statusInfo = getStatusInfo(cliente.status);
                        return (
                          <tr key={cliente.id} className="hover:bg-background-light">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-text-main">{cliente.nome}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{cliente.telefone || '-'}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">
                          {cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-text-muted text-sm">
                          {cliente.diasInativo !== null ? `${cliente.diasInativo} ${cliente.diasInativo === 1 ? 'dia' : 'dias'}` : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.cor}`}>
                            {statusInfo.label}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                            {cliente.telefone && (
                              <button
                                onClick={() => abrirWhatsApp(cliente)}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-success hover:bg-primary-light rounded touch-manipulation"
                                title="Abrir WhatsApp"
                              >
                                <span className="material-symbols-outlined">chat</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(cliente)}
                              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-primary hover:bg-primary/10 rounded touch-manipulation"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(cliente.id)}
                              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-error hover:bg-badge-erro rounded touch-manipulation"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-text-muted text-sm">
                        Nenhum cliente encontrado com o filtro selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-light rounded-xl border border-border-light p-4">
              <div className="text-xs sm:text-sm text-text-muted text-center sm:text-left">
                Mostrando {inicio + 1} a {Math.min(fim, clientesFiltrados.length)} de {clientesFiltrados.length} clientes
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                  className="px-4 py-2 border border-border-light rounded-lg text-text-main hover:bg-background-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => (
                    <button
                      key={pagina}
                      onClick={() => setPaginaAtual(pagina)}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        paginaAtual === pagina
                          ? 'bg-primary text-text-on-primary'
                          : 'bg-background-light text-text-main hover:bg-background-light border border-border-light'
                      }`}
                    >
                      {pagina}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-4 py-2 border border-border-light rounded-lg text-text-main hover:bg-background-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <ClienteModal
          cliente={clienteEditando}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
