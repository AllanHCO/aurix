import axios from 'axios';

// Em produção (Vercel), usa a URL do backend no Render
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Garantir que o token seja enviado em toda requisição (evita perder após refresh/navegação)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.code === 'PLAN_BLOCKED') {
      const reason = error.response?.data?.blocked_reason;
      if (reason) sessionStorage.setItem('plan_blocked_reason', reason);
      window.location.href = '/assinatura-bloqueio';
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname === '/login';
      const isPublicAgenda = window.location.pathname.startsWith('/agenda/');
      if (!isLoginPage && !isPublicAgenda) {
        console.error('[api] 401 em:', error.config?.url, error.response?.data);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
