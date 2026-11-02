import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DateField } from '@/components/DateField';
import { Picker } from '@/components/Picker';
import { Button, Chips, ErrorBox, Field, Muted, Notice, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { kes, todayIso } from '@/lib/format';
import { useT } from '@/lib/i18n';

const BAG_KG: Record<string, number> = { maize: 90, beans: 90, green_grams: 90, sorghum: 90, potatoes: 50 };

/** A price the farmer saw or sold at. Reports from the last two weeks become the market's price. */
export default function ReportPrice() {
  const { t } = useT();
  const params = useLocalSearchParams<{ crop?: string }>();
  const { catalog } = useCatalog();
  const [crop, setCrop] = useState(params.crop ?? 'maize');
  const [market, setMarket] = useState<string | null>(null);
  const [unit, setUnit] = useState<'kg' | 'bag'>('kg');
  const [price, setPrice] = useState('');
  const [day, setDay] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bag = BAG_KG[crop];
  const amount = Number(price.replace(/[, ]/g, ''));
  const perKg = unit === 'bag' && bag ? Math.round(amount / bag) : Math.round(amount);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/prices', { method: 'POST', body: { market_id: Number(market), crop, price_per_kg: perKg, observed_on: day } });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={t('Send price')} onPress={save} loading={busy} disabled={!market || !(perKg > 0)} />}>
      {error && <ErrorBox message={error} />}
      <Notice tone="info" icon="people">{t('Your report helps other farmers know what buyers pay. Only the price is shared, not your name.')}</Notice>
      <Chips
        label={t('Crop')}
        value={crop}
        onChange={(c) => {
          setCrop(c);
          if (!BAG_KG[c]) setUnit('kg');
        }}
        options={(catalog?.crops ?? []).map((c) => ({ value: c.key, label: c.name }))}
      />
      <Picker label={t('Market')} value={market} onChange={setMarket} placeholder={t('Choose a market')} options={(catalog?.markets ?? []).map((m) => ({ value: String(m.id), label: `${m.name} (${m.county})` }))} />
      {bag && (
        <Chips<'kg' | 'bag'>
          label={t('Price for')}
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'kg', label: t('1 kg') },
            { value: 'bag', label: t('a {kg} kg bag', { kg: bag }) },
          ]}
        />
      )}
      <Field label={t('Price in shillings')} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder={unit === 'bag' ? '4000' : '50'} />
      {unit === 'bag' && perKg > 0 && <Muted style={{ marginTop: -8, marginBottom: 12 }}>{t('That is {price} per kg.', { price: kes(perKg) })}</Muted>}
      <DateField label={t('Day you saw it')} value={day} onChange={setDay} max={todayIso()} />
    </Screen>
  );
}
