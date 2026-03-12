import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import ModalPortal from './ModalPortal';

const COLUNAS_OBRIGATORIAS = ['nome'];
const COLUNAS_OPCIONAIS = [
  'telefone',
  'cpf',
  'observacoes',
  'time_futebol',
  'dados_adicionais_tipo',
  'dados_adicionais_titulo',
  'dados_adicionais_descricao',
  'dados_adicionais_mostrar_orcamento',
  'dados_adicionais_mostrar_venda',
  'dados_adicionais_apenas_interno'
];

export type LinhaImportacao = Record<string, string | undefined>;

interface ClienteImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function normalizarCabecalho(h: string): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function parseCSV(text: string): { rows: LinhaImportacao[]; headers: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], headers: [] };
  const rawHeaders = lines[0].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
  const headers = rawHeaders.map(normalizarCabecalho);
  const startIndex = headers.includes('nome') ? 1 : 0;
  const rows: LinhaImportacao[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
    const obj: LinhaImportacao = {};
    rawHeaders.forEach((h, idx) => {
      const key = normalizarCabecalho(h);
      obj[key] = parts[idx]?.trim() || undefined;
    });
    if (obj.nome || obj.telefone || obj.observacoes) rows.push(obj);
  }
  return { rows, headers };
}

function parseXLSX(buffer: ArrayBuffer): { rows: LinhaImportacao[]; headers: string[] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) return { rows: [], headers: [] };
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
  if (!data.length) return { rows: [], headers: [] };
  const rawHeaders = (data[0] ?? []).map((c) => String(c ?? '').trim());
  const headers = rawHeaders.map(normalizarCabecalho);
  const rows: LinhaImportacao[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const obj: LinhaImportacao = {};
    rawHeaders.forEach((h, idx) => {
      const key = normalizarCabecalho(h);
      const val = row[idx];
      obj[key] = val != null && String(val).trim() !== '' ? String(val).trim() : undefined;
    });
    if (obj.nome || obj.telefone || obj.observacoes) rows.push(obj);
  }
  return { rows, headers };
}

function validarColunas(headers: string[]): boolean {
  const set = new Set(headers);
  return COLUNAS_OBRIGATORIAS.every((c) => set.has(c));
}

