import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api, setGlobalAreaId } from '../services/api';
import { usePersonalizacao } from './PersonalizacaoContext';

export interface BusinessArea {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
}

const STORAGE_KEY = 'aurix_area_filter';

interface BusinessAreaContextValue {
  areas: BusinessArea[];
  loading: boolean;
  /** true quando o recurso de áreas de negócio está ligado nas configurações (personalização > sistema). */
  enabled: boolean;
  selectedAreaId: string | null;
  setSelectedAreaId: (id: string | null) => void;
  refetch: () => Promise<void>;
}

const BusinessAreaContext = createContext<BusinessAreaContextValue | null>(null);

export function BusinessAreaProvider({ children }: { children: ReactNode }) {
  const { getModuleConfig } = usePersonalizacao();
  const sistemaConfig = getModuleConfig('sistema');
  const enabled = sistemaConfig.usar_areas_negocio === true;

  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaIdState] = useState<string | null>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s || null;
    } catch {
      return null;
    }
  });

  const refetch = useCallback(async () => {
    if (!enabled) {
      setAreas([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get<BusinessArea[]>('/configuracoes/business-areas');
      setAreas(res.data);
    } catch {
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      refetch();
    } else {
      setAreas([]);
      setSelectedAreaIdState(null);
      setGlobalAreaId(null);
    }
  }, [enabled, refetch]);

  const setSelectedAreaId = useCallback((id: string | null) => {
    if (!enabled) return;
    setSelectedAreaIdState(id);
    setGlobalAreaId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      setGlobalAreaId(selectedAreaId);
    } else {
      setGlobalAreaId(null);
    }
  }, [selectedAreaId, enabled]);

  const value: BusinessAreaContextValue = {
    areas,
    loading,
    enabled,
    selectedAreaId,
    setSelectedAreaId,
    refetch
  };

  return (
    <BusinessAreaContext.Provider value={value}>
      {children}
    </BusinessAreaContext.Provider>
  );
}

export function useBusinessAreas() {
  const ctx = useContext(BusinessAreaContext);
  if (!ctx) {
    throw new Error('useBusinessAreas must be used within BusinessAreaProvider');
  }
  return ctx;
}

/** Use only when provider may be absent (e.g. outside Layout). Returns null if no provider. */
export function useBusinessAreasOptional(): BusinessAreaContextValue | null {
  return useContext(BusinessAreaContext);
}
