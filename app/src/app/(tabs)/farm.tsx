import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PlotCard, TaskRow } from '@/components/farm';
import { Button, Card, Chips, Empty, ErrorBox, Loading, Screen, SectionTitle } from '@/components/ui';
import { addDays, daysFromToday, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Plot, Task } from '@/lib/types';
import { useApi } from '@/lib/useApi';

type Tab = 'tasks' | 'plots' | 'done';

/** The crop calendar: all coming farm work grouped by week, the plots, and work already done. */
export default function FarmScreen() {
  const { t } = useT();
  const [view, setView] = useState<Tab>('tasks');
  const tasks = useApi<{ tasks: Task[] }>(view === 'done' ? '/tasks?status=done' : '/tasks?status=open');
  const plots = useApi<{ plots: Plot[] }>('/plots');

  const groups = useMemo(() => {
    const list = tasks.data?.tasks ?? [];
    const weekEnd = addDays(todayIso(), 6 - ((new Date().getDay() + 6) % 7)); // this Sunday
    const buckets: { title: string; items: Task[] }[] = [
      { title: t('Overdue'), items: [] },
      { title: t('This week'), items: [] },
      { title: t('Next week'), items: [] },
      { title: t('Later'), items: [] },
    ];
    for (const task of list) {
      if (daysFromToday(task.due_on) < 0) buckets[0].items.push(task);
      else if (task.due_on <= weekEnd) buckets[1].items.push(task);
      else if (task.due_on <= addDays(weekEnd, 7)) buckets[2].items.push(task);
      else buckets[3].items.push(task);
    }
    return buckets.filter((b) => b.items.length);
  }, [tasks.data, t]);

  const reload = () => {
    void tasks.reload();
    void plots.reload();
  };

  if (tasks.loading && plots.loading) return <Loading />;

  return (
    <Screen
      refreshing={tasks.refreshing || plots.refreshing}
      onRefresh={reload}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('Plot')} icon="add" onPress={() => router.push('/plot/new')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('Activity')} icon="add" variant="secondary" onPress={() => router.push('/task/new')} />
          </View>
        </View>
      }
    >
      <Chips<Tab>
        value={view}
        onChange={setView}
        options={[
          { value: 'tasks', label: t('To do') },
          { value: 'plots', label: t('Plots') },
          { value: 'done', label: t('Done') },
        ]}
      />
      {(tasks.error || plots.error) && <ErrorBox message={(tasks.error || plots.error)!} onRetry={reload} />}

      {view === 'plots' &&
        ((plots.data?.plots.length ?? 0) === 0 ? (
          <Empty icon="leaf-outline" text={t('No plots yet. Add one to get its crop calendar.')} />
        ) : (
          plots.data!.plots.map((p) => <PlotCard key={p.id} plot={p} />)
        ))}

      {view === 'tasks' &&
        (groups.length === 0 ? (
          <Empty icon="calendar-outline" text={t('Nothing to do yet. Add a plot and its season’s work appears here.')} />
        ) : (
          groups.map((g) => (
            <View key={g.title}>
              <SectionTitle>{g.title}</SectionTitle>
              <Card>
                {g.items.map((task) => (
                  <TaskRow key={task.id} task={task} onChanged={tasks.reload} />
                ))}
              </Card>
            </View>
          ))
        ))}

      {view === 'done' &&
        ((tasks.data?.tasks.length ?? 0) === 0 ? (
          <Empty icon="checkmark-done-outline" text={t('Tasks you tick off show here.')} />
        ) : (
          <Card>
            {tasks.data!.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onChanged={tasks.reload} />
            ))}
          </Card>
        ))}
    </Screen>
  );
}
