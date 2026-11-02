import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '@/lib/i18n';
import { colors, styles as ui } from './ui';

/** A field that opens a searchable list to pick one item (for long lists like the 47 counties). */
export function Picker({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())), [options, query]);
  const chosen = options.find((o) => o.value === value);

  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[ui.input, s.trigger]}>
        <Text style={{ fontSize: 17, color: chosen ? colors.text : '#9CA3AF', flex: 1 }}>{chosen?.label ?? placeholder ?? t('Choose')}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.header}>
            <Text style={s.title}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Close')}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <TextInput value={query} onChangeText={setQuery} placeholder={t('Search')} placeholderTextColor="#9CA3AF" style={ui.input} autoFocus />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQuery('');
                }}
                style={({ pressed }) => [s.option, pressed && { backgroundColor: colors.primarySoft }]}
              >
                <Text style={{ fontSize: 17, color: colors.text, flex: 1 }}>{item.label}</Text>
                {item.value === value && <Ionicons name="checkmark" size={22} color={colors.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
