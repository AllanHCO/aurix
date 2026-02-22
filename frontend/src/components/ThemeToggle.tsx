import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  const label = isDark ? 'Alternar para modo claro' : 'Alternar para modo escuro';
  const icon = isDark ? 'light_mode' : 'dark_mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-text-main hover:bg-surface-elevated hover:text-primary transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-light"
      title={label}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-2xl" aria-hidden>
        {icon}
      </span>
    </button>
  );
}
