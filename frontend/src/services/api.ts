import axios from 'axios';

// Em produção (Vercel), usa a URL do backend no Render
const baseURL = import.meta.env.VITE_API_URL || '/api';

// Modo seguro: em desenvolvimento, avisar se a API apontar para host remoto (risco de produção)
if (import.meta.env.DEV && baseURL !== '/api') {
  try {
    const u = new URL(baseURL, window.location.origin);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      console.warn(
        '[Aurix] Desenvolvimento está usando API remota:',
        baseURL,
        '— Verifique se não é produção para não poluir dados reais.'
      );
    }
  } catch {
    // URL inválida ignorada
  }
}

/** Área de negócio selecionada globalmente; usado como filtro nas telas que respeitam o contexto. */
let globalAreaId: string | null = null;
export function setGlobalAreaId(id: string | null) {
  globalAreaId = id;
}
export function getGlobalAreaId(): string | null {
  return globalAreaId;
}

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Garantir que o token seja enviado em toda requisição (evita perder após refresh/navegação)
// Inclui business_area_id em todas as requisições GET quando há área selecionada (filtro global)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Filtro global de área: adiciona business_area_id em GETs quando não foi definido na requisição (ex.: Relatórios usa seletor próprio)
  if (globalAreaId && (config.method === 'get' || config.method === 'GET')) {
    const params = config.params && typeof config.params === 'object' ? config.params : {};
    if (!('business_area_id' in params)) {
      config.params = { ...params, business_area_id: globalAreaId };
    }
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
