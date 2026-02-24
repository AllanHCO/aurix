import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';

interface VendaPendente {
  id: string;
  total: number;
  createdAt: string;
  cliente: { nome: string };
}

interface AgendamentoPendente {
  id: string;
  nome_cliente: string;
  data: string;
  hora_inicio: string;
}

export default function Pendencias() {
  const navigate = useNavigate();
  const [vendas, setVendas] = useState<VendaPendente[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<VendaPendente[]>('/vendas', { params: { status: 'PENDENTE' } }),
      api.get<AgendamentoPendente[]>('/agendamentos/pendentes')
    ])
      .then(([vRes, aRes]) => {
        setVendas(Array.isArray(vRes.data) ? vRes.data : []);
        setAgendamentos(Array.isArray(aRes.data) ? aRes.data : []);
      })
      .catch(() => toast.error('Erro ao carregar pendências'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-7xl mx-auto py-12 text-center text-text-muted">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1">Pendências</h1>
        <p className="text-sm text-text-muted">
          Vendas e agendamentos pendentes de confirmação ou pagamento
        </p>
      </div>

      {/* Vendas pendentes */}
      <section className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Vendas pendentes</h2>
            <p className="text-sm text-text-muted">{vendas.length} registro(s)</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/vendas?status=PENDENTE')}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg"
          >
            Abrir vendas
          </button>
        </div>
        {vendas.length === 0 ? (
          <p className="p-4 sm:p-6 text-text-muted text-sm">Nenhuma venda pendente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {vendas.slice(0, 5).map((v) => (
              <li key={v.id} className="px-4 sm:px-6 py-3 flex items-center justify-between">
                <span className="text-text-main font-medium truncate">{v.cliente.nome}</span>
                <span className="text-text-muted text-sm shrink-0 ml-2">
                  {formatCurrency(Number(v.total))} · {formatDate(v.createdAt)}
                </span>
              </li>
            ))}
            {vendas.length > 5 && (
              <li className="px-4 sm:px-6 py-2 text-sm text-text-muted">
                + {vendas.length - 5} mais. Clique em &quot;Abrir vendas&quot; para ver todos.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Agendamentos pendentes */}
      <section className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Agendamentos pendentes</h2>
            <p className="text-sm text-text-muted">{agendamentos.length} registro(s)</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/agendamentos?status=PENDENTE')}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg"
          >
            Abrir agendamentos
          </button>
        </div>
        {agendamentos.length === 0 ? (
          <p className="p-4 sm:p-6 text-text-muted text-sm">Nenhum agendamento pendente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {agendamentos.slice(0, 5).map((a) => (
              <li key={a.id} className="px-4 sm:px-6 py-3 flex items-center justify-between">
                <span className="text-text-main font-medium truncate">{a.nome_cliente}</span>
                <span className="text-text-muted text-sm shrink-0 ml-2">
                  {formatDate(a.data)} · {a.hora_inicio}
                </span>
              </li>
            ))}
            {agendamentos.length > 5 && (
              <li className="px-4 sm:px-6 py-2 text-sm text-text-muted">
                + {agendamentos.length - 5} mais. Clique em &quot;Abrir agendamentos&quot; para ver todos.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
