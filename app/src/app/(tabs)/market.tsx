import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Chips, colors, Empty, ErrorBox, ListRow, Loading, Muted, Notice, Screen, SectionTitle } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { kes, relativeDay, shortDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { CropPrices } from '@/lib/types';
import { useApi } from '@/lib/useApi';

// Grains and potatoes are sold by the bag, so their price is also shown per bag.
const BAG_KG: Record<string, number> = { maize: 90, beans: 90, green_grams: 90, sorghum: 90, potatoes: 50 };

export default function MarketScreen() {
  const { t } = useT();
  const { catalog } = useCatalog();
  const [crop, setCrop] = useState('maize');
  const prices = useApi<CropPrices>(`/prices/${crop}`);
  const data = prices.data?.crop === crop ? prices.data : null;
  const bag = BAG_KG[crop];
  const anySample = data?.prices.some((p) => p.source === 'sample');
  const trend = data?.trend.filter((w) => w.median_per_kg !== null) ?? [];
  const highest = Math.max(...trend.map((w) => w.median_per_kg ?? 0), 1);

  return (
    <Screen
      refreshing={prices.refreshing}
      onRefresh={prices.reload}
      footer={<Button title={t('Report a price I saw')} icon="megaphone" onPress={() => router.push({ pathname: '/price/report', params: { crop } })} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        <Chips value={crop} onChange={setCrop} options={(catalog?.crops ?? []).map((c) => ({ value: c.key, label: c.name }))} />
      </ScrollView>
      {prices.error && <ErrorBox message={prices.error} onRetry={prices.reload} />}
      {!data ? (
        prices.loading || !prices.error ? <Loading /> : null
      ) : (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Muted>{t('Typical price across markets')}</Muted>
            <Text style={s.big}>{data.median_per_kg ? `${kes(data.median_per_kg)}` : '–'}</Text>
            <Muted>
              {t('per kg')}
              {bag && data.median_per_kg ? ` · ${t('about {price} per {kg} kg bag', { price: kes(data.median_per_kg * bag), kg: bag })}` : ''}
            </Muted>
          </Card>

          {anySample && (
            <Notice tone="info" icon="information-circle">
              {t('Markets marked “Sample guide” show starting guide prices. They are replaced as farmers report what they saw at that market.')}
            </Notice>
          )}

          <SectionTitle>{t('By market, cheapest first')}</SectionTitle>
          <Card>
            {data.prices.length === 0 ? (
              <Empty text={t('No prices yet.')} />
            ) : (
              data.prices.map((p, i) => (
                <ListRow
                  key={p.market_id}
                  title={p.market}
                  subtitle={p.source === 'farmer' ? t(p.reports === 1 ? '1 farmer report · {when}' : '{n} farmer reports · {when}', { n: p.reports, when: relativeDay(p.updated_on) }) : p.county}
                  right={`${kes(p.price_per_kg)}`}
                  rightSub={p.source === 'sample' ? <Badge text={t('Sample guide')} /> : <Badge text={t('From farmers')} tone="success" />}
                  last={i === data.prices.length - 1}
                />
              ))
            )}
          </Card>

          <SectionTitle>{t('Farmer-reported price, last 8 weeks')}</SectionTitle>
          <Card>
            {trend.length === 0 ? (
              <Muted>{t('No farmer reports yet for this crop. Be the first: report a price you saw.')}</Muted>
            ) : (
              <View style={s.chart}>
                {data.trend.map((w) => (
                  <View key={w.week_ending} style={s.col} accessibilityLabel={`${shortDate(w.week_ending, false)}: ${w.median_per_kg ?? '–'}`}>
                    <Text style={s.colValue}>{w.median_per_kg ?? ''}</Text>
                    <View style={[s.bar, { height: w.median_per_kg ? 8 + (92 * w.median_per_kg) / highest : 2, opacity: w.median_per_kg ? 1 : 0.25 }]} />
                    <Text style={s.colLabel}>{shortDate(w.week_ending, false)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
          <Muted style={{ marginTop: 4 }}>{t('Prices are per kg in shillings. Check with buyers before you travel.')}</Muted>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  big: { fontSize: 32, fontWeight: '800', color: colors.primaryDark, marginVertical: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  colValue: { fontSize: 10, color: colors.muted, marginBottom: 2 },
  bar: { width: '70%', backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  colLabel: { fontSize: 9, color: colors.muted, marginTop: 4 },
});
