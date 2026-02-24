import { useState, useCallback } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface LinhaPreview {
  nome: string;
  telefone: string;
  observacoes: string;
  erro?: string;
}

interface ClienteImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function parseCSV(text: string): LinhaPreview[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: LinhaPreview[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
    const nome = parts[0] ?? '';
    const telefone = parts[1] ?? '';
    const observacoes = parts[2] ?? '';
    if (i === 0 && nome.toLowerCase() === 'nome' && (telefone.toLowerCase() === 'telefone' || !telefone)) {
      continue;
    }
    rows.push({ nome, telefone, observacoes });
  }
  return rows;
}

export default function ClienteImportModal({ onClose, onSuccess }: ClienteImportModalProps) {
  const [todasLinhas, setTodasLinhas] = useState<LinhaPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ created: number; total: number; errors: string[] } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultado(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCSV(text).filter((r) => r.nome || r.telefone || r.observacoes);
      setTodasLinhas(rows);
      if (rows.length > 50) {
        toast(`Mostrando 50 de ${rows.length} linhas. Todas serão importadas.`);
      }
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const preview = todasLinhas.slice(0, 50);

  const importar = async () => {
    if (todasLinhas.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }
    setLoading(true);
    try {
      const clientes = todasLinhas.map((p) => ({
        nome: p.nome,
        telefone: p.telefone || undefined,
        observacoes: p.observacoes || undefined
      }));
      const res = await api.post<{ created: number; total: number; errors: string[] }>('/clientes/import', {
        clientes
      });
      setResultado(res.data);
      if (res.data.created > 0) {
        toast.success(`${res.data.created} cliente(s) importado(s)`);
        onSuccess();
      }
      if (res.data.errors?.length) {
        toast.error(`${res.data.errors.length} erro(s). Veja os detalhes.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao importar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-overlay)' }}>
      <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-main">Importar clientes (CSV)</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-sm text-text-muted">
            Use um arquivo CSV com colunas: <strong>nome</strong>, telefone (opcional), observações (opcional). Primeira linha pode ser o cabeçalho.
          </p>
          <label className="block">
            <span className="sr-only">Selecionar arquivo</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-text-on-primary"
            />
          </label>
          {preview.length > 0 && (
            <>
              <div className="max-h-48 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-bg-elevated sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-text-muted">Nome</th>
                      <th className="px-3 py-2 text-left text-text-muted">Telefone</th>
                      <th className="px-3 py-2 text-left text-text-muted">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{p.nome || '—'}</td>
                        <td className="px-3 py-2">{p.telefone || '—'}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]">{p.observacoes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-text-muted">
                {todasLinhas.length} linha(s) serão importadas. Nome é obrigatório; telefones duplicados serão ignorados.
              </p>
            </>
          )}
          {resultado && (
            <div className="rounded-lg border border-border p-3 bg-bg-elevated text-sm">
              <p className="font-medium text-text-main">
                {resultado.created} de {resultado.total} importados.
              </p>
              {resultado.errors?.length > 0 && (
                <ul className="mt-2 text-error text-xs list-disc list-inside max-h-24 overflow-auto">
                  {resultado.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {resultado.errors.length > 10 && (
                    <li>… e mais {resultado.errors.length - 10} erro(s)</li>
                  )}
                </ul>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border rounded-lg text-text-main hover:bg-bg-elevated"
            >
              {resultado ? 'Fechar' : 'Cancelar'}
            </button>
            {todasLinhas.length > 0 && !resultado && (
              <button
                type="button"
                onClick={importar}
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Importando…' : 'Importar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
