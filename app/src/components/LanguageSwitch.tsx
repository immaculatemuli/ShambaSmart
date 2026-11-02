import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { colors } from './ui';

/** English | Kiswahili toggle. */
export function LanguageSwitch() {
  const { language, setLanguage } = useT();
  return (
    <View style={s.row} accessibilityRole="radiogroup">
      {(
        [
          ['en', 'English'],
          ['sw', 'Kiswahili'],
        ] as const
      ).map(([code, name]) => {
        const on = language === code;
        return (
          <Pressable
            key={code}
            onPress={() => setLanguage(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[s.option, on && { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: on ? '#fff' : colors.primary, fontWeight: '600' }}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.primary, borderRadius: 999, overflow: 'hidden', alignSelf: 'center' },
  option: { paddingHorizontal: 18, paddingVertical: 8 },
});
