import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { ColorValue, Platform, Pressable } from 'react-native';
import { colors, IconName } from '@/components/ui';
import { useT } from '@/lib/i18n';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  const { t } = useT();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        // The web has no safe-area padding below the bar, so it gets room for the labels itself.
        tabBarStyle: Platform.OS === 'web' ? { height: 62, paddingBottom: 8 } : undefined,
        headerRight: () => (
          <Pressable onPress={() => router.push('/account')} hitSlop={10} style={{ marginRight: 16 }} accessibilityRole="button" accessibilityLabel={t('My account')}>
            <Ionicons name="person-circle-outline" size={28} color="#fff" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ShambaSmart', tabBarLabel: t('Home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="farm" options={{ title: t('My farm'), tabBarLabel: t('Farm'), tabBarIcon: icon('leaf') }} />
      <Tabs.Screen name="check" options={{ title: t('Crop health check'), tabBarLabel: t('Check'), tabBarIcon: icon('camera') }} />
      <Tabs.Screen name="market" options={{ title: t('Market prices'), tabBarLabel: t('Market'), tabBarIcon: icon('pricetags') }} />
      <Tabs.Screen name="records" options={{ title: t('Farm records'), tabBarLabel: t('Records'), tabBarIcon: icon('wallet') }} />
    </Tabs>
  );
}
