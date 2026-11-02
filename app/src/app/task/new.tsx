import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DateField } from '@/components/DateField';
import { PlotChooser } from '@/components/PlotChooser';
import { Button, Chips, ErrorBox, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { TASK_LABELS, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';

const KINDS = ['prepare', 'plant', 'weed', 'fertilize', 'spray', 'water', 'scout', 'harvest', 'other'];

export default function NewTask() {
  const { t } = useT();
  const params = useLocalSearchParams<{ plot_id?: string }>();
  const [plotId, setPlotId] = useState<number | null>(params.plot_id ? Number(params.plot_id) : null);
  const [kind, setKind] = useState('other');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [dueOn, setDueOn] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/tasks', { method: 'POST', body: { plot_id: plotId, kind, title: title.trim(), details: details.trim() || null, due_on: dueOn } });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={t('Save activity')} onPress={save} loading={busy} disabled={!title.trim()} />}>
      {error && <ErrorBox message={error} />}
      <Field label={t('What needs doing?')} value={title} onChangeText={setTitle} placeholder={t('e.g. Buy CAN fertilizer')} />
      <Chips label={t('Kind of work')} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(TASK_LABELS[k]) }))} />
      <PlotChooser value={plotId} onChange={(id) => setPlotId(id)} />
      <DateField label={t('When')} value={dueOn} onChange={setDueOn} />
      <Field label={t('Notes (optional)')} value={details} onChangeText={setDetails} multiline />
    </Screen>
  );
}
