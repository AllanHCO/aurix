/**
 * Regras do slug (fonte da verdade no backend):
 * - minúsculo, sem acentos, espaços → -, apenas a-z 0-9 -
 * - sem - duplicado, não começar/terminar com -
 * - tamanho 3–60
 * - palavras reservadas bloqueadas
 */

const SLUG_MIN = 3;
const SLUG_MAX = 60;
const RESERVED = new Set(['admin', 'api', 'login', 'dashboard', 'configuracoes']);

/** Remove acentos (NFD e remove caracteres de combinação). */
function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Sanitiza e valida o slug. Retorna o slug normalizado ou null se inválido.
 * Não verifica unicidade (isso é feito no controller).
 */
export function sanitizeSlug(input: string): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  s = removeAccents(s);
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-|-$/g, '');
  if (s.length < SLUG_MIN || s.length > SLUG_MAX) return null;
  if (RESERVED.has(s)) return null;
  return s;
}

export function isSlugReserved(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}

export function getSlugValidationError(input: string): string | null {
  if (typeof input !== 'string' || !input.trim()) return 'Informe um slug.';
  const s = sanitizeSlug(input);
  if (s === null) {
    const trimmed = input.trim().toLowerCase();
    if (trimmed.length > 0 && trimmed.length < SLUG_MIN) return `Slug deve ter entre ${SLUG_MIN} e ${SLUG_MAX} caracteres.`;
    if (trimmed.length > SLUG_MAX) return `Slug deve ter entre ${SLUG_MIN} e ${SLUG_MAX} caracteres.`;
    const normalized = removeAccents(trimmed).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (normalized.length >= SLUG_MIN && RESERVED.has(normalized)) return 'Este endereço é reservado. Escolha outro.';
    return 'Use apenas letras, números e hífens (3 a 60 caracteres).';
  }
  return null;
}

/** Base para geração automática: sanitiza o nome e garante mínimo 3 caracteres. */
export function slugBaseFromName(nome: string): string {
  const s = sanitizeSlug(nome);
  if (s && s.length >= SLUG_MIN) return s;
  return 'agenda';
}

export const SLUG_MIN_LENGTH = SLUG_MIN;
export const SLUG_MAX_LENGTH = SLUG_MAX;
