import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chips, colors, ErrorBox, Field, ListRow, Muted, Notice, Screen, SectionTitle, useSlow } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { relativeDay } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { choosePhoto, CropPhoto, takePhoto } from '@/lib/photo';
import type { Diagnosis } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function CheckScreen() {
  const { t } = useT();
  const { catalog, cropName } = useCatalog();
  const history = useApi<{ diagnoses: Diagnosis[] }>('/diagnoses');
  const [photo, setPhoto] = useState<CropPhoto | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlow(busy, 12_000);

  const pick = async (from: 'camera' | 'gallery') => {
    setError(null);
    try {
      const chosen = from === 'camera' ? await takePhoto() : await choosePhoto();
      if (chosen) setPhoto(chosen);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
    }
  };

  const check = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const done = await api<Diagnosis>('/diagnoses', {
        method: 'POST',
        body: { image: photo.base64, media_type: 'image/jpeg', crop, note: note.trim() || null },
        timeoutMs: 150_000,
      });
      setPhoto(null);
      setNote('');
      router.push(`/diagnosis/${done.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen refreshing={history.refreshing} onRefresh={history.reload}>
      <Muted style={{ marginBottom: 12 }}>
        {t('Take a close, clear photo of the sick leaf, stem or fruit in daylight. ShambaSmart says what it may be and what to do.')}
      </Muted>
      {error && <ErrorBox message={error} />}

      {photo ? (
        <Card>
          <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" accessibilityLabel={t('Your photo')} />
          <Pressable onPress={() => setPhoto(null)} hitSlop={8} disabled={busy}>
            <Text style={s.link}>{t('Use a different photo')}</Text>
          </Pressable>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('Take photo')} icon="camera" onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('Gallery')} icon="images" variant="secondary" onPress={() => pick('gallery')} />
          </View>
        </View>
      )}

      {photo && (
        <>
          <Chips<string | null>
            label={t('Which crop is it?')}
            value={crop}
            onChange={setCrop}
            options={[{ value: null, label: t('Not sure') }, ...(catalog?.crops ?? []).map((c) => ({ value: c.key, label: c.name }))]}
          />
          <Field label={t('What have you noticed? (optional)')} value={note} onChangeText={setNote} placeholder={t('e.g. yellow spots spreading for a week')} multiline />
          <Button title={busy ? t('Checking the photo…') : t('Check this photo')} icon="search" onPress={check} loading={busy} />
          {slow && <Notice tone="info">{t('Still checking… this can take up to a minute on a slow network.')}</Notice>}
        </>
      )}

      {(history.data?.diagnoses.length ?? 0) > 0 && (
        <>
          <SectionTitle>{t('Earlier checks')}</SectionTitle>
          <Card>
            {history.data!.diagnoses.map((d, i, list) => {
              const r = d.result;
              const what = !r.is_plant ? t('Not a crop photo') : r.healthy ? t('Looks healthy') : (r.problems[0]?.name ?? t('Needs attention'));
              return (
                <ListRow
                  key={d.id}
                  title={what}
                  subtitle={[r.crop || cropName(d.crop), relativeDay(d.created_at)].filter(Boolean).join(' · ')}
                  icon={r.healthy ? 'checkmark-circle' : 'alert-circle'}
                  iconColor={r.healthy ? colors.primary : colors.warning}
                  onPress={() => router.push(`/diagnosis/${d.id}`)}
                  last={i === list.length - 1}
                />
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: '#E5E7EB' },
  link: { color: colors.primary, fontWeight: '600', marginTop: 10, textAlign: 'center' },
});
