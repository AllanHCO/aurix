import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/format';
import ClienteModal from '../components/ClienteModal';

type StatusInatividade = 'ATIVO' | 'ATENCAO' | 'INATIVO' | 'NOVO';
type FiltroStatus = 'TODOS' | StatusInatividade;

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  ultimaCompra: string | null;
  diasInativo: number | null;
  statusInatividade: StatusInatividade;
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
          ultimaCompra: cliente.ultimaCompra || null,
          diasInativo: cliente.diasInativo !== undefined ? cliente.diasInativo : null,
          statusInatividade: cliente.statusInatividade || 'NOVO'
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
    
    return clientes.filter((c) => c && c.statusInatividade === filtroStatus);
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

  const getStatusInfo = (status: StatusInatividade) => {
    switch (status) {
      case 'ATIVO':
        return {
          cor: 'text-green-600',
          bg: 'bg-green-100',
          icon: 'check_circle',
          tooltip: 'Cliente ativo - menos de 30 dias sem comprar'
        };
      case 'ATENCAO':
        return {
          cor: 'text-yellow-600',
          bg: 'bg-yellow-100',
          icon: 'warning',
          tooltip: 'Atenção - entre 30 e 45 dias sem comprar'
        };
      case 'INATIVO':
        return {
          cor: 'text-red-600',
          bg: 'bg-red-100',
          icon: 'cancel',
          tooltip: 'Cliente inativo - mais de 45 dias sem comprar'
        };
      case 'NOVO':
        return {
          cor: 'text-gray-600',
          bg: 'bg-gray-100',
          icon: 'person_add',
          tooltip: 'Cliente novo - ainda não realizou nenhuma compra'
        };
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

    let mensagem = '';
    if (cliente.statusInatividade === 'NOVO') {
      mensagem = `Olá ${cliente.nome}! Tudo bem? Quer agendar um horário? 😊`;
    } else {
      const dias = cliente.diasInativo || 0;
      mensagem = `Olá ${cliente.nome}! Tudo bem? Faz ${dias} ${dias === 1 ? 'dia' : 'dias'} que você não aparece por aqui. Quer agendar um horário? 😊`;
    }

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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2">Clientes</h1>
          <p className="text-text-muted">Gerencie sua base de clientes e monitore a inatividade</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Novo Cliente
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 flex-wrap">
        {(['TODOS', 'ATIVO', 'ATENCAO', 'INATIVO', 'NOVO'] as FiltroStatus[]).map((filtro) => {
          const count = filtro === 'TODOS' 
            ? (clientes?.length || 0)
            : (clientes?.filter((c) => c && c.statusInatividade === filtro).length || 0);
          
          return (
            <button
              key={filtro}
              onClick={() => setFiltroStatus(filtro)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtroStatus === filtro
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-main hover:bg-background-light border border-border-light'
              }`}
            >
              {filtro === 'TODOS' ? 'Todos' : 
               filtro === 'ATIVO' ? 'Ativos' :
               filtro === 'ATENCAO' ? 'Atenção' :
               filtro === 'INATIVO' ? 'Inativos' : 'Novos'} ({count})
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
            className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-lg"
          >
            Adicionar Cliente
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface-light rounded-xl border border-border-light shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-light border-b border-border-light">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                      Nome
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                      Telefone
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                      Última Compra
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-text-muted">
                      Dias Inativo
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-text-muted">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {clientesPaginados && clientesPaginados.length > 0 ? (
                    clientesPaginados
                      .filter((cliente) => cliente && cliente.statusInatividade)
                      .map((cliente) => {
                        const statusInfo = getStatusInfo(cliente.statusInatividade);
                        return (
                          <tr key={cliente.id} className="hover:bg-background-light">
                        <td className="px-6 py-4 font-semibold text-text-main">{cliente.nome}</td>
                        <td className="px-6 py-4 text-text-muted">{cliente.telefone || '-'}</td>
                        <td className="px-6 py-4 text-text-muted">
                          {cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center text-text-muted">
                          {cliente.diasInativo !== null ? `${cliente.diasInativo} ${cliente.diasInativo === 1 ? 'dia' : 'dias'}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <div
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${statusInfo.bg} ${statusInfo.cor} relative group`}
                              title={statusInfo.tooltip}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {statusInfo.icon}
                              </span>
                              <span className="text-xs font-medium">
                                {cliente.statusInatividade === 'ATIVO' ? 'Ativo' :
                                 cliente.statusInatividade === 'ATENCAO' ? 'Atenção' :
                                 cliente.statusInatividade === 'INATIVO' ? 'Inativo' : 'Novo'}
                              </span>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                {statusInfo.tooltip}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {cliente.telefone && (
                              <button
                                onClick={() => abrirWhatsApp(cliente)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                                title="Abrir WhatsApp"
                              >
                                <span className="material-symbols-outlined">chat</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(cliente)}
                              className="p-2 text-primary hover:bg-primary/10 rounded"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(cliente.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                      <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                        Nenhum cliente encontrado com o filtro selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between bg-surface-light rounded-xl border border-border-light p-4">
              <div className="text-sm text-text-muted">
                Mostrando {inicio + 1} a {Math.min(fim, clientesFiltrados.length)} de {clientesFiltrados.length} clientes
              </div>
              <div className="flex gap-2">
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
                          ? 'bg-primary text-white'
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
