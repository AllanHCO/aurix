import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * z-index máximo para garantir que modais/drawers fiquem sempre por cima
 * de sidebar (z-50), headers, tabelas com coluna fixa, etc.
 */
const MODAL_PORTAL_Z = 2147483647;

/**
 * Renderiza o conteúdo (modal/drawer) diretamente em document.body,
 * fora da árvore do Layout, para que fique sempre por cima de qualquer
 * overflow ou z-index da página (ex.: tabelas, listas, sidebar).
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="aurix-modal-portal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_PORTAL_Z,
        pointerEvents: 'none',
        isolation: 'isolate'
      }}
      aria-hidden="false"
    >
      <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', minHeight: '100%' }}>{children}</div>
    </div>,
    document.body
  );
}
