import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória')
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setLoginError(null);
    try {
      setLoading(true);
      await login(data.email, data.senha);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      let message = 'Erro ao fazer login';
      if (error.response?.status === 401) {
        message = 'Email ou senha incorretos. Tente novamente.';
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      } else if (!error.response && error.message) {
        message = 'Não foi possível conectar à API. Verifique se o backend está no ar e a URL (VITE_API_URL) no deploy.';
      }
      setLoginError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background-light p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-text-on-primary shadow-lg mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">diamond</span>
          </div>
          <h1 className="text-3xl font-bold text-text-main mb-2">Aurix</h1>
          <p className="text-text-muted">Gestão Comercial</p>
        </div>

        <div className="bg-surface-light rounded-xl shadow-sm border border-border-light p-8">
          <h2 className="text-2xl font-bold text-text-main mb-6">Entrar</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Email
              </label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[44px] touch-manipulation"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Senha
              </label>
              <input
                type="password"
                {...register('senha')}
                className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[44px] touch-manipulation"
                placeholder="••••••"
              />
              {errors.senha && (
                <p className="text-red-500 text-sm mt-1">{errors.senha.message}</p>
              )}
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-badge-erro border border-error/30 text-badge-erro-text text-sm">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <p>{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-bold py-3 rounded-lg transition-colors duration-300 disabled:opacity-50 min-h-[48px] touch-manipulation"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary hover:underline font-semibold">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