export default function ClienteImportModal({ onClose, onSuccess }: ClienteImportModalProps) {
  const [todasLinhas, setTodasLinhas] = useState<LinhaImportacao[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [erroPlanilha, setErroPlanilha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resultado, setResultado] = useState<{ created: number; total: number; errors: string[] } | null>(null);

  const baixarModelo = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await api.get<Blob>('/clientes/import/modelo', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_importacao_clientes.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Modelo baixado.');
    } catch {
      toast.error('Erro ao baixar o modelo.');
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultado(null);
    setErroPlanilha(null);
    const isCsv = /\.(csv|txt)$/i.test(f.name);
    const isXlsx = /\.xlsx?$/i.test(f.name);
    if (!isCsv && !isXlsx) {
      setErroPlanilha('Use um arquivo CSV ou Excel (.xlsx).');
      setTodasLinhas([]);
      setHeaders([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (isXlsx) {
          const buf = reader.result as ArrayBuffer;
          const { rows, headers: h } = parseXLSX(buf);
          if (!validarColunas(h)) {
            setErroPlanilha('A planilha precisa conter as colunas obrigatórias para importação de clientes.');
            setTodasLinhas([]);
            setHeaders([]);
            return;
          }
          setHeaders(h);
          setTodasLinhas(rows);
        } else {
          const text = String(reader.result ?? '');
          const { rows, headers: h } = parseCSV(text);
          if (!validarColunas(h)) {
            setErroPlanilha('A planilha precisa conter as colunas obrigatórias para importação de clientes.');
            setTodasLinhas([]);
            setHeaders([]);
            return;
          }
          setHeaders(h);
          setTodasLinhas(rows);
        }
        if (rows.length > 50) {
          toast(`Mostrando 50 de ${rows.length} linhas. Todas serão importadas.`);
        }
      } catch {
        setErroPlanilha('Erro ao ler o arquivo. Verifique o formato.');
        setTodasLinhas([]);
        setHeaders([]);
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(f);
    else reader.readAsText(f, 'UTF-8');
    e.target.value = '';
  }, []);

  const preview = todasLinhas.slice(0, 50);

  const importar = async () => {
    if (todasLinhas.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }
    setLoading(true);
    try {
      const clientes = todasLinhas.map((row) => {
        const obj: Record<string, string | boolean | undefined> = {};
        if (row.nome != null) obj.nome = row.nome;
        if (row.telefone != null) obj.telefone = row.telefone;
        if (row.cpf != null) obj.cpf = row.cpf;
        if (row.observacoes != null) obj.observacoes = row.observacoes;
        if (row.time_futebol != null) obj.time_futebol = row.time_futebol;
        if (row.dados_adicionais_tipo != null) {
          const t = String(row.dados_adicionais_tipo).toLowerCase();
          if (['veiculo', 'equipamento', 'outro'].includes(t)) obj.dados_adicionais_tipo = t as 'veiculo' | 'equipamento' | 'outro';
        }
        if (row.dados_adicionais_titulo != null) obj.dados_adicionais_titulo = row.dados_adicionais_titulo;
        if (row.dados_adicionais_descricao != null) obj.dados_adicionais_descricao = row.dados_adicionais_descricao;
        if (row.dados_adicionais_mostrar_orcamento != null)
          obj.dados_adicionais_mostrar_orcamento = /^(1|true|sim|s|yes)$/i.test(String(row.dados_adicionais_mostrar_orcamento));
        if (row.dados_adicionais_mostrar_venda != null)
          obj.dados_adicionais_mostrar_venda = /^(1|true|sim|s|yes)$/i.test(String(row.dados_adicionais_mostrar_venda));
        if (row.dados_adicionais_apenas_interno != null)
          obj.dados_adicionais_apenas_interno = /^(1|true|sim|s|yes)$/i.test(String(row.dados_adicionais_apenas_interno));
        return obj;
      });
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

  const colunasExibir = ['nome', 'telefone', 'cpf', 'observacoes', 'time_futebol'].filter((c) => headers.includes(c));
  if (colunasExibir.length === 0 && headers.length > 0) colunasExibir.push('nome');

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-overlay)' }}>
        <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-main">Importar clientes</h2>
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
            Use um arquivo CSV ou Excel (.xlsx) com a coluna obrigatória <strong>nome</strong>. Opcionais: telefone, cpf, observações, time_futebol e dados adicionais.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={baixarModelo}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-bg-card text-text-main hover:bg-bg-elevated disabled:opacity-50"
            >
              <span className="material-symbols-outlined">download</span>
              {downloading ? 'Baixando…' : 'Baixar modelo de importação'}
            </button>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">
              <span className="material-symbols-outlined">upload_file</span>
              Selecionar arquivo
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={handleFile}
                className="sr-only"
              />
            </label>
          </div>
          {erroPlanilha && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              {erroPlanilha}
            </div>
          )}
          {preview.length > 0 && !erroPlanilha && (
            <>
              <div className="max-h-48 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-bg-elevated sticky top-0">
                    <tr>
                      {colunasExibir.map((c) => (
                        <th key={c} className="px-3 py-2 text-left text-text-muted capitalize">
                          {c.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((p, i) => (
                      <tr key={i}>
                        {colunasExibir.map((col) => (
                          <td key={col} className="px-3 py-2 truncate max-w-[140px]">
                            {p[col] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-text-muted">
                {todasLinhas.length} linha(s) serão importadas. Nome é obrigatório; telefones duplicados podem ser ignorados.
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
            {todasLinhas.length > 0 && !resultado && !erroPlanilha && (
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
    </ModalPortal>
  );
}
