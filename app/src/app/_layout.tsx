import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CatalogProvider } from '@/lib/catalog';
import { LanguageProvider, useT } from '@/lib/i18n';

function RootNavigator() {
  const { loading, user } = useAuth();
  const { t, ready } = useT();
  if (loading || !ready) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'ShambaSmart' }} />
        <Stack.Screen name="plot/new" options={{ title: t('Add a plot') }} />
        <Stack.Screen name="plot/[id]" options={{ title: t('Plot') }} />
        <Stack.Screen name="task/new" options={{ title: t('Add an activity') }} />
        <Stack.Screen name="weather" options={{ title: t('Weather') }} />
        <Stack.Screen name="diagnosis/[id]" options={{ title: t('Photo check') }} />
        <Stack.Screen name="price/report" options={{ title: t('Report a price') }} />
        <Stack.Screen name="expense/new" options={{ title: t('Add an expense') }} />
        <Stack.Screen name="harvest/new" options={{ title: t('Add a harvest') }} />
        <Stack.Screen name="account" options={{ title: t('My account') }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, title: t('Sign in') }} />
        <Stack.Screen name="register" options={{ title: t('Create an account') }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <CatalogProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </CatalogProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
