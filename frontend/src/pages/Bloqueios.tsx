import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Bloqueio {
  id: string;
  tipo: string;
  dia_semana: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Bloqueios() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Bloqueio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await api.get('/bloqueios');
      setLista(res.data);
    } catch {
      toast.error('Erro ao carregar bloqueios');
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este bloqueio?')) return;
    try {
      await api.delete(`/bloqueios/${id}`);
      toast.success('Bloqueio removido');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/agendamentos')} className="p-2 rounded-lg hover:bg-surface-elevated text-text-muted">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-2xl font-bold text-text-main">Bloqueios</h1>
      </div>

      <p className="text-text-muted text-sm">
        Bloqueios recorrentes (por dia da semana) ou por intervalo de datas. Configure em Configurações da Agenda e depois adicione aqui.
      </p>

      {loading ? (
        <p className="text-text-muted">Carregando...</p>
      ) : lista.length === 0 ? (
        <div className="bg-surface-light rounded-xl border border-border-light p-8 text-center text-text-muted">
          Nenhum bloqueio. Use a API ou crie uma tela de novo bloqueio (POST /api/bloqueios).
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((b) => (
            <li key={b.id} className="flex items-center justify-between bg-surface-light rounded-lg border border-border-light p-4">
              <div className="text-text-main">
                {b.tipo === 'RECORRENTE' && (
                  <>
                    <strong>{DIAS[b.dia_semana ?? 0]}</strong> {b.hora_inicio} – {b.hora_fim}
                  </>
                )}
                {b.tipo === 'INTERVALO_DATA' && (
                  <>
                    <strong>Intervalo</strong> {b.data_inicio?.slice(0, 10)} até {b.data_fim?.slice(0, 10)}
                    {b.hora_inicio && ` (${b.hora_inicio}–${b.hora_fim})`}
                  </>
                )}
              </div>
              <button onClick={() => handleDelete(b.id)} className="text-error hover:bg-badge-erro p-2 rounded">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
