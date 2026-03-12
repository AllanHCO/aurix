import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const defaultConfig = {
  hora_inicio_funcionamento: '08:00',
  hora_fim_funcionamento: '18:00',
  duracao_padrao_minutos: 30,
  buffer_minutos: 10,
  antecedencia_minima_dias: 2,
  limite_maximo_dias: 30
};

interface BrandingState {
  nome_organizacao: string;
  nome_unidade: string;
  logo_url: string;
  cor_primaria_hex: string;
  status_operacao: string;
}

const defaultBranding: BrandingState = {
  nome_organizacao: '',
  nome_unidade: '',
  logo_url: '',
  cor_primaria_hex: '',
  status_operacao: ''
};

export default function AgendaConfig() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [branding, setBranding] = useState<BrandingState>(defaultBranding);
  const [brandingSaving, setBrandingSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [configRes, slugRes, brandingRes] = await Promise.all([
        api.get('/agenda/config'),
        api.get('/agenda/slug'),
        api.get('/agenda/branding').catch(() => ({ data: null }))
      ]);
      if (configRes.data) setConfig(configRes.data);
      if (slugRes.data?.agenda_slug) setSlug(slugRes.data.agenda_slug);
      if (brandingRes?.data && typeof brandingRes.data === 'object') {
        setBranding({
          nome_organizacao: brandingRes.data.nome_organizacao ?? '',
          nome_unidade: brandingRes.data.nome_unidade ?? '',
          logo_url: brandingRes.data.logo_url ?? '',
          cor_primaria_hex: brandingRes.data.cor_primaria_hex ?? '',
          status_operacao: brandingRes.data.status_operacao ?? ''
        });
      }
    } catch {
      toast.error('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/agenda/config', config);
      toast.success('Configurações salvas');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaving(true);
    try {
      await api.put('/agenda/branding', {
        nome_organizacao: branding.nome_organizacao.trim() || undefined,
        nome_unidade: branding.nome_unidade.trim() || undefined,
        logo_url: branding.logo_url.trim() || null,
        cor_primaria_hex: branding.cor_primaria_hex.trim() || null,
        status_operacao: branding.status_operacao.trim() || null
      });
      toast.success('Branding salvo');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || 'Erro ao salvar');
    } finally {
      setBrandingSaving(false);
    }
  };

  const normalizeSlug = (value: string): string | null => {
    const raw = (value || '').trim().toLowerCase();
    if (!raw) return null;
    const noAccents = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    let s = noAccents.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (s.length < 3 || s.length > 50) return null;
    return s;
  };

  const handleSlugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slugEditing) return;
    const s = normalizeSlug(slug);
    if (!s) {
      toast.error('Slug inválido. Use apenas letras minúsculas, números e hífens (3 a 50 caracteres).');
      return;
    }
    setSlugSaving(true);
    try {
      await api.put('/agenda/slug', { slug: s });
      setSlug(s);
      setSlugEditing(false);
      toast.success('Slug da agenda atualizado');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSlugSaving(false);
    }
  };

  const handleStartEditSlug = () => {
    setSlugEditing(true);
  };

  const handleCancelEditSlug = () => {
    setSlugEditing(false);
  };

  const handleGenerateSlug = () => {
    const base = branding.nome_organizacao || slug || 'agenda';
    const s = normalizeSlug(base);
    if (!s) {
      toast.error('Não foi possível gerar um slug automático. Ajuste o nome da organização.');
      return;
    }
    setSlug(s);
    setSlugEditing(true);
  };

  if (loading) {
    return <div className="max-w-xl mx-auto py-8 text-center text-text-muted">Carregando...</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/agendamentos')} className="p-2 rounded-lg hover:bg-surface-elevated text-text-muted">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-2xl font-bold text-text-main">Configurações da Agenda</h1>
      </div>

      <form onSubmit={handleBrandingSubmit} className="bg-surface-light rounded-xl border border-border-light p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Branding da página pública</h2>
        <p className="text-sm text-text-muted">Nome e unidade exibidos no link /agenda/seu-slug</p>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Nome da organização *</label>
          <input
            type="text"
            value={branding.nome_organizacao}
            onChange={(e) => setBranding((b) => ({ ...b, nome_organizacao: e.target.value }))}
            placeholder="ex: Barbearia X"
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Nome da unidade</label>
          <input
            type="text"
            value={branding.nome_unidade}
            onChange={(e) => setBranding((b) => ({ ...b, nome_unidade: e.target.value }))}
            placeholder="ex: Centro - SP"
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">URL do logo (opcional)</label>
          <input
            type="url"
            value={branding.logo_url}
            onChange={(e) => setBranding((b) => ({ ...b, logo_url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Cor primária (opcional)</label>
          <input
            type="text"
            value={branding.cor_primaria_hex}
            onChange={(e) => setBranding((b) => ({ ...b, cor_primaria_hex: e.target.value }))}
            placeholder="#2563eb"
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Status de operação (opcional)</label>
          <input
            type="text"
            value={branding.status_operacao}
            onChange={(e) => setBranding((b) => ({ ...b, status_operacao: e.target.value }))}
            placeholder="ex: Operando normal"
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <button type="submit" disabled={brandingSaving} className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg">
          {brandingSaving ? 'Salvando...' : 'Salvar branding'}
        </button>
      </form>

      <form onSubmit={handleSlugSubmit} className="bg-surface-light rounded-xl border border-border-light p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Link público</h2>
        <p className="text-sm text-text-muted">Slug para a URL: /agenda/seu-slug (apenas letras minúsculas, números e hífens)</p>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          readOnly={!slugEditing}
          placeholder="ex: minha-empresa"
          className={`w-full px-4 py-2 border border-border-light rounded-lg text-text-main ${
            slugEditing ? 'bg-input-bg' : 'bg-input-bg/60 cursor-not-allowed'
          }`}
        />
        <div className="flex flex-wrap gap-2">
          {!slugEditing ? (
            <button
              type="button"
              onClick={handleStartEditSlug}
              className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg"
            >
              Editar
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={slugSaving}
                className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {slugSaving ? 'Salvando...' : 'Salvar slug'}
              </button>
              <button
                type="button"
                onClick={handleCancelEditSlug}
                className="border border-border-light bg-input-bg text-text-main font-medium px-4 py-2 rounded-lg"
              >
                Cancelar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleGenerateSlug}
            className="border border-border-light bg-input-bg text-text-main font-medium px-4 py-2 rounded-lg"
          >
            Gerar sugestão automática
          </button>
        </div>
      </form>

      <form onSubmit={handleSubmit} className="bg-surface-light rounded-xl border border-border-light p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Horário e slots</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Abertura</label>
            <input
              type="time"
              value={config.hora_inicio_funcionamento}
              onChange={(e) => setConfig((c) => ({ ...c, hora_inicio_funcionamento: e.target.value }))}
              className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Fechamento</label>
            <input
              type="time"
              value={config.hora_fim_funcionamento}
              onChange={(e) => setConfig((c) => ({ ...c, hora_fim_funcionamento: e.target.value }))}
              className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Duração padrão (min)</label>
          <input
            type="number"
            min={5}
            max={240}
            value={config.duracao_padrao_minutos}
            onChange={(e) => setConfig((c) => ({ ...c, duracao_padrao_minutos: Number(e.target.value) }))}
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Buffer entre slots (min)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={config.buffer_minutos}
            onChange={(e) => setConfig((c) => ({ ...c, buffer_minutos: Number(e.target.value) }))}
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Antecedência mínima (dias)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={config.antecedencia_minima_dias}
            onChange={(e) => setConfig((c) => ({ ...c, antecedencia_minima_dias: Number(e.target.value) }))}
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Limite máximo (dias à frente)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={config.limite_maximo_dias}
            onChange={(e) => setConfig((c) => ({ ...c, limite_maximo_dias: Number(e.target.value) }))}
            className="w-full px-4 py-2 border border-border-light rounded-lg bg-input-bg text-text-main"
          />
        </div>
        <button type="submit" disabled={saving} className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg">
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  );
}
