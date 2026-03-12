/**
 * Badge que identifica o ambiente (Desenvolvimento / Homologação).
 * Em produção não exibe nada (ou exibe discretamente).
 * Se estiver em localhost e o backend reportar produção, exibe alerta crítico.
 */
import { useState, useEffect } from 'react';
import { api } from '../services/api';

type AppEnv = 'development' | 'staging' | 'production';

interface HealthEnv {
  APP_ENV: AppEnv;
  DATABASE: string;
  STORAGE?: string;
  PORT: string;
}

export default function EnvironmentBadge() {
  const [backendEnv, setBackendEnv] = useState<HealthEnv | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<HealthEnv>('/health/env')
      .then((res) => setBackendEnv(res.data))
      .catch(() => setError('Não foi possível verificar o ambiente do backend.'));
  }, []);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // CRÍTICO: localhost não pode falar com backend de produção
  if (isLocalhost && backendEnv?.APP_ENV === 'production') {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/95 p-6"
        role="alert"
      >
        <div className="max-w-lg rounded-xl border-2 border-red-500 bg-red-950/90 p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-red-200">⚠️ Ambiente incorreto</h2>
          <p className="mt-3 text-red-100">
            Você está em <strong>localhost</strong>, mas o backend está em <strong>produção</strong>.
          </p>
          <p className="mt-2 text-sm text-red-200">
            Isso pode poluir dados reais. Use um backend de desenvolvimento (ex.: APP_ENV=development e
            DATABASE_URL apontando para banco local).
          </p>
          <p className="mt-4 text-xs text-red-300">
            Se isso for intencional, ignore este aviso. Caso contrário, pare o servidor e ajuste as
            variáveis de ambiente do backend.
          </p>
        </div>
      </div>
    );
  }

  if (error || !backendEnv) return null;

  // Badge visível apenas em desenvolvimento e homologação
  if (backendEnv.APP_ENV === 'production') return null;

  const label =
    backendEnv.APP_ENV === 'staging' ? 'Homologação' : 'Desenvolvimento';
  const bgColor = backendEnv.APP_ENV === 'staging' ? 'bg-amber-600' : 'bg-blue-600';

  return (
    <div
      className={`fixed bottom-2 left-2 z-[9000] rounded px-2 py-1 text-xs font-bold text-white shadow-lg ${bgColor}`}
      title={`Backend: ${backendEnv.APP_ENV} | DB: ${backendEnv.DATABASE} | Storage: ${backendEnv.STORAGE ?? '—'}`}
    >
      Ambiente: {label}
    </div>
  );
}
