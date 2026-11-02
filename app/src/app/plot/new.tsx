import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Button, Card, Chips, colors, ErrorBox, Field, Muted, Notice, Screen, SectionTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { monthName, shortDate, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useApi } from '@/lib/useApi';

interface Preview {
  steps: { day: number; kind: string; title: string; details: string; due_on: string }[];
}

export default function NewPlot() {
  const { t } = useT();
  const { catalog } = useCatalog();
  const [crop, setCrop] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [variety, setVariety] = useState('');
  const [plantedOn, setPlantedOn] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = catalog?.crops.find((c) => c.key === crop);
  const preview = useApi<Preview>(crop ? `/crops/${crop}/calendar?planted_on=${plantedOn}` : null);

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const acres = Number(size.replace(',', '.'));
      const { id } = await api<{ id: number }>('/plots', {
        method: 'POST',
        body: {
          name: name.trim() || chosen.name,
          crop: chosen.key,
          variety: variety.trim() || null,
          size_acres: size && acres > 0 ? acres : null,
          planted_on: plantedOn,
        },
      });
      router.replace(`/plot/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={t('Save plot and its calendar')} onPress={save} loading={busy} disabled={!chosen} />}>
      {error && <ErrorBox message={error} />}
      <Chips<string | null>
        label={t('What are you planting?')}
        value={crop}
        onChange={setCrop}
        options={(catalog?.crops ?? []).map((c) => ({ value: c.key, label: c.in_season ? `${c.name} ★` : c.name }))}
      />
      <Muted style={{ marginTop: -6, marginBottom: 12 }}>{t('★ = usually planted this month')}</Muted>

      {chosen && (
        <>
          <Card>
            <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>
              {t('{crop}: about {days} days to harvest. Spacing {spacing}.', { crop: chosen.name, days: chosen.days, spacing: chosen.spacing })}
            </Text>
            <Muted>
              {t('Usual planting months: {months}', { months: chosen.seasons.map(monthName).join(', ') })}
              {chosen.irrigated ? ` · ${t('any time with irrigation')}` : ''}
            </Muted>
          </Card>
          <Field label={t('Plot name')} value={name} onChangeText={setName} placeholder={t('e.g. Lower field, near the river')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t('Size in acres (optional)')} value={size} onChangeText={setSize} keyboardType="decimal-pad" placeholder="0.5" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Variety (optional)')} value={variety} onChangeText={setVariety} placeholder="H614, Rosecoco…" />
            </View>
          </View>
          <DateField label={chosen.nursery ? t('Transplanting day') : t('Planting day')} value={plantedOn} onChange={setPlantedOn} />
          {chosen.nursery && <Notice tone="info" icon="flower">{t('This crop starts in a nursery. The calendar includes sowing the nursery before transplanting.')}</Notice>}

          <SectionTitle>{t('Your crop calendar')}</SectionTitle>
          <Card>
            {(preview.data?.steps ?? []).map((step, i, all) => {
              const past = step.due_on < todayIso();
              return (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: i === all.length - 1 ? 0 : 0.5, borderBottomColor: colors.border, opacity: past ? 0.5 : 1 }}>
                  <Text style={{ width: 86, color: colors.primaryDark, fontWeight: '600' }}>{shortDate(step.due_on)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{step.title}</Text>
                    <Muted>{step.details}</Muted>
                  </View>
                </View>
              );
            })}
          </Card>
          <Muted>{t('Steps already well past are left out. You can tick, move or delete any step later, and add your own.')}</Muted>
        </>
      )}
    </Screen>
  );
}
