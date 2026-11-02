import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DiagnosisView } from '@/components/DiagnosisView';
import { Button, ErrorBox, Loading, Muted, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/dialog';
import { longDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Diagnosis } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function DiagnosisScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Diagnosis>(`/diagnoses/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox message={error ?? ''} onRetry={reload} /></Screen>;

  const remove = async () => {
    if (!(await confirm(t('Delete this photo check?'), t('Delete'), { destructive: true }))) return;
    setBusy(true);
    try {
      await api(`/diagnoses/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      notify(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Muted style={{ marginBottom: 10 }}>{t('Checked on {date}', { date: longDate(data.created_at) })}</Muted>
      <DiagnosisView result={data.result} />
      <Button title={t('Check another photo')} icon="camera" variant="secondary" onPress={() => router.replace('/check')} />
      <Button title={t('Delete')} variant="danger" onPress={remove} loading={busy} />
    </Screen>
  );
}
