import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@/components/Picker';
import { Button, ErrorBox, Field, Muted, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import { useT } from '@/lib/i18n';

export default function Register() {
  const { t } = useT();
  const { register } = useAuth();
  const { catalog } = useCatalog();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [county, setCounty] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), phone, password, county);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        {error && <ErrorBox message={error} />}
        <Field label={t('Your name')} value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" />
        <Field label={t('Phone number')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XX XXX XXX" autoComplete="tel" />
        <Field label={t('Password')} value={password} onChangeText={setPassword} secureTextEntry hint={t('At least 6 characters')} autoComplete="new-password" />
        <Picker
          label={t('Your county')}
          value={county}
          onChange={setCounty}
          placeholder={t('Choose your county')}
          options={(catalog?.counties ?? []).map((c) => ({ value: c.name, label: c.name }))}
        />
        <Muted style={{ marginBottom: 12 }}>{t('Your county sets the weather forecast. You can share your exact location later in My account.')}</Muted>
        <Button title={t('Create an account')} onPress={submit} loading={busy} disabled={name.trim().length < 2 || !phone || password.length < 6} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
