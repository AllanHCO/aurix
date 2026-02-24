/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Dark SaaS — hierarquia de superfícies */
        "bg-main": "var(--color-bg-main)",
        "bg-secondary": "var(--color-bg-secondary)",
        "bg-card": "var(--color-bg-card)",
        "bg-modal": "var(--color-bg-modal)",
        "bg-elevated": "var(--color-bg-elevated)",
        border: "var(--color-border)",
        "border-soft": "var(--color-border-soft)",
        /* Primary e texto */
        primary: "var(--color-primary)",
        "primary-dark": "var(--color-primary-dark)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-active": "var(--color-primary-active)",
        "primary-light": "var(--color-primary-light)",
        "text-on-primary": "var(--color-text-on-primary)",
        "text-main": "var(--color-text-main)",
        "text-muted": "var(--color-text-muted)",
        "text-tertiary": "var(--color-text-tertiary)",
        /* Compatibilidade */
        "background-light": "var(--color-bg)",
        "background-dark": "var(--color-bg-secondary)",
        "surface-light": "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        "border-light": "var(--color-border)",
        "input-bg": "var(--color-input-bg)",
        "input-border": "var(--color-input-border)",
        "sidebar-active-bg": "var(--color-sidebar-active-bg)",
        "sidebar-hover": "var(--color-sidebar-hover)",
        "badge-pago": "var(--color-badge-pago)",
        "badge-pago-text": "var(--color-badge-pago-text)",
        "badge-pendente": "var(--color-badge-pendente)",
        "badge-pendente-text": "var(--color-badge-pendente-text)",
        "badge-erro": "var(--color-badge-erro)",
        "badge-erro-text": "var(--color-badge-erro-text)",
        "badge-estoque": "var(--color-badge-estoque)",
        "badge-estoque-text": "var(--color-badge-estoque-text)",
        success: "var(--color-success)",
        error: "var(--color-error)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
      },
      transitionDuration: {
        theme: "300ms",
      },
    },
  },
  plugins: [],
}
