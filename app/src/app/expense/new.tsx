import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DateField } from '@/components/DateField';
import { PlotChooser } from '@/components/PlotChooser';
import { Button, Chips, ErrorBox, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { EXPENSE_LABELS, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';

export default function NewExpense() {
  const { t } = useT();
  const params = useLocalSearchParams<{ plot_id?: string }>();
  const { catalog } = useCatalog();
  const [plotId, setPlotId] = useState<number | null>(params.plot_id ? Number(params.plot_id) : null);
  const [category, setCategory] = useState('seed');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Math.round(Number(amount.replace(/[, ]/g, '')));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/expenses', { method: 'POST', body: { plot_id: plotId, category, amount: value, spent_on: spentOn, note: note.trim() || null } });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={t('Save expense')} onPress={save} loading={busy} disabled={!(value > 0)} />}>
      {error && <ErrorBox message={error} />}
      <Chips
        label={t('What was it for?')}
        value={category}
        onChange={setCategory}
        options={(catalog?.expense_categories ?? Object.keys(EXPENSE_LABELS)).map((c) => ({ value: c, label: t(EXPENSE_LABELS[c] ?? c) }))}
      />
      <Field label={t('Amount in shillings')} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="2500" />
      <PlotChooser value={plotId} onChange={(id) => setPlotId(id)} />
      <DateField label={t('Day spent')} value={spentOn} onChange={setSpentOn} max={todayIso()} />
      <Field label={t('Note (optional)')} value={note} onChangeText={setNote} placeholder={t('e.g. 2 bags DAP from the agrovet')} />
    </Screen>
  );
}
