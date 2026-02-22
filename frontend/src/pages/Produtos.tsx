import { useState } from 'react';
import CadastroProdutos from '../components/CadastroProdutos';
import CategoriasTab from '../components/CategoriasTab';

type AbaProdutos = 'produtos' | 'categorias';

export default function Produtos() {
  const [aba, setAba] = useState<AbaProdutos>('produtos');

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Produtos</h1>
        <p className="text-sm sm:text-base text-text-muted">Cadastro de produtos e categorias</p>
      </div>

      {/* Seletor: tabs no topo */}
      <div className="flex border-b border-border-light">
        <button
          type="button"
          onClick={() => setAba('produtos')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 min-h-[44px] touch-manipulation transition-colors ${
            aba === 'produtos'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-main hover:border-border-light'
          }`}
        >
          <span className="material-symbols-outlined text-lg">inventory_2</span>
          Cadastro de Produtos
        </button>
        <button
          type="button"
          onClick={() => setAba('categorias')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 min-h-[44px] touch-manipulation transition-colors ${
            aba === 'categorias'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-main hover:border-border-light'
          }`}
        >
          <span className="material-symbols-outlined text-lg">folder</span>
          Categorias
        </button>
      </div>

      {aba === 'produtos' && <CadastroProdutos />}
      {aba === 'categorias' && <CategoriasTab />}
    </div>
  );
}
