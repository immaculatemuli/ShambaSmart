import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { confirm, notify } from '@/lib/dialog';
import { EXPENSE_LABELS, kes, shortDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Expense, Harvest } from '@/lib/types';
import { colors, Empty, ListRow } from './ui';

type Entry = { kind: 'expense'; item: Expense } | { kind: 'harvest'; item: Harvest };

/** Expenses and harvests together, newest first. Tapping one offers to delete it. */
export function Ledger({ expenses, harvests, onChanged, showPlot = true }: { expenses: Expense[]; harvests: Harvest[]; onChanged: () => void; showPlot?: boolean }) {
  const { t } = useT();
  const { cropName } = useCatalog();
  const entries: Entry[] = [
    ...expenses.map((item) => ({ kind: 'expense' as const, item })),
    ...harvests.map((item) => ({ kind: 'harvest' as const, item })),
  ].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.item.id - a.item.id);

  if (!entries.length) return <Empty icon="document-text-outline" text={t('No records yet. Add what you spend and harvest to see your profit.')} />;

  const remove = async (entry: Entry) => {
    const what = entry.kind === 'expense' ? t('Delete this expense?') : t('Delete this harvest?');
    if (!(await confirm(what, t('Delete'), { destructive: true }))) return;
    try {
      await api(`/${entry.kind === 'expense' ? 'expenses' : 'harvests'}/${entry.item.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  return (
    <>
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const plot = showPlot && entry.item.plot_name ? ` · ${entry.item.plot_name}` : '';
        if (entry.kind === 'expense') {
          const e = entry.item;
          return (
            <ListRow
              key={`e${e.id}`}
              icon="arrow-up-circle"
              iconColor={colors.danger}
              title={t(EXPENSE_LABELS[e.category] ?? e.category)}
              subtitle={`${shortDate(e.spent_on)}${plot}${e.note ? ` · ${e.note}` : ''}`}
              right={`−${kes(e.amount)}`}
              onPress={() => remove(entry)}
              last={last}
            />
          );
        }
        const h = entry.item;
        return (
          <ListRow
            key={`h${h.id}`}
            icon="arrow-down-circle"
            iconColor={colors.primary}
            title={`${cropName(h.crop)}: ${h.quantity} ${t(h.unit)}`}
            subtitle={`${shortDate(h.harvested_on)}${plot}${h.note ? ` · ${h.note}` : ''}`}
            right={h.income ? `+${kes(h.income)}` : t('Kept')}
            onPress={() => remove(entry)}
            last={last}
          />
        );
      })}
    </>
  );
}

const dateOf = (e: Entry) => (e.kind === 'expense' ? e.item.spent_on : e.item.harvested_on);
