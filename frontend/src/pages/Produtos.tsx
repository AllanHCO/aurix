import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CadastroProdutos from '../components/CadastroProdutos';
import CategoriasTab from '../components/CategoriasTab';

type AbaProdutos = 'produtos' | 'categorias';
type FiltroProduto = 'todos' | 'mais_vendidos' | 'menos_vendidos' | 'estoque_baixo';
type PeriodoProduto = 'este_mes' | 'ultimos_3_meses';

const opcoes: { value: AbaProdutos; label: string; icon: string }[] = [
  { value: 'produtos', label: 'Cadastro de Produtos', icon: 'inventory_2' },
  { value: 'categorias', label: 'Categorias', icon: 'folder' }
];

export default function Produtos() {
  const [searchParams] = useSearchParams();
  const filtroUrl = searchParams.get('filtro') as FiltroProduto | null;
  const periodoUrl = searchParams.get('periodo') as PeriodoProduto | null;
  const initialFiltro = filtroUrl && ['todos', 'mais_vendidos', 'menos_vendidos', 'estoque_baixo'].includes(filtroUrl) ? filtroUrl : undefined;
  const initialPeriodo = periodoUrl && ['este_mes', 'ultimos_3_meses'].includes(periodoUrl) ? periodoUrl : undefined;

  const [aba, setAba] = useState<AbaProdutos>('produtos');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const opcaoAtiva = opcoes.find((o) => o.value === aba) ?? opcoes[0];

  const selectOpcao = (value: AbaProdutos) => {
    setAba(value);
    setDropdownOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Produtos</h1>
        <p className="text-sm sm:text-base text-text-muted">Cadastro de produtos e categorias</p>
      </div>

      {/* Dropdown fixo no topo */}
      <div className="sticky top-0 z-20 bg-bg-main pb-2 -mx-2 px-2 sm:mx-0 sm:px-0" ref={dropdownRef}>
        <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-text-main font-medium hover:bg-bg-main-light transition-colors min-h-[48px] touch-manipulation"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            aria-label="Selecionar seção"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">{opcaoAtiva.icon}</span>
              {opcaoAtiva.label}
            </span>
            <span className={`material-symbols-outlined text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          {dropdownOpen && (
            <ul className="border-t border-border" role="listbox">
              {opcoes.map((op) => (
                <li key={op.value} role="option" aria-selected={aba === op.value}>
                  <button
                    type="button"
                    onClick={() => selectOpcao(op.value)}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium min-h-[44px] touch-manipulation transition-colors ${
                      aba === op.value
                        ? 'bg-primary/15 text-primary'
                        : 'text-text-main hover:bg-bg-main-light'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{op.icon}</span>
                    {op.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {aba === 'produtos' && <CadastroProdutos initialFiltro={initialFiltro} initialPeriodo={initialPeriodo} />}
      {aba === 'categorias' && <CategoriasTab />}
    </div>
  );
}
