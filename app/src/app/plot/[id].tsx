import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { TaskRow } from '@/components/farm';
import { Ledger } from '@/components/Ledger';
import { MoneyStats } from '@/components/MoneyBreakdown';
import { Badge, Button, Card, colors, ErrorBox, ListRow, Loading, Muted, Progress, Screen, SectionTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/dialog';
import { daysFromToday, longDate, relativeDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Diagnosis, Expense, Harvest, MoneySummary, Plot, Task } from '@/lib/types';
import { useApi } from '@/lib/useApi';

interface PlotDetail {
  plot: Plot;
  tasks: Task[];
  expenses: Expense[];
  harvests: Harvest[];
  money: MoneySummary;
  diagnoses: Diagnosis[];
}

export default function PlotScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload, refreshing } = useApi<PlotDetail>(`/plots/${id}`);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorBox message={error ?? ''} onRetry={reload} /></Screen>;
  const { plot, money } = data;
  const growing = plot.status === 'growing';
  const open = data.tasks.filter((x) => !x.done_at);
  const done = data.tasks.filter((x) => x.done_at);

  const markHarvested = async () => {
    if (!(await confirm(t('Mark this plot as harvested? Its remaining calendar steps will be removed.'), t('Harvested')))) return;
    setBusy(true);
    try {
      await api(`/plots/${id}`, { method: 'PATCH', body: { status: 'harvested' } });
      await reload();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(t('Delete this plot and its tasks? Its expenses and harvests stay in your records.'), t('Delete'), { destructive: true }))) return;
    setBusy(true);
    try {
      await api(`/plots/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      notify(errorMessage(e));
      setBusy(false);
    }
  };

  const toHarvest = plot.expected_harvest_on ? daysFromToday(plot.expected_harvest_on) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: plot.name }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>
            {plot.crop_name}
            {plot.variety ? ` (${plot.variety})` : ''}
          </Text>
          <Badge text={growing ? t('Growing') : t('Harvested')} tone={growing ? 'success' : 'neutral'} />
        </View>
        <Muted>
          {t('Planted {date}', { date: longDate(plot.planted_on) })}
          {plot.size_acres ? ` · ${t('{n} acres', { n: plot.size_acres })}` : ''}
        </Muted>
        {growing && plot.progress !== null && plot.age_days >= 0 && (
          <>
            <Progress value={plot.progress} />
            <Muted>
              {t('Day {n} of about {total}', { n: plot.age_days, total: plot.season_days ?? '?' })} ·{' '}
              {toHarvest !== null && toHarvest > 0
                ? t('harvest around {date}', { date: longDate(plot.expected_harvest_on!) })
                : t('ready for harvest about now')}
            </Muted>
          </>
        )}
      </Card>
      <MoneyStats money={money} />

      <SectionTitle action={{ label: t('+ Activity'), onPress: () => router.push({ pathname: '/task/new', params: { plot_id: plot.id } }) }}>
        {t('To do')}
      </SectionTitle>
      <Card>
        {open.length === 0 ? <Muted>{t('Nothing left to do on this plot.')}</Muted> : open.map((task) => <TaskRow key={task.id} task={task} onChanged={reload} showPlot={false} />)}
        {done.length > 0 && (
          <Text onPress={() => setShowDone((v) => !v)} style={{ color: colors.primary, fontWeight: '600', marginTop: 10 }}>
            {showDone ? t('Hide done tasks') : t('Show {n} done tasks', { n: done.length })}
          </Text>
        )}
        {showDone && done.map((task) => <TaskRow key={task.id} task={task} onChanged={reload} showPlot={false} />)}
      </Card>

      <SectionTitle>{t('Money')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('Expense')} icon="remove-circle" variant="secondary" onPress={() => router.push({ pathname: '/expense/new', params: { plot_id: plot.id } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('Harvest')} icon="add-circle" variant="secondary" onPress={() => router.push({ pathname: '/harvest/new', params: { plot_id: plot.id, crop: plot.crop } })} />
        </View>
      </View>
      <Card>
        <Ledger expenses={data.expenses} harvests={data.harvests} onChanged={reload} showPlot={false} />
      </Card>

      {data.diagnoses.length > 0 && (
        <>
          <SectionTitle>{t('Photo checks')}</SectionTitle>
          <Card>
            {data.diagnoses.map((d, i) => (
              <ListRow
                key={d.id}
                title={d.result.healthy ? t('Looks healthy') : (d.result.problems[0]?.name ?? t('Needs attention'))}
                subtitle={relativeDay(d.created_at)}
                onPress={() => router.push(`/diagnosis/${d.id}`)}
                last={i === data.diagnoses.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      {growing && <Button title={t('Mark as harvested')} icon="basket" onPress={markHarvested} loading={busy} />}
      <Button title={t('Delete plot')} variant="danger" onPress={remove} disabled={busy} />
    </Screen>
  );
}
