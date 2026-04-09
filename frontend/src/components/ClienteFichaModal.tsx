import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import ModalPortal from './ModalPortal';

export interface ClienteFichaPayload {
  cliente: { id: string; nome: string };
  observacoes_gerais: string | null;
  preferencias: string | null;
  informacoes_adicionais: Record<string, unknown> | null;
  atualizado_em: string | null;
  atualizado_por: { id: string; nome: string | null } | null;
  imagens: { id: string; ordem: number; createdAt: string }[];
}

type KvRow = { key: string; value: string };

function kvFromJson(j: Record<string, unknown> | null | undefined): KvRow[] {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ key: '', value: '' }];
  const entries = Object.entries(j).filter(([k]) => k.trim() !== '');
  if (entries.length === 0) return [{ key: '', value: '' }];
  return entries.map(([key, value]) => ({
    key,
    value: typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)
  }));
}

function kvToJson(rows: KvRow[]): Record<string, string> | null {
  const o: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    o[k] = r.value;
  }
  return Object.keys(o).length ? o : null;
}

interface ClienteFichaModalProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
}

export default function ClienteFichaModal({ open, onClose, clienteId, clienteNome }: ClienteFichaModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [preferencias, setPreferencias] = useState('');
  const [kvRows, setKvRows] = useState<KvRow[]>([{ key: '', value: '' }]);
  const [meta, setMeta] = useState<{ atualizado_em: string | null; atualizado_por: ClienteFichaPayload['atualizado_por'] }>({
    atualizado_em: null,
    atualizado_por: null
  });
  const [imagens, setImagens] = useState<ClienteFichaPayload['imagens']>([]);
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map());
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchImageBlobs = useCallback(async (ids: string[]) => {
    const next = new Map<string, string>();
    for (const id of ids) {
      try {
        const res = await api.get(`/clientes/${clienteId}/ficha/imagens/${id}/file`, { responseType: 'blob' });
        next.set(id, URL.createObjectURL(res.data));
      } catch {
        /* skip */
      }
    }
    return next;
  }, [clienteId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ClienteFichaPayload>(`/clientes/${clienteId}/ficha`);
      setObservacoes(res.data.observacoes_gerais ?? '');
      setPreferencias(res.data.preferencias ?? '');
      setKvRows(kvFromJson(res.data.informacoes_adicionais ?? null));
      setMeta({
        atualizado_em: res.data.atualizado_em,
        atualizado_por: res.data.atualizado_por
      });
      const ids = (res.data.imagens ?? []).map((i) => i.id);
      setImagens(res.data.imagens ?? []);
      setBlobUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return new Map();
      });
      const blobs = await fetchImageBlobs(ids);
      setBlobUrls(blobs);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number } };
      toast.error(err.response?.data?.error || 'Erro ao carregar ficha');
    } finally {
      setLoading(false);
    }
  }, [clienteId, fetchImageBlobs]);

  useEffect(() => {
    if (!open) return;
    load();
    return () => {
      setBlobUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return new Map();
      });
    };
  }, [open, clienteId, load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const informacoes_adicionais = kvToJson(kvRows);
      const res = await api.put<{
        atualizado_em: string;
        atualizado_por: ClienteFichaPayload['atualizado_por'];
      }>(`/clientes/${clienteId}/ficha`, {
        observacoes_gerais: observacoes.trim() || null,
        preferencias: preferencias.trim() || null,
        informacoes_adicionais
      });
      setMeta({ atualizado_em: res.data.atualizado_em, atualizado_por: res.data.atualizado_por });
      toast.success('Ficha salva.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/clientes/${clienteId}/ficha/imagens`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const res = await api.get<ClienteFichaPayload>(`/clientes/${clienteId}/ficha`);
      const ids = (res.data.imagens ?? []).map((i) => i.id);
      setImagens(res.data.imagens ?? []);
      setBlobUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return new Map();
      });
      const blobs = await fetchImageBlobs(ids);
      setBlobUrls(blobs);
      toast.success('Imagem adicionada.');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImagem = async (imageId: string) => {
    if (!window.confirm('Remover esta imagem?')) return;
    try {
      await api.delete(`/clientes/${clienteId}/ficha/imagens/${imageId}`);
      setImagens((prev) => prev.filter((i) => i.id !== imageId));
      setBlobUrls((prev) => {
        const u = prev.get(imageId);
        if (u) URL.revokeObjectURL(u);
        const m = new Map(prev);
        m.delete(imageId);
        return m;
      });
      toast.success('Imagem removida.');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const addKvRow = () => setKvRows((r) => [...r, { key: '', value: '' }]);
  const updateKv = (index: number, field: 'key' | 'value', value: string) => {
    setKvRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const removeKv = (index: number) => {
    setKvRows((rows) => (rows.length <= 1 ? [{ key: '', value: '' }] : rows.filter((_, i) => i !== index)));
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        style={{ backgroundColor: 'var(--color-overlay)' }}
      >
        <div className="bg-bg-elevated border border-border-soft sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl">
          <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-main truncate">Ficha do cliente</h2>
              <p className="text-sm text-text-muted truncate">{clienteNome}</p>
              {meta.atualizado_em && (
                <p className="text-xs text-text-muted mt-1">
                  Última atualização:{' '}
                  {new Date(meta.atualizado_em).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                  {meta.atualizado_por?.nome ? ` · ${meta.atualizado_por.nome}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-main shrink-0"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
            {loading ? (
              <p className="text-text-muted text-center py-8">Carregando...</p>
            ) : (
              <>
                <section>
                  <label className="block text-sm font-medium text-text-main mb-1">Observações gerais</label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main text-sm resize-y min-h-[100px]"
                    placeholder="Anotações gerais sobre o atendimento..."
                  />
                </section>

                <section>
                  <label className="block text-sm font-medium text-text-main mb-1">Preferências</label>
                  <textarea
                    value={preferencias}
                    onChange={(e) => setPreferencias(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main text-sm resize-y"
                    placeholder="Ex.: degradê baixo, máquina 1, cor do esmalte..."
                  />
                </section>

                <section>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-sm font-medium text-text-main">Informações adicionais</label>
                    <button
                      type="button"
                      onClick={addKvRow}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Campo
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Pares nome / valor (ex.: alergia, tipo de pele, máquina preferida).</p>
                  <div className="space-y-2">
                    {kvRows.map((row, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={row.key}
                          onChange={(e) => updateKv(idx, 'key', e.target.value)}
                          placeholder="Nome"
                          className="flex-1 rounded-lg border border-border bg-bg-main px-3 py-2 text-sm text-text-main"
                        />
                        <input
                          value={row.value}
                          onChange={(e) => updateKv(idx, 'value', e.target.value)}
                          placeholder="Valor"
                          className="flex-[2] rounded-lg border border-border bg-bg-main px-3 py-2 text-sm text-text-main"
                        />
                        <button
                          type="button"
                          onClick={() => removeKv(idx)}
                          className="sm:w-10 py-2 rounded-lg border border-border text-text-muted hover:text-error shrink-0"
                          aria-label="Remover linha"
                        >
                          <span className="material-symbols-outlined text-lg">remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="block text-sm font-medium text-text-main mb-2">Imagens de referência</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-primary text-primary px-3 py-2 text-sm font-medium cursor-pointer hover:bg-primary/10 disabled:opacity-50">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={handleUpload}
                      />
                      <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
                      {uploading ? 'Enviando...' : 'Adicionar imagem'}
                    </label>
                    <span className="text-xs text-text-muted self-center">JPG, PNG ou WEBP · até 8 MB</span>
                  </div>
                  {imagens.length > 0 ? (
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {imagens.map((im) => {
                        const url = blobUrls.get(im.id);
                        return (
                          <li
                            key={im.id}
                            className="relative rounded-xl border border-border bg-bg-main overflow-hidden aspect-square group"
                          >
                            {url ? (
                              <button
                                type="button"
                                className="w-full h-full block"
                                onClick={() => setLightbox(url)}
                                aria-label="Ampliar"
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">...</div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteImagem(im.id)}
                              className="absolute top-1 right-1 p-1.5 rounded-lg bg-bg-elevated/90 text-error opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Remover imagem"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted">Nenhuma imagem. Adicione fotos de referência para o atendimento.</p>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-border flex flex-col-reverse sm:flex-row gap-2 sm:justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 rounded-lg border border-border text-text-main hover:bg-bg-main"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={loading || saving}
              onClick={handleSave}
              className="w-full sm:w-auto px-5 py-3 rounded-lg bg-primary text-[var(--color-text-on-primary)] font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar ficha'}
            </button>
          </div>
        </div>

        {lightbox && (
          <button
            type="button"
            className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/85"
            onClick={() => setLightbox(null)}
            aria-label="Fechar imagem"
          >
            <img src={lightbox} alt="" className="max-w-full max-h-[90dvh] object-contain rounded-lg" />
          </button>
        )}
      </div>
    </ModalPortal>
  );
}
