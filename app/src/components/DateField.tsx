import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, longDate, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, styles as ui } from './ui';

/**
 * A date chosen with buttons (a day back or forward, a week back or forward, today), the same on phones and the
 * web, and easy with a thumb. `max`: the latest date allowed (e.g. today for money already spent).
 */
export function DateField({ label, value, onChange, max }: { label: string; value: string; onChange: (iso: string) => void; max?: string }) {
  const { t } = useT();
  const move = (days: number) => {
    const next = addDays(value, days);
    onChange(max && next > max ? max : next);
  };
  const atMax = !!max && value >= max;
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <View style={s.box}>
        <Step icon="play-back" label={t('A week earlier')} onPress={() => move(-7)} />
        <Step icon="chevron-back" label={t('A day earlier')} onPress={() => move(-1)} />
        <Text style={s.date}>{longDate(value)}</Text>
        <Step icon="chevron-forward" label={t('A day later')} onPress={() => move(1)} disabled={atMax} />
        <Step icon="play-forward" label={t('A week later')} onPress={() => move(7)} disabled={atMax} />
      </View>
      {value !== todayIso() && (!max || todayIso() <= max) && (
        <Pressable onPress={() => onChange(todayIso())} hitSlop={8}>
          <Text style={[ui.link, { marginTop: 6, fontSize: 14 }]}>{t('Set to today')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Step({ icon, label, onPress, disabled }: { icon: 'play-back' | 'chevron-back' | 'chevron-forward' | 'play-forward'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={[s.step, disabled && { opacity: 0.3 }]}>
      <Ionicons name={icon} size={icon.startsWith('play') ? 16 : 22} color={colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 4,
    minHeight: 50,
  },
  step: { padding: 10 },
  date: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
});
