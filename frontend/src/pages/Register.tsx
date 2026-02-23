import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmarSenha: z.string()
}).refine((data) => data.senha === data.confirmarSenha, {
  message: 'Senhas não coincidem',
  path: ['confirmarSenha']
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true);
      await registerUser(data.email, data.senha, data.nome);
      toast.success('Cadastro realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao cadastrar');
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
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-text-on-primary shadow-lg mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl sm:text-3xl">diamond</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-2">Aurix</h1>
          <p className="text-sm sm:text-base text-text-muted">Gestão Comercial</p>
        </div>

        <div className="bg-surface-light rounded-xl shadow-sm border border-border-light p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-text-main mb-6">Criar Conta</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Nome (opcional)
              </label>
              <input
                type="text"
                {...register('nome')}
                className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[44px] touch-manipulation"
                placeholder="Seu nome"
              />
            </div>

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
                <p className="text-error text-sm mt-1">{errors.email.message}</p>
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
                <p className="text-error text-sm mt-1">{errors.senha.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Confirmar Senha
              </label>
              <input
                type="password"
                {...register('confirmarSenha')}
                className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[44px] touch-manipulation"
                placeholder="••••••"
              />
              {errors.confirmarSenha && (
                <p className="text-error text-sm mt-1">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-bold py-3 rounded-lg transition-colors duration-300 disabled:opacity-50 min-h-[48px] touch-manipulation"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-semibold">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
