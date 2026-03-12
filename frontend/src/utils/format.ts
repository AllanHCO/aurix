export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/** Moeda sem centavos (sem vírgula e decimais) — ex: R$ 150.170 — para caber melhor no dashboard. */
export function formatCurrencyNoCents(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Máscara telefone BR: (11) 99999-9999 ou (11) 9999-9999 */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara CPF: 000.000.000-00 (11 dígitos) ou CNPJ: 00.000.000/0001-00 (14 dígitos) */
export function maskCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length <= 11) {
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 9);
    const r = d.slice(9, 11);
    const parts = [a, b, c].filter(Boolean).join('.');
    return r ? `${parts}-${r}` : parts || d;
  }
  const a = d.slice(0, 2);
  const b = d.slice(2, 5);
  const c = d.slice(5, 8);
  const d4 = d.slice(8, 12);
  const r = d.slice(12, 14);
  const parts = `${a}.${b}.${c}/${d4}`;
  return r ? `${parts}-${r}` : parts;
}

/** Aplica máscara de telefone ao digitar (onChange) */
export function applyPhoneMask(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void): void {
  setter(maskPhone(e.target.value));
}

/** Aplica máscara CPF/CNPJ ao digitar */
export function applyCpfCnpjMask(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void): void {
  setter(maskCpfCnpj(e.target.value));
}
