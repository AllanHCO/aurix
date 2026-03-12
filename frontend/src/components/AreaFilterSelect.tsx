import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import SearchableSelect from './SearchableSelect';

const LABEL_TODAS = 'Todas as áreas';

/**
 * Filtro global por área de negócio.
 * Quando há zero ou uma área, pode ser ocultado ou exibido desabilitado.
 */
export default function AreaFilterSelect({
  label = 'Área de negócio',
  showLabel = true,
  className = '',
  disabled = false
}: {
  label?: string;
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { areas, selectedAreaId, setSelectedAreaId, loading, enabled } = useBusinessAreas();

  if (!enabled) {
    return null;
  }

  const options = [
    { value: '', label: LABEL_TODAS },
    ...areas.map((a) => ({ value: a.id, label: a.name, description: a.color ?? undefined }))
  ];

  if (areas.length <= 1 && !selectedAreaId) {
    return null;
  }

  return (
    <div className={className}>
      <SearchableSelect
        label={showLabel ? label : undefined}
        options={options}
        value={selectedAreaId ?? ''}
        onChange={(v) => setSelectedAreaId(v || null)}
        placeholder={LABEL_TODAS}
        emptyMessage="Nenhuma área encontrada"
        disabled={disabled || loading}
      />
    </div>
  );
}

export function AreaBadge({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-[var(--color-border)]"
      style={color ? { backgroundColor: `${color}20`, color, borderColor: `${color}40` } : undefined}
    >
      {name}
    </span>
  );
}
