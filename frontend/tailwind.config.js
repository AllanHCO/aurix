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
        /* Cores que mudam com o tema via variáveis CSS ( :root / .dark ) */
        primary: "var(--color-primary)",
        "primary-dark": "var(--color-primary-dark)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-active": "var(--color-primary-active)",
        "text-on-primary": "var(--color-text-on-primary)",
        "primary-light": "#fefce8",
        "background-light": "var(--color-bg)",
        "background-dark": "var(--color-bg-secondary)",
        "surface-light": "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        "text-main": "var(--color-text-main)",
        "text-muted": "var(--color-text-muted)",
        "text-tertiary": "var(--color-text-tertiary)",
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
        "success": "var(--color-success)",
        "error": "var(--color-error)",
        "warning": "var(--color-warning)",
        "mint": "#10b981",
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
