import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PersonalizacaoProvider, usePersonalizacao, type ModuleKey } from './contexts/PersonalizacaoContext';
import { BusinessAreaProvider } from './contexts/BusinessAreaContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Clientes from './pages/Clientes';
import Vendas from './pages/Vendas';
import Relatorios from './pages/Relatorios';
import Financeiro from './pages/Financeiro';
import Fornecedores from './pages/Fornecedores';
import Agendamentos from './pages/Agendamentos';
import HistoricoAgendamentos from './pages/HistoricoAgendamentos';
import Pendencias from './pages/Pendencias';
import AgendaConfig from './pages/AgendaConfig';
import Bloqueios from './pages/Bloqueios';
import ConfiguracoesHub from './pages/ConfiguracoesHub';
import ConfiguracoesAgendamento from './pages/ConfiguracoesAgendamento';
import PersonalizacaoSistema from './pages/PersonalizacaoSistema';
import ConfiguracaoEmpresa from './pages/configuracoes/ConfiguracaoEmpresa';
import ConfiguracaoAreasNegocio from './pages/configuracoes/ConfiguracaoAreasNegocio';
import ConfiguracaoClientes from './pages/configuracoes/ConfiguracaoClientes';
import ConfiguracaoVendas from './pages/configuracoes/ConfiguracaoVendas';
import ConfiguracaoMarketing from './pages/configuracoes/ConfiguracaoMarketing';
import ConfiguracaoRelatorios from './pages/configuracoes/ConfiguracaoRelatorios';
import ConfiguracaoFinanceiro from './pages/configuracoes/ConfiguracaoFinanceiro';
import ConfiguracaoSeguranca from './pages/configuracoes/ConfiguracaoSeguranca';
import ConfiguracaoPlano from './pages/configuracoes/ConfiguracaoPlano';
import ConfiguracaoSistema from './pages/configuracoes/ConfiguracaoSistema';
import ConfiguracaoDocumentosPdf from './pages/configuracoes/ConfiguracaoDocumentosPdf';
import AssinaturaBloqueio from './pages/AssinaturaBloqueio';
import AgendaPublica from './pages/AgendaPublica';
import Layout from './components/Layout';
import EnvironmentBadge from './components/EnvironmentBadge';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PersonalizacaoProvider>
      <BusinessAreaProvider>{children}</BusinessAreaProvider>
    </PersonalizacaoProvider>
  );
}

function ModuleGuard({ moduleKey, children }: { moduleKey: ModuleKey; children: React.ReactNode }) {
  const { isModuleEnabled } = usePersonalizacao();
  if (!isModuleEnabled(moduleKey)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/agenda/:slug" element={<AgendaPublica />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clientes" element={<ModuleGuard moduleKey="clientes"><Clientes /></ModuleGuard>} />
        <Route path="produtos" element={<ModuleGuard moduleKey="produtos"><Produtos /></ModuleGuard>} />
        <Route path="vendas/novo" element={<ModuleGuard moduleKey="vendas"><Vendas /></ModuleGuard>} />
        <Route path="vendas" element={<ModuleGuard moduleKey="vendas"><Vendas /></ModuleGuard>} />
        <Route path="pendencias" element={<Pendencias />} />
        <Route path="agendamentos" element={<ModuleGuard moduleKey="agendamentos"><Agendamentos /></ModuleGuard>} />
        <Route path="agendamentos/historico" element={<ModuleGuard moduleKey="agendamentos"><HistoricoAgendamentos /></ModuleGuard>} />
        <Route path="agendamentos/config" element={<ModuleGuard moduleKey="agendamentos"><AgendaConfig /></ModuleGuard>} />
        <Route path="agendamentos/bloqueios" element={<ModuleGuard moduleKey="agendamentos"><Bloqueios /></ModuleGuard>} />
        <Route path="configuracoes" element={<ConfiguracoesHub />} />
        <Route path="configuracoes/empresa" element={<ConfiguracaoEmpresa />} />
        <Route path="configuracoes/documentos-pdf" element={<ConfiguracaoDocumentosPdf />} />
        <Route path="configuracoes/areas-negocio" element={<ConfiguracaoAreasNegocio />} />
        <Route path="configuracoes/clientes" element={<ConfiguracaoClientes />} />
        <Route path="configuracoes/vendas" element={<ConfiguracaoVendas />} />
        <Route path="configuracoes/agendamento" element={<ConfiguracoesAgendamento />} />
        <Route path="configuracoes/marketing" element={<ConfiguracaoMarketing />} />
        <Route path="configuracoes/relatorios" element={<ConfiguracaoRelatorios />} />
        <Route path="configuracoes/financeiro" element={<ConfiguracaoFinanceiro />} />
        <Route path="configuracoes/seguranca" element={<ConfiguracaoSeguranca />} />
        <Route path="configuracoes/plano" element={<ConfiguracaoPlano />} />
        <Route path="configuracoes/personalizacao" element={<PersonalizacaoSistema />} />
        <Route path="configuracoes/sistema" element={<ConfiguracaoSistema />} />
        <Route path="assinatura-bloqueio" element={<AssinaturaBloqueio />} />
        <Route path="financeiro" element={<ModuleGuard moduleKey="financeiro"><Financeiro /></ModuleGuard>} />
        <Route path="fornecedores" element={<ModuleGuard moduleKey="fornecedores"><Fornecedores /></ModuleGuard>} />
        <Route path="relatorios" element={<ModuleGuard moduleKey="relatorios"><Relatorios /></ModuleGuard>} />
        {/* Redirects antigos para não quebrar */}
        <Route path="agendamento" element={<Navigate to="/configuracoes/agendamento" replace />} />
        <Route path="config/agendamento" element={<Navigate to="/configuracoes/agendamento" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-main)',
                border: '1px solid var(--color-border-soft)',
              },
              success: { iconTheme: { primary: 'var(--color-success)', secondary: 'transparent' } },
              error: { iconTheme: { primary: 'var(--color-error)', secondary: 'transparent' } },
            }}
          />
          <EnvironmentBadge />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
