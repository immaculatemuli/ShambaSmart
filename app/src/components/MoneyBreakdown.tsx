import { StyleSheet, Text, View } from 'react-native';
import { EXPENSE_LABELS, kes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { MoneySummary } from '@/lib/types';
import { colors, Stat, StatGrid } from './ui';

/** Spent, earned and profit side by side. "KES" goes in the label so the number fits a narrow phone. */
export function MoneyStats({ money }: { money: Pick<MoneySummary, 'spent' | 'earned' | 'profit'> }) {
  const { t } = useT();
  const n = (amount: number) => Math.round(amount).toLocaleString('en-KE');
  return (
    <StatGrid>
      <Stat label={`${t('Spent')} (KES)`} value={n(money.spent)} />
      <Stat label={`${t('Earned')} (KES)`} value={n(money.earned)} />
      <Stat label={`${t('Profit')} (KES)`} value={n(money.profit)} tone={money.profit >= 0 ? 'good' : 'bad'} />
    </StatGrid>
  );
}

/** Where the money went: one bar per expense category, longest first. */
export function SpendingBars({ summary }: { summary: MoneySummary }) {
  const { t } = useT();
  const top = Math.max(...summary.by_category.map((c) => c.amount), 1);
  return (
    <>
      {summary.by_category.map((c) => (
        <View key={c.category} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.label}>{t(EXPENSE_LABELS[c.category] ?? c.category)}</Text>
            <Text style={s.value}>{kes(c.amount)}</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(2, (100 * c.amount) / top)}%` }]} />
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 15, color: colors.text },
  value: { fontSize: 15, fontWeight: '600', color: colors.text },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.soilSoft, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.soil },
});
