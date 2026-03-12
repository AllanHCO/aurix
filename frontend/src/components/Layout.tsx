import { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePersonalizacao, type ModuleKey } from '../contexts/PersonalizacaoContext';
import { api } from '../services/api';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import AreaFilterSelect from './AreaFilterSelect';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';

type SearchItem = { id: string; tipo: string; label: string; sublabel?: string; rota: string };

const MENU_STRUCTURE = [
  { path: '/dashboard', icon: 'dashboard', moduleKey: null as string | null },
  { path: '/clientes', icon: 'group', moduleKey: 'clientes' },
  { path: '/produtos', icon: 'inventory_2', moduleKey: 'produtos' },
  { path: '/vendas', icon: 'payments', moduleKey: 'vendas' },
  { path: '/financeiro', icon: 'account_balance_wallet', moduleKey: 'financeiro' },
  { path: '/fornecedores', icon: 'local_shipping', moduleKey: 'fornecedores' },
  { path: '/agendamentos', icon: 'calendar_month', moduleKey: 'agendamentos' },
  { path: '/relatorios', icon: 'bar_chart', moduleKey: 'relatorios' }
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { getModuleLabel, isModuleEnabled } = usePersonalizacao();
  const { areas, selectedAreaId } = useBusinessAreas();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ clientes: SearchItem[]; vendas: SearchItem[]; agendamentos: SearchItem[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const menuItems = useMemo(() => {
    return MENU_STRUCTURE.filter((item) => {
      if (item.moduleKey === null) return true;
      return isModuleEnabled(item.moduleKey as ModuleKey);
    }).map((item) => ({
      path: item.path,
      label: item.moduleKey ? getModuleLabel(item.moduleKey as ModuleKey) : 'Dashboard',
      icon: item.icon
    }));
  }, [getModuleLabel, isModuleEnabled]);

  const configPath = '/configuracoes';
  const isConfigActive = location.pathname === configPath || location.pathname.startsWith(configPath + '/');
  const showNotificationBell = !isConfigActive;
  const isActive = (path: string) => {
    if (path === '/agendamentos') return location.pathname === path || location.pathname.startsWith(path + '/');
    return location.pathname === path;
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setSearchLoading(true);
      api
        .get<{ clientes: SearchItem[]; vendas: SearchItem[]; agendamentos: SearchItem[] }>('/dashboard/search', { params: { q: searchQuery.trim() } })
        .then((res) => {
          setSearchResults(res.data);
          setSearchOpen(true);
        })
        .catch(() => setSearchResults(null))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-8 sm:mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-[var(--color-text-on-primary)] shadow-lg shrink-0">
            <span className="material-symbols-outlined text-2xl">diamond</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[var(--color-text-main)]">Aurix</h1>
            <span className="text-xs text-[var(--color-text-muted)]">Gestão Comercial</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 sm:gap-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-300 text-left min-h-[44px] touch-manipulation ${
                isActive(item.path)
                  ? 'sidebar-item-active font-semibold border border-transparent'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <span className="material-symbols-outlined shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div className="pt-2 mt-2 border-t border-[var(--color-border)]">
            <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Configurações</p>
            <button
              onClick={() => goTo(configPath)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-300 text-left min-h-[44px] touch-manipulation w-full ${
                isConfigActive
                  ? 'sidebar-item-active font-semibold border border-transparent'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <span className="material-symbols-outlined shrink-0">settings</span>
              <span>Configurações</span>
            </button>
          </div>
        </nav>
      </div>

    </>
  );

  return (
    <div className="flex h-screen bg-[var(--color-bg-main)] overflow-hidden">
      {/* Overlay mobile */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'var(--color-overlay)' }}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col transform transition-transform duration-200 ease-out lg:transform-none ${
          menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-main)]">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-sidebar)] shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-[var(--color-text-main)] hover:bg-[var(--color-sidebar-hover)] min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Abrir menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-[var(--color-text-on-primary)] shrink-0">
              <span className="material-symbols-outlined text-lg">diamond</span>
            </div>
            <span className="font-bold text-[var(--color-text-main)] truncate">Aurix</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col min-h-0">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-2 bg-[var(--color-bg-main)] border-b border-[var(--color-border)] shrink-0">
            {!isConfigActive ? (
              <>
                <div className="flex-1 min-w-0 flex justify-center">
                  <div className="relative w-full max-w-[520px] mx-2 sm:mx-4" ref={searchRef}>
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-lg pointer-events-none z-10">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar pedidos, clientes, telefone..."
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] pl-10 pr-10 py-1.5 text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-label="Busca global"
                  />
                  {searchLoading && (
                    <span className="material-symbols-outlined absolute right-10 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-lg animate-spin">progress_activity</span>
                  )}
                  {!searchLoading && searchQuery && (
                    <button type="button" onClick={() => { setSearchQuery(''); setSearchResults(null); setSearchOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]" aria-label="Limpar">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  )}
                {searchOpen && searchResults && (searchResults.clientes.length > 0 || searchResults.vendas.length > 0 || searchResults.agendamentos.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-2 z-50 max-h-[320px] overflow-auto">
                    {searchResults.clientes.length > 0 && (
                      <div className="px-3 py-1">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Clientes</p>
                        {searchResults.clientes.map((item) => (
                          <button key={`c-${item.id}`} type="button" onClick={() => { navigate(item.rota); setSearchOpen(false); setSearchQuery(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-elevated)] flex flex-col gap-0.5">
                            <span className="font-medium text-[var(--color-text-main)]">{item.label}</span>
                            {item.sublabel && <span className="text-xs text-[var(--color-text-muted)]">{item.sublabel}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.vendas.length > 0 && (
                      <div className="px-3 py-1">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Pedidos / Vendas</p>
                        {searchResults.vendas.map((item) => (
                          <button key={`v-${item.id}`} type="button" onClick={() => { navigate(item.rota); setSearchOpen(false); setSearchQuery(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-elevated)] flex flex-col gap-0.5">
                            <span className="font-medium text-[var(--color-text-main)]">{item.label}</span>
                            {item.sublabel && <span className="text-xs text-[var(--color-text-muted)]">{item.sublabel}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.agendamentos.length > 0 && (
                      <div className="px-3 py-1">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Agendamentos</p>
                        {searchResults.agendamentos.map((item) => (
                          <button key={`a-${item.id}`} type="button" onClick={() => { navigate(item.rota); setSearchOpen(false); setSearchQuery(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-elevated)] flex flex-col gap-0.5">
                            <span className="font-medium text-[var(--color-text-main)]">{item.label}</span>
                            {item.sublabel && <span className="text-xs text-[var(--color-text-muted)]">{item.sublabel}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {searchOpen && searchQuery.length >= 2 && searchResults && searchResults.clientes.length === 0 && searchResults.vendas.length === 0 && searchResults.agendamentos.length === 0 && !searchLoading && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-4 px-3 z-50 text-sm text-[var(--color-text-muted)] text-center">
                    Nenhum resultado para &quot;{searchQuery}&quot;
                  </div>
                )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex justify-end items-center gap-2 min-w-0">
                  <div className="hidden sm:block min-w-[180px]">
                    <AreaFilterSelect showLabel={false} />
                  </div>
                  <ThemeToggle />
                  {showNotificationBell && <NotificationBell />}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((o) => !o)}
                      className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
                      aria-label="Menu do usuário"
                    >
                      {user?.nome?.[0] || user?.email[0].toUpperCase()}
                    </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 min-w-[120px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-1 z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]"
                        >
                          <span className="material-symbols-outlined text-lg">logout</span>
                          Sair
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex justify-end items-center gap-2">
                <div className="hidden sm:block min-w-[180px]">
                  <AreaFilterSelect showLabel={false} />
                </div>
                <ThemeToggle />
                {showNotificationBell && <NotificationBell />}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
                    aria-label="Menu do usuário"
                  >
                    {user?.nome?.[0] || user?.email[0].toUpperCase()}
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 min-w-[120px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-1 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]"
                      >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}