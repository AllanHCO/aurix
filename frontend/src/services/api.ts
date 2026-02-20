import axios from 'axios';

// Em produção (Vercel), usa a URL do backend no Render
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Não redirecionar se já estamos na página de login
      // Isso permite que o componente Login trate o erro de credenciais
      const isLoginPage = window.location.pathname === '/login';
      
      if (!isLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
