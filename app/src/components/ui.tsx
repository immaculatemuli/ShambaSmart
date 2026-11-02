import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/lib/i18n';

export const colors = {
  // Leaf green (white text on it is easy to read outdoors), with a warm soil brown for money.
  primary: '#1F7A3A',
  primaryDark: '#145228',
  primarySoft: '#E6F4EA',
  soil: '#8A5A2B',
  soilSoft: '#F6EDE3',
  text: '#111827',
  muted: '#4B5563',
  border: '#E5E7EB',
  bg: '#F4F6F2',
  card: '#FFFFFF',
  danger: '#B91C1C',
  dangerSoft: '#FDECEC',
  warning: '#92400E',
  warningSoft: '#FEF3C7',
  info: '#1E40AF',
  infoSoft: '#E0E7FF',
};

export type IconName = ComponentProps<typeof Ionicons>['name'];

// On a wide screen (the web app on a computer) pages keep a readable width in the middle.
const MAX_WIDTH = 760;

/** Sets the header title of a stack screen. */
export function Title({ text }: { text: string }) {
  return <Stack.Screen options={{ title: text }} />;
}

/** Scrollable page with standard padding and optional pull-to-refresh; a footer stays fixed at the bottom. */
export function Screen({ children, refreshing, onRefresh, footer }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const page = (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={styles.page}>{children}</View>
    </ScrollView>
  );
  if (!footer) return page;
  return (
    <View style={styles.screen}>
      {page}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.page}>{footer}</View>
      </View>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text style={styles.link}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Muted({ children, center, style }: { children: ReactNode; center?: boolean; style?: object }) {
  return <Text style={[styles.muted, center && { textAlign: 'center' }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'secondary' && { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 },
        variant === 'danger' && { backgroundColor: colors.card, borderColor: colors.danger, borderWidth: 1 },
        pressed && { opacity: 0.8 },
        inactive && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A labelled text box. A password box (secureTextEntry) gets an eye button to show or hide what was typed. */
export function Field({ label, hint, style, secureTextEntry, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { t } = useT();
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor="#9CA3AF"
          style={[styles.input, secureTextEntry && { paddingRight: 48 }, style]}
          secureTextEntry={secureTextEntry && !shown}
          autoCapitalize={secureTextEntry ? 'none' : props.autoCapitalize}
          autoCorrect={secureTextEntry ? false : props.autoCorrect}
          {...props}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setShown((s) => !s)}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={shown ? t('Hide password') : t('Show password')}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>{t('Try again')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Notice({ children, tone = 'warning', icon }: { children: ReactNode; tone?: 'warning' | 'success' | 'info'; icon?: IconName }) {
  const [bg, fg] = { warning: [colors.warningSoft, colors.warning], success: [colors.primarySoft, colors.primaryDark], info: [colors.infoSoft, colors.info] }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8, marginTop: 1 }} />}
      <Text style={{ color: fg, fontSize: 14, flex: 1, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

/** Still waiting after a few seconds (the free server waking up): says so, so the app doesn't look stuck. */
export function useSlow(waiting = true, afterMs = 5000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [waiting, afterMs]);
  return waiting && slow;
}

export function Loading() {
  const { t } = useT();
  const slow = useSlow();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {slow && <Text style={[styles.muted, { textAlign: 'center', marginTop: 16 }]}>{t('Connecting to ShambaSmart… this can take up to a minute.')}</Text>}
    </View>
  );
}

export function Empty({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center' }}>
      {icon && <Ionicons name={icon} size={36} color="#9CA3AF" style={{ marginBottom: 8 }} />}
      <Muted center>{text}</Muted>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  rightSub,
  onPress,
  icon,
  iconColor,
  last,
}: {
  title: string;
  subtitle?: string | null;
  right?: string;
  rightSub?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  iconColor?: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, last && { borderBottomWidth: 0 }, pressed && onPress && { backgroundColor: '#F3F4F6' }]}
    >
      {icon && <Ionicons name={icon} size={22} color={iconColor ?? colors.primary} style={{ marginRight: 12 }} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        {right !== undefined && <Text style={styles.rowRight}>{right}</Text>}
        {rightSub}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: 4 }} />}
    </Pressable>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' }) {
  const palette = {
    neutral: ['#F3F4F6', colors.muted],
    success: [colors.primarySoft, colors.primaryDark],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={{ color: palette[1], fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

/** Single-choice selector shown as wrapping chips. */
export function Chips<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.field}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '500' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'good' && { color: colors.primary }, tone === 'bad' && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

/** A thin bar showing how far along something is (0 to 1). */
export function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }]} />
    </View>
  );
}

/** A round button with an icon, for the quick actions on the home screen. */
export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, paddingBottom: 40 },
  page: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  footer: { backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 6,
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  field: { marginBottom: 14 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  eye: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 4 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: colors.danger, fontSize: 15 },
  retry: { color: colors.danger, fontWeight: '700', marginTop: 6 },
  notice: { borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowRight: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.card },
  stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { fontSize: 19, fontWeight: '700', color: colors.text },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  quick: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  quickIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 13, color: colors.text, textAlign: 'center', fontWeight: '500' },
});
