import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Ledger } from '@/components/Ledger';
import { MoneyStats, SpendingBars } from '@/components/MoneyBreakdown';
import { Button, Card, Chips, ErrorBox, ListRow, Loading, Muted, Screen, SectionTitle } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { addDays, kes, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Expense, Harvest, MoneySummary } from '@/lib/types';
import { useApi } from '@/lib/useApi';

type Period = 'month' | 'season' | 'year' | 'all';

function rangeOf(period: Period) {
  const today = todayIso();
  if (period === 'month') return `from=${today.slice(0, 7)}-01&to=${today}`;
  if (period === 'season') return `from=${addDays(today, -182)}&to=${today}`;
  if (period === 'year') return `from=${today.slice(0, 4)}-01-01&to=${today}`;
  return '';
}

export default function RecordsScreen() {
  const { t } = useT();
  const { cropName } = useCatalog();
  const [period, setPeriod] = useState<Period>('season');
  const q = rangeOf(period);
  const summary = useApi<MoneySummary>(`/records/summary?${q}`);
  const expenses = useApi<{ expenses: Expense[] }>(`/expenses?${q}`);
  const harvests = useApi<{ harvests: Harvest[] }>(`/harvests?${q}`);
  const reload = () => {
    void summary.reload();
    void expenses.reload();
    void harvests.reload();
  };
  const error = summary.error || expenses.error || harvests.error;
  const money = summary.data;

  return (
    <Screen
      refreshing={summary.refreshing}
      onRefresh={reload}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('Expense')} icon="remove-circle" variant="secondary" onPress={() => router.push('/expense/new')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('Harvest')} icon="add-circle" onPress={() => router.push('/harvest/new')} />
          </View>
        </View>
      }
    >
      <Chips<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'month', label: t('This month') },
          { value: 'season', label: t('Last 6 months') },
          { value: 'year', label: t('This year') },
          { value: 'all', label: t('All') },
        ]}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!money ? (
        <Loading />
      ) : (
        <>
      <MoneyStats money={money} />

          {money.by_plot.length > 0 && (
            <>
              <SectionTitle>{t('Profit by plot')}</SectionTitle>
              <Card>
                {money.by_plot.map((p, i) => (
                  <ListRow
                    key={p.plot_id}
                    title={p.name}
                    subtitle={`${cropName(p.crop)} · ${t('spent {spent}, earned {earned}', { spent: kes(p.spent), earned: kes(p.earned) })}`}
                    right={kes(p.profit)}
                    onPress={() => router.push(`/plot/${p.plot_id}`)}
                    last={i === money.by_plot.length - 1}
                  />
                ))}
              </Card>
            </>
          )}

          {money.by_category.length > 0 && (
            <>
              <SectionTitle>{t('Where the money went')}</SectionTitle>
              <Card>
                <SpendingBars summary={money} />
              </Card>
            </>
          )}

          <SectionTitle>{t('All records')}</SectionTitle>
          <Card>
            <Ledger expenses={expenses.data?.expenses ?? []} harvests={harvests.data?.harvests ?? []} onChanged={reload} />
          </Card>
          <Muted>{t('Tap a record to delete it.')}</Muted>
        </>
      )}
    </Screen>
  );
}
