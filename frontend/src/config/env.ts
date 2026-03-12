/**
 * Ambiente do frontend. Usado para badge e proteções.
 * VITE_APP_ENV pode ser definido em .env.development / .env.production.
 */
type AppEnv = 'development' | 'staging' | 'production';

function getAppEnv(): AppEnv {
  const v = import.meta.env.VITE_APP_ENV?.toLowerCase().trim();
  if (v === 'development' || v === 'staging' || v === 'production') return v as AppEnv;
  if (import.meta.env.DEV) return 'development';
  if (import.meta.env.MODE === 'staging') return 'staging';
  return 'production';
}

export const APP_ENV = getAppEnv();
export const isProduction = APP_ENV === 'production';
export const isNonProduction = APP_ENV === 'development' || APP_ENV === 'staging';

export const ENV_LABEL: Record<AppEnv, string> = {
  development: 'Desenvolvimento',
  staging: 'Homologação',
  production: 'Produção'
};
