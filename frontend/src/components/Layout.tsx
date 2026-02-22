import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/clientes', label: 'Clientes', icon: 'group' },
    { path: '/produtos', label: 'Produtos', icon: 'diamond' },
    { path: '/vendas', label: 'Vendas', icon: 'payments' },
    { path: '/relatorios', label: 'Relatórios', icon: 'bar_chart' }
  ];

  const isActive = (path: string) => location.pathname === path;

  // Fechar menu ao navegar (mobile)
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Evitar scroll do body quando menu aberto no mobile
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

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-8 sm:mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-text-on-primary shadow-lg shrink-0">
            <span className="material-symbols-outlined text-2xl">diamond</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-main">Aurix</h1>
            <span className="text-xs text-text-muted">Gestão Comercial</span>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex flex-col gap-1 sm:gap-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-300 text-left min-h-[44px] touch-manipulation ${
                isActive(item.path)
                  ? 'bg-sidebar-active-bg text-primary font-semibold border-l-4 border-l-primary border border-transparent'
                  : 'text-text-muted hover:bg-sidebar-hover hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6 border-t border-border-light mt-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
            {user?.nome?.[0] || user?.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-main truncate">
              {user?.nome || 'Usuário'}
            </p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setMenuOpen(false);
            logout();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text-muted hover:bg-sidebar-hover hover:text-text-main transition-colors duration-300 min-h-[44px] touch-manipulation"
        >
          <span className="material-symbols-outlined">logout</span>
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background-light overflow-hidden">
      {/* Overlay mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar: drawer no mobile, fixo no desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-light border-r border-border-light flex flex-col transform transition-transform duration-200 ease-out lg:transform-none ${
          menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header mobile: hamburger + título */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border-light bg-surface-light shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-text-main hover:bg-sidebar-hover min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Abrir menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-text-on-primary shrink-0">
              <span className="material-symbols-outlined text-lg">diamond</span>
            </div>
            <span className="font-bold text-text-main truncate">Aurix</span>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
