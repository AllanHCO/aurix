import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Clientes from './pages/Clientes';
import Vendas from './pages/Vendas';
import Relatorios from './pages/Relatorios';
import Agendamentos from './pages/Agendamentos';
import AgendaConfig from './pages/AgendaConfig';
import Bloqueios from './pages/Bloqueios';
import ConfiguracoesHub from './pages/ConfiguracoesHub';
import ConfiguracoesAgendamento from './pages/ConfiguracoesAgendamento';
import AgendaPublica from './pages/AgendaPublica';
import Layout from './components/Layout';

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
        <Route path="produtos" element={<Produtos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="agendamentos" element={<Agendamentos />} />
        <Route path="agendamentos/config" element={<AgendaConfig />} />
        <Route path="agendamentos/bloqueios" element={<Bloqueios />} />
        <Route path="configuracoes" element={<ConfiguracoesHub />} />
        <Route path="configuracoes/agendamento" element={<ConfiguracoesAgendamento />} />
        <Route path="relatorios" element={<Relatorios />} />
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
                background: 'var(--color-surface)',
                color: 'var(--color-text-main)',
                border: '1px solid var(--color-border)',
              },
              success: { iconTheme: { primary: 'var(--color-success)' } },
              error: { iconTheme: { primary: 'var(--color-error)' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
