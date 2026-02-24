# Código atual do Dashboard (para comparação / outra IA)

Use este arquivo para enviar a outra IA ou para comparar. Contém o **frontend** (React) e o **backend** (Node/Express) do Dashboard.

---

## 1. Frontend – página do Dashboard

**Arquivo no projeto:** `frontend/src/pages/Dashboard.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import { formatDate } from '../utils/format';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Periodo = 'semana' | 'mes' | 'trimestre';

interface DashboardSummary {
  periodo: Periodo;
  modulos: { agendamento: boolean; produtos: boolean; vendas: boolean };
  resultado: {
    faturamento: number;
    faturamentoAnterior: number;
    variacaoPercentual: number | null;
    ticketMedio: number;
    qtdVendasPagas: number;
  };
  retencao: {
    clientesAtencao: number;
    clientesInativo: number;
    receitaMediaPorCliente: number;
    estimativaReceitaRisco: number;
  };
  operacional: {
    qtdVendasPeriodo: number;
    estoqueBaixoCount: number;
    produtosEstoqueBaixo: Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>;
    proximosAgendamentos: Array<{ id: string; nome_cliente: string; data: string; hora_inicio: string; status: string }>;
  };
  grafico?: {
    labels: string[];
    receitaAtual: number[];
    receitaAnterior: number[];
    ticketMedioAtual: number[];
    ticketMedioAnterior: number[];
  };
  atividadesRecentes?: Array<{ tipo: string; id: string; nome: string; horario: string; valor?: number }>;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Semana',
  mes: 'Mês',
  trimestre: 'Trimestre'
};

function DesempenhoChart({
  labels,
  atual,
  anterior,
  valorTotal,
  variacao
}: {
  labels: string[];
  atual: number[];
  anterior: number[];
  valorTotal: number;
  variacao: number | null;
}) {
  const maxVal = Math.max(1, ...atual, ...anterior);
  const w = 100;
  const h = 28;
  const pad = 2;
  const pointsAtual = atual.map((v, i) => {
    const x = labels.length <= 1 ? pad : pad + (i / (labels.length - 1)) * (w - 2 * pad);
    const y = h - pad - (maxVal > 0 ? (v / maxVal) * (h - 2 * pad) : 0);
    return `${x},${y}`;
  }).join(' ');
  const pointsAnterior = anterior.map((v, i) => {
    const x = labels.length <= 1 ? pad : pad + (i / (labels.length - 1)) * (w - 2 * pad);
    const y = h - pad - (maxVal > 0 ? (v / maxVal) * (h - 2 * pad) : 0);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-2xl font-bold text-text-main">{formatCurrency(valorTotal)}</span>
        {variacao != null && (
          <span className={`text-sm font-medium ${variacao >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            {variacao >= 0 ? '↑' : '↓'} {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}% vs período anterior
          </span>
        )}
      </div>
      <div className="h-[200px] w-full" style={{ minHeight: 200 }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full block">
          <polyline fill="none" stroke="var(--color-primary)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" points={pointsAtual} />
          <polyline fill="none" stroke="var(--color-text-muted)" strokeWidth="0.6" strokeDasharray="1,1" strokeLinecap="round" strokeLinejoin="round" points={pointsAnterior} />
        </svg>
      </div>
      <div className="flex justify-between mt-2 text-xs text-text-muted">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-primary rounded" /> Período atual</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border border-text-muted border-dashed rounded" /> Anterior</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [chartToggle, setChartToggle] = useState<'receita' | 'ticket'>('receita');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [periodo]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardSummary>('/dashboard/summary', { params: { periodo } });
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar o painel');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
        <span className="text-text-muted">Carregando...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20 text-text-muted">
        Não foi possível carregar os dados do painel.
      </div>
    );
  }

  const { resultado, retencao, operacional, modulos, grafico, atividadesRecentes } = data;
  const variacao = resultado.variacaoPercentual;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-bold text-text-main">Dashboard</h1>
        <div className="flex rounded-lg border border-border-light bg-surface overflow-hidden shadow-sm">
          {(['semana', 'mes', 'trimestre'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                periodo === p ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-elevated hover:text-text-main'
              }`}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-surface border border-border-light p-4 shadow-sm flex flex-col">
          <div className="flex justify-between items-start">
            <span className="text-sm text-text-muted">Faturamento</span>
            <span className="material-symbols-outlined text-primary text-xl">payments</span>
          </div>
          <p className="text-xl font-bold text-text-main mt-1">{formatCurrency(resultado.faturamento)}</p>
          {variacao != null && (
            <p className={`text-xs font-medium mt-0.5 flex items-center gap-0.5 ${variacao >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {variacao >= 0 ? '↑' : '↓'} {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}% vs anterior
            </p>
          )}
        </div>
        <div className="rounded-xl bg-surface border border-border-light p-4 shadow-sm flex flex-col">
          <div className="flex justify-between items-start">
            <span className="text-sm text-text-muted">Crescimento</span>
            <span className={`material-symbols-outlined text-xl ${variacao != null && variacao >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {variacao != null && variacao >= 0 ? 'trending_up' : 'trending_down'}
            </span>
          </div>
          <p className={`text-xl font-bold mt-1 ${variacao != null && variacao >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            {variacao != null ? `${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">vs período anterior</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-light p-4 shadow-sm flex flex-col">
          <div className="flex justify-between items-start">
            <span className="text-sm text-text-muted">Ticket médio</span>
            <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
          </div>
          <p className="text-xl font-bold text-text-main mt-1">{formatCurrency(resultado.ticketMedio)}</p>
          <p className="text-xs text-text-muted mt-0.5">{resultado.qtdVendasPagas} vendas</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-light p-4 shadow-sm flex flex-col">
          <div className="flex justify-between items-start">
            <span className="text-sm text-text-muted">Vendas no período</span>
            <span className="material-symbols-outlined text-primary text-xl">shopping_cart</span>
          </div>
          <p className="text-xl font-bold text-text-main mt-1">{operacional.qtdVendasPeriodo}</p>
          <p className="text-xs text-text-muted mt-0.5">vendas pagas</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-7 rounded-xl bg-surface border border-border-light p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-text-main">Desempenho do período</h2>
            <div className="flex rounded-lg border border-border-light overflow-hidden">
              <button type="button" onClick={() => setChartToggle('receita')} className={`px-3 py-1.5 text-sm font-medium ${chartToggle === 'receita' ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-elevated'}`}>Receita</button>
              <button type="button" onClick={() => setChartToggle('ticket')} className={`px-3 py-1.5 text-sm font-medium ${chartToggle === 'ticket' ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-elevated'}`}>Ticket médio</button>
            </div>
          </div>
          {grafico && (
            <DesempenhoChart labels={grafico.labels} atual={chartToggle === 'receita' ? grafico.receitaAtual : grafico.ticketMedioAtual} anterior={chartToggle === 'receita' ? grafico.receitaAnterior : grafico.ticketMedioAnterior} valorTotal={chartToggle === 'receita' ? resultado.faturamento : resultado.ticketMedio} variacao={variacao} />
          )}
          {!grafico && <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">Sem dados para exibir o gráfico</div>}
        </div>
        <div className="lg:col-span-3 rounded-xl bg-surface border border-border-light p-4 shadow-sm flex flex-col">
          <h2 className="text-base font-semibold text-text-main mb-3">Atividades recentes</h2>
          <ul className="space-y-2 flex-1 min-h-0 overflow-auto">
            {(atividadesRecentes || []).length === 0 ? <li className="text-sm text-text-muted">Nenhuma atividade recente</li> : (atividadesRecentes || []).slice(0, 8).map((a) => (
              <li key={`${a.tipo}-${a.id}`} className="flex items-start gap-2 text-sm">
                <span className="material-symbols-outlined text-lg text-primary shrink-0">{a.tipo === 'venda' ? 'payments' : 'event'}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-main truncate">{a.nome}</p>
                  <p className="text-xs text-text-muted">{formatDistanceToNow(new Date(a.horario), { addSuffix: true, locale: ptBR })}{a.valor != null && a.valor > 0 && ` · ${formatCurrency(a.valor)}`}</p>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => navigate('/vendas')} className="mt-3 text-sm font-medium text-primary hover:underline">Ver todas</button>
        </div>
      </div>

      {retencao.estimativaReceitaRisco > 0 && (
        <section className="rounded-xl bg-[var(--color-primary-light)]/40 dark:bg-primary/10 border border-primary/20 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-text-main mb-2">Oportunidade de receita</h2>
          <p className="text-sm text-text-main mb-4">Você pode recuperar aproximadamente <strong>{formatCurrency(retencao.estimativaReceitaRisco)}</strong> reativando clientes inativos.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/clientes?status=inativo')} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"><span className="material-symbols-outlined text-lg">group</span> Reativar clientes</button>
            <button type="button" onClick={() => navigate('/clientes?status=inativo')} className="inline-flex items-center gap-2 rounded-lg border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-primary/10">Ver lista</button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modulos.produtos && (
          <button type="button" onClick={() => navigate('/produtos?filtro=estoque_baixo')} className="rounded-xl bg-surface border border-border-light p-4 text-left shadow-sm hover:bg-surface-elevated transition-colors">
            <p className="text-sm font-medium text-text-muted">Produtos com estoque baixo</p>
            <p className="text-xl font-bold text-text-main mt-0.5">{operacional.estoqueBaixoCount}</p>
            {operacional.produtosEstoqueBaixo.length > 0 && <ul className="text-xs text-text-muted mt-2 space-y-0.5">{operacional.produtosEstoqueBaixo.slice(0, 3).map((p) => <li key={p.id}>{p.nome} — {p.estoque_atual} un.</li>)}</ul>}
          </button>
        )}
        {modulos.agendamento && (
          <button type="button" onClick={() => navigate('/agendamentos')} className="rounded-xl bg-surface border border-border-light p-4 text-left shadow-sm hover:bg-surface-elevated transition-colors">
            <p className="text-sm font-medium text-text-muted">Próximos agendamentos</p>
            {operacional.proximosAgendamentos.length === 0 ? <p className="text-text-muted mt-0.5 text-sm">Nenhum agendamento próximo</p> : <ul className="text-sm text-text-main mt-2 space-y-1">{operacional.proximosAgendamentos.slice(0, 3).map((a) => <li key={a.id}>{a.nome_cliente} — {formatDate(a.data)} {a.hora_inicio}</li>)}</ul>}
          </button>
        )}
      </section>
    </div>
  );
}
```

---

## 2. Backend – controller do Dashboard

**Arquivo no projeto:** `backend/src/controllers/dashboard.controller.ts`

(O controller completo tem ~370 linhas. Resposta da API: `GET /api/dashboard/summary?periodo=semana|mes|trimestre` retorna: `periodo`, `modulos`, `resultado` (faturamento, faturamentoAnterior, variacaoPercentual, ticketMedio, qtdVendasPagas), `retencao` (clientesAtencao, clientesInativo, receitaMediaPorCliente, estimativaReceitaRisco), `operacional` (qtdVendasPeriodo, estoqueBaixoCount, produtosEstoqueBaixo, proximosAgendamentos), `grafico` (labels, receitaAtual, receitaAnterior, ticketMedioAtual, ticketMedioAnterior), `atividadesRecentes` (array de { tipo, id, nome, horario, valor? }).)

Para ter o **código completo do controller**, abra no projeto:
- `backend/src/controllers/dashboard.controller.ts`

Ou rode no terminal (na raiz do projeto):
```bash
# Windows PowerShell
Get-Content backend\src\controllers\dashboard.controller.ts
```

---

## Como usar

1. **Copiar daqui:** abra `docs/DASHBOARD-CODIGO-ATUAL.md` no projeto e copie o trecho que precisar (frontend completo está no markdown; backend está referenciado).
2. **Enviar para outra IA:** cole o conteúdo deste arquivo (e, se quiser, o conteúdo de `dashboard.controller.ts`) no chat da outra IA e peça a comparação/ajuste que precisar.
3. **Caminhos no projeto:**
   - Frontend: `frontend/src/pages/Dashboard.tsx`
   - Backend: `backend/src/controllers/dashboard.controller.ts`
   - Rotas do dashboard: `backend/src/routes/dashboard.routes.ts` (GET `/`, GET `/summary`)
