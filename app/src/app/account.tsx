import * as Location from 'expo-location';
import { useState } from 'react';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Picker } from '@/components/Picker';
import { Button, Card, ErrorBox, Field, Muted, Notice, Screen, SectionTitle } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import { confirm, notify } from '@/lib/dialog';
import { useT } from '@/lib/i18n';
import type { User } from '@/lib/types';

export default function Account() {
  const { t } = useT();
  const { user, updateUser, signOut } = useAuth();
  const { catalog } = useCatalog();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    setSaved(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError || !(e instanceof Error) ? errorMessage(e) : e.message);
    } finally {
      setBusy(null);
    }
  };

  const change = (body: object, message: string) =>
    run('profile', async () => {
      const { user: fresh } = await api<{ user: User }>('/me', { method: 'PATCH', body });
      updateUser(fresh);
      setSaved(message);
    });

  const useMyLocation = () =>
    run('location', async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error(t('Location permission was not given. You can still choose your county.'));
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { user: fresh } = await api<{ user: User }>('/me', { method: 'PATCH', body: { latitude: coords.latitude, longitude: coords.longitude } });
      updateUser(fresh);
      setSaved(t('Weather now follows your farm’s exact location.'));
    });

  const removeAccount = async () => {
    if (!(await confirm(t('Delete your account and all your farm records? This cannot be undone.'), t('Delete'), { destructive: true }))) return;
    await run('delete', async () => {
      await api('/me', { method: 'DELETE', body: { password: deletePassword } });
      await signOut();
    });
  };

  if (!user) return null;

  return (
    <Screen>
      {error && <ErrorBox message={error} />}
      {saved && <Notice tone="success" icon="checkmark-circle">{saved}</Notice>}

      <SectionTitle>{t('Language')}</SectionTitle>
      <Card>
        <LanguageSwitch />
      </Card>

      <SectionTitle>{t('Farm location')}</SectionTitle>
      <Card>
        <Picker
          label={t('County')}
          value={user.county}
          onChange={(county) => change({ county }, t('Weather now shows {county}.', { county }))}
          placeholder={t('Choose your county')}
          options={(catalog?.counties ?? []).map((c) => ({ value: c.name, label: c.name }))}
        />
        <Button title={t('Use my exact location')} icon="locate" variant="secondary" onPress={useMyLocation} loading={busy === 'location'} />
        <Muted>{t('Your location is used only for the weather forecast.')}</Muted>
      </Card>

      <SectionTitle>{t('Your details')}</SectionTitle>
      <Card>
        <Field label={t('Your name')} value={name} onChangeText={setName} />
        <Muted style={{ marginBottom: 8 }}>{t('Phone: {phone}', { phone: `0${user.phone.slice(3)}` })}</Muted>
        <Button title={t('Save name')} variant="secondary" onPress={() => change({ name: name.trim() }, t('Saved.'))} loading={busy === 'profile'} disabled={name.trim().length < 2 || name.trim() === user.name} />
      </Card>

      <SectionTitle>{t('Change password')}</SectionTitle>
      <Card>
        <Field label={t('Current password')} value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label={t('New password')} value={next} onChangeText={setNext} secureTextEntry hint={t('At least 6 characters')} />
        <Button
          title={t('Change password')}
          variant="secondary"
          loading={busy === 'password'}
          disabled={!current || next.length < 6}
          onPress={() =>
            run('password', async () => {
              await api('/me/password', { method: 'POST', body: { current_password: current, new_password: next } });
              setCurrent('');
              setNext('');
              setSaved(t('Password changed.'));
            })
          }
        />
      </Card>

      <Button title={t('Sign out')} icon="log-out-outline" variant="secondary" onPress={() => signOut().catch((e) => notify(errorMessage(e)))} />

      <SectionTitle>{t('Delete account')}</SectionTitle>
      <Card>
        <Field label={t('Password')} value={deletePassword} onChangeText={setDeletePassword} secureTextEntry />
        <Button title={t('Delete my account')} variant="danger" onPress={removeAccount} loading={busy === 'delete'} disabled={!deletePassword} />
      </Card>
    </Screen>
  );
}
