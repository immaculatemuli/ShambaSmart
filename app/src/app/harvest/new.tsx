import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DateField } from '@/components/DateField';
import { PlotChooser } from '@/components/PlotChooser';
import { Button, Chips, ErrorBox, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';

const UNITS = ['kg', 'bags', 'crates', 'heads', 'bunches'];

export default function NewHarvest() {
  const { t } = useT();
  const params = useLocalSearchParams<{ plot_id?: string; crop?: string }>();
  const { catalog } = useCatalog();
  const [plotId, setPlotId] = useState<number | null>(params.plot_id ? Number(params.plot_id) : null);
  const [crop, setCrop] = useState(params.crop ?? 'maize');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [income, setIncome] = useState('');
  const [harvestedOn, setHarvestedOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qty = Number(quantity.replace(',', '.'));
  const earned = income ? Math.round(Number(income.replace(/[, ]/g, ''))) : 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/harvests', {
        method: 'POST',
        body: { plot_id: plotId, crop, quantity: qty, unit, income: earned, harvested_on: harvestedOn, note: note.trim() || null },
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={t('Save harvest')} onPress={save} loading={busy} disabled={!(qty > 0) || Number.isNaN(earned)} />}>
      {error && <ErrorBox message={error} />}
      <PlotChooser
        value={plotId}
        onChange={(id, plot) => {
          setPlotId(id);
          if (plot) setCrop(plot.crop);
        }}
      />
      <Chips label={t('Crop')} value={crop} onChange={setCrop} options={(catalog?.crops ?? []).map((c) => ({ value: c.key, label: c.name }))} />
      <Field label={t('How much?')} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="10" />
      <Chips label={t('Unit')} value={unit} onChange={setUnit} options={UNITS.map((u) => ({ value: u, label: t(u) }))} />
      <Field
        label={t('Money from selling it (optional)')}
        value={income}
        onChangeText={setIncome}
        keyboardType="number-pad"
        placeholder="0"
        hint={t('Leave empty if you kept it for the home or have not sold it yet.')}
      />
      <DateField label={t('Day harvested')} value={harvestedOn} onChange={setHarvestedOn} max={todayIso()} />
      <Field label={t('Note (optional)')} value={note} onChangeText={setNote} placeholder={t('e.g. sold to a broker at the farm gate')} />
    </Screen>
  );
}
