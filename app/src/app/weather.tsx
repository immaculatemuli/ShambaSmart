import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AlertCard } from '@/components/farm';
import { Button, Card, colors, ErrorBox, IconName, Loading, Muted, Notice, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { relativeDay, shortDate, weatherLook } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Weather } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function WeatherScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const hasPlace = user?.latitude != null;
  const weather = useApi<Weather>(hasPlace ? '/weather' : null);

  if (!hasPlace) {
    return (
      <Screen>
        <Notice tone="info" icon="location">{t('Choose your county to get weather alerts and planting reminders for your area.')}</Notice>
        <Button title={t('Set my location')} onPress={() => router.push('/account')} />
      </Screen>
    );
  }
  if (weather.loading) return <Loading />;
  if (!weather.data) return <Screen><ErrorBox message={weather.error ?? ''} onRetry={weather.reload} /></Screen>;
  const { days, alerts } = weather.data;

  return (
    <Screen refreshing={weather.refreshing} onRefresh={weather.reload}>
      <Muted style={{ marginBottom: 8 }}>{user?.county ? t('Forecast for {county}', { county: user.county }) : t('Forecast for your farm')}</Muted>
      <SectionTitle>{t('Alerts and advice')}</SectionTitle>
      {alerts.length === 0 ? <Notice tone="success" icon="checkmark-circle">{t('No weather warnings this week.')}</Notice> : alerts.map((a) => <AlertCard key={a.id} alert={a} />)}

      <SectionTitle>{t('Next 7 days')}</SectionTitle>
      <Card>
        {days.map((d, i) => {
          const look = weatherLook(d.code);
          return (
            <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i === days.length - 1 ? 0 : 0.5, borderBottomColor: colors.border }}>
              <View style={{ width: 96 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{relativeDay(d.date)}</Text>
                <Muted>{shortDate(d.date, false)}</Muted>
              </View>
              <Ionicons name={look.icon as IconName} size={28} color={d.rain_mm >= 2 ? colors.info : colors.soil} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{look.label}</Text>
                <Muted>
                  {t('Rain {mm} mm', { mm: Math.round(d.rain_mm) })}
                  {d.rain_chance !== null ? ` (${d.rain_chance}%)` : ''} · {t('wind {n} km/h', { n: Math.round(d.wind_kmh) })}
                </Muted>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {Math.round(d.temp_max)}° <Text style={{ color: colors.muted, fontWeight: '400' }}>{Math.round(d.temp_min)}°</Text>
              </Text>
            </View>
          );
        })}
      </Card>
      <Muted>{t('Forecast from {source}, updated every hour.', { source: weather.data.source === 'met-norway' ? 'MET Norway (yr.no)' : 'Open-Meteo' })}</Muted>
    </Screen>
  );
}
