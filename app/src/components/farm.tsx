import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { notify } from '@/lib/dialog';
import { dayName, daysFromToday, relativeDay, TASK_ICONS, weatherLook } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Alert, ForecastDay, Plot, Task } from '@/lib/types';
import { Badge, colors, IconName, Progress } from './ui';

/** A farm task with a tick box. Tapping the text opens its details. */
export function TaskRow({ task, onChanged, showPlot = true }: { task: Task; onChanged: () => void; showPlot?: boolean }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const done = !!task.done_at;
  const overdue = !done && daysFromToday(task.due_on) < 0;

  const toggle = async () => {
    setBusy(true);
    try {
      await api(`/tasks/${task.id}`, { method: 'PATCH', body: { done: !done } });
      onChanged();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.task}>
      <Pressable
        onPress={toggle}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title}
        style={[s.tick, done && { backgroundColor: colors.primary, borderColor: colors.primary }]}
      >
        {done && <Ionicons name="checkmark" size={18} color="#fff" />}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={(TASK_ICONS[task.kind] ?? 'ellipse-outline') as IconName} size={16} color={colors.muted} />
          <Text style={[s.taskTitle, done && s.doneText]}>{task.title}</Text>
        </View>
        <Text style={[s.taskSub, overdue && { color: colors.danger, fontWeight: '600' }]}>
          {overdue ? t('Overdue: {when}', { when: relativeDay(task.due_on) }) : relativeDay(task.due_on)}
          {showPlot && task.plot_name ? ` · ${task.plot_name}` : ''}
        </Text>
        {open && !!task.details && <Text style={s.details}>{task.details}</Text>}
        {open && task.plot_id && showPlot && (
          <Pressable onPress={() => router.push(`/plot/${task.plot_id}`)} hitSlop={6}>
            <Text style={s.link}>{t('Open plot')}</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const ALERT_TONE = {
  warning: [colors.warningSoft, colors.warning],
  good: [colors.primarySoft, colors.primaryDark],
  info: [colors.infoSoft, colors.info],
} as const;

export function AlertCard({ alert }: { alert: Alert }) {
  const [bg, fg] = ALERT_TONE[alert.level];
  return (
    <View style={[s.alert, { backgroundColor: bg }]}>
      <Ionicons name={(alert.icon as IconName) ?? 'alert-circle'} size={24} color={fg} style={{ marginRight: 10, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.alertTitle, { color: fg }]}>{alert.title}</Text>
        <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{alert.message}</Text>
      </View>
    </View>
  );
}

/** Seven days side by side: picture, high/low and rain. */
export function ForecastStrip({ days }: { days: ForecastDay[] }) {
  return (
    <View style={s.strip}>
      {days.map((d) => {
        const look = weatherLook(d.code);
        return (
          <View key={d.date} style={s.day} accessibilityLabel={`${dayName(d.date)}: ${look.label}, ${Math.round(d.temp_max)}°, ${Math.round(d.rain_mm)} mm`}>
            <Text style={s.dayName}>{dayName(d.date)}</Text>
            <Ionicons name={look.icon as IconName} size={24} color={d.rain_mm >= 2 ? colors.info : colors.soil} />
            <Text style={s.temp}>{Math.round(d.temp_max)}°</Text>
            <Text style={s.low}>{Math.round(d.temp_min)}°</Text>
            <Text style={[s.rain, d.rain_mm < 1 && { color: '#9CA3AF' }]}>{d.rain_mm < 1 ? '–' : `${Math.round(d.rain_mm)}mm`}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PlotCard({ plot }: { plot: Plot }) {
  const { t } = useT();
  const harvested = plot.status === 'harvested';
  const toHarvest = plot.expected_harvest_on ? daysFromToday(plot.expected_harvest_on) : null;
  const growth = plot.age_days < 0 ? t('Planting {when}', { when: relativeDay(plot.planted_on) }) : t('Day {n}', { n: plot.age_days });
  return (
    <Pressable onPress={() => router.push(`/plot/${plot.id}`)} accessibilityRole="button" style={({ pressed }) => [s.plot, pressed && { opacity: 0.85 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.plotName}>{plot.name}</Text>
          <Text style={s.taskSub}>
            {plot.crop_name}
            {plot.size_acres ? ` · ${t('{n} acres', { n: plot.size_acres })}` : ''}
          </Text>
        </View>
        {harvested ? <Badge text={t('Harvested')} /> : <Badge text={growth} tone="success" />}
      </View>
      {!harvested && plot.progress !== null && plot.age_days >= 0 && (
        <>
          <Progress value={plot.progress} />
          <Text style={s.taskSub}>
            {toHarvest !== null && toHarvest > 0 ? t('Harvest in about {n} days', { n: toHarvest }) : t('Ready for harvest about now')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tick: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  taskTitle: { fontSize: 16, color: colors.text, fontWeight: '500', flexShrink: 1 },
  doneText: { textDecorationLine: 'line-through', color: colors.muted },
  taskSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  details: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '600', marginTop: 6 },
  alert: { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 10 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', flex: 1, gap: 2 },
  dayName: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  temp: { fontSize: 15, fontWeight: '700', color: colors.text },
  low: { fontSize: 12, color: colors.muted },
  rain: { fontSize: 11, color: colors.info, fontWeight: '600' },
  plot: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  plotName: { fontSize: 17, fontWeight: '700', color: colors.text },
});
