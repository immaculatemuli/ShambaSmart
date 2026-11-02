import { useT } from '@/lib/i18n';
import type { Plot } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { Chips } from './ui';

/** Which plot something belongs to (or none: the whole farm). Growing plots, plus the chosen one if harvested. */
export function PlotChooser({ value, onChange, label }: { value: number | null; onChange: (id: number | null, plot: Plot | null) => void; label?: string }) {
  const { t } = useT();
  const plots = useApi<{ plots: Plot[] }>('/plots');
  const list = (plots.data?.plots ?? []).filter((p) => p.status === 'growing' || p.id === value);
  if (!list.length) return null;
  return (
    <Chips<number | null>
      label={label ?? t('Plot')}
      value={value}
      onChange={(id) => onChange(id, list.find((p) => p.id === id) ?? null)}
      options={[{ value: null, label: t('Whole farm') }, ...list.map((p) => ({ value: p.id, label: `${p.name} (${p.crop_name})` }))]}
    />
  );
}
