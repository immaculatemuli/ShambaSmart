import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Button, colors, ErrorBox, Field, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function SignIn() {
  const { t } = useT();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(phone, password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={s.hero}>
          <View style={s.logo}>
            <Ionicons name="leaf" size={44} color="#fff" />
          </View>
          <Text style={s.name}>ShambaSmart</Text>
          <Text style={s.tagline}>{t('Your farming companion: crop calendar, weather, crop health, market prices and records.')}</Text>
        </View>
        <View style={{ marginBottom: 20 }}>
          <LanguageSwitch />
        </View>
        {error && <ErrorBox message={error} />}
        <Field label={t('Phone number')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XX XXX XXX" autoComplete="tel" />
        <Field label={t('Password')} value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} autoComplete="password" />
        <Button title={t('Sign in')} onPress={submit} loading={busy} disabled={!phone || !password} />
        <View style={s.footer}>
          <Text style={{ color: colors.muted, fontSize: 15 }}>{t('New to ShambaSmart?')} </Text>
          <Link href="/register" style={s.link}>
            {t('Create an account')}
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 48, marginBottom: 24 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { fontSize: 30, fontWeight: '800', color: colors.primaryDark },
  tagline: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 360 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
