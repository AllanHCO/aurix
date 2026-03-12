import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import CadastroProdutos from '../components/CadastroProdutos';
import CategoriasTab from '../components/CategoriasTab';
import HistoricoComprasTab from '../components/HistoricoComprasTab';

type AbaProdutos = 'produtos' | 'categorias' | 'historico-compras';
type FiltroProduto = 'todos' | 'mais_vendidos' | 'menos_vendidos' | 'estoque_baixo';
type PeriodoProduto = 'este_mes' | 'ultimos_3_meses';

export default function Produtos() {
  const { getModuleLabel, getModuleConfig } = usePersonalizacao();
  const [searchParams, setSearchParams] = useSearchParams();
  const abaUrl = searchParams.get('aba') as AbaProdutos | null;
  const produtoIdUrl = searchParams.get('produto_id');
  const filtroUrl = searchParams.get('filtro') as FiltroProduto | null;
  const periodoUrl = searchParams.get('periodo') as PeriodoProduto | null;
  const initialFiltro = filtroUrl && ['todos', 'mais_vendidos', 'menos_vendidos', 'estoque_baixo'].includes(filtroUrl) ? filtroUrl : undefined;
  const initialPeriodo = periodoUrl && ['este_mes', 'ultimos_3_meses'].includes(periodoUrl) ? periodoUrl : undefined;

  const [aba, setAba] = useState<AbaProdutos>(abaUrl && ['produtos', 'categorias', 'historico-compras'].includes(abaUrl) ? abaUrl : 'produtos');

  useEffect(() => {
    if (abaUrl && abaUrl !== aba && ['produtos', 'categorias', 'historico-compras'].includes(abaUrl)) setAba(abaUrl);
  }, [abaUrl]);

  const setAbaAndUrl = (novaAba: AbaProdutos, produtoId?: string) => {
    setAba(novaAba);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('aba', novaAba);
      if (produtoId) next.set('produto_id', produtoId);
      else next.delete('produto_id');
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">{getModuleLabel('produtos')}</h1>
        <p className="text-sm sm:text-base text-text-muted">Cadastro de produtos e categorias</p>
      </div>

      {/* Abas Lista | Categorias | Histórico de compras */}
      <div className="border-b border-border">
        <nav className="flex gap-6 sm:gap-8" aria-label="Abas do módulo Produtos">
          <button
            type="button"
            onClick={() => setAbaAndUrl('produtos')}
            className={`pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              aba === 'produtos'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
            }`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setAbaAndUrl('categorias')}
            className={`pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              aba === 'categorias'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
            }`}
          >
            Categorias
          </button>
          <button
            type="button"
            onClick={() => setAbaAndUrl('historico-compras')}
            className={`pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              aba === 'historico-compras'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
            }`}
          >
            Histórico de compras
          </button>
        </nav>
      </div>

      {aba === 'produtos' && <CadastroProdutos initialFiltro={initialFiltro} initialPeriodo={initialPeriodo} stockEnabled={getModuleConfig('produtos').controlar_estoque} onOpenHistoricoCompras={(productId) => setAbaAndUrl('historico-compras', productId)} />}
      {aba === 'categorias' && <CategoriasTab />}
      {aba === 'historico-compras' && <HistoricoComprasTab initialProductId={produtoIdUrl || null} />}
    </div>
  );
}
