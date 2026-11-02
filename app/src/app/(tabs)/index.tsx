import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { AlertCard, ForecastStrip, PlotCard, TaskRow } from '@/components/farm';
import { MoneyStats } from '@/components/MoneyBreakdown';
import { Button, Card, colors, Empty, ErrorBox, IconName, Loading, Muted, Notice, QuickAction, Screen, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, todayIso, weatherLook } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { scheduleTaskReminders } from '@/lib/reminders';
import type { MoneySummary, Plot, Task, User, Weather } from '@/lib/types';
import { useApi } from '@/lib/useApi';

interface Home {
  today: string;
  user: User;
  weather: Weather | null;
  weather_error: string | null;
  tasks: Task[];
  plots: Plot[];
  month: MoneySummary;
}

const MAX_TASKS = 6;
const MAX_ALERTS = 3;

export default function HomeScreen() {
  const { t } = useT();
  const home = useApi<Home>('/home');
  const data = home.data;

  // Phone reminders for the coming month's tasks, refreshed whenever home loads.
  useEffect(() => {
    if (!data) return;
    api<{ tasks: Task[] }>(`/tasks?status=open&to=${addDays(todayIso(), 30)}`)
      .then(({ tasks }) => scheduleTaskReminders(tasks))
      .catch(() => {});
  }, [data]);

  if (home.loading) return <Loading />;
  if (!data) return <Screen><ErrorBox message={home.error ?? ''} onRetry={home.reload} /></Screen>;

  const firstName = data.user.name.split(' ')[0];
  const weather = data.weather;
  const now = weather?.current ? weatherLook(weather.current.code) : null;

  return (
    <Screen refreshing={home.refreshing} onRefresh={home.reload}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 2 }}>{t('Hello, {name}', { name: firstName })}</Text>
      <Muted style={{ marginBottom: 14 }}>{data.user.county ? t('Farming in {county}', { county: data.user.county }) : t('Welcome to ShambaSmart')}</Muted>
      {home.error && <ErrorBox message={home.error} onRetry={home.reload} />}

      {weather ? (
        <Card onPress={() => router.push('/weather')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            {now && <Ionicons name={now.icon as IconName} size={40} color={colors.soil} style={{ marginRight: 12 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{weather.current ? `${Math.round(weather.current.temperature)}°C` : ''}</Text>
              <Muted>{now?.label}</Muted>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('7-day forecast')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
          <ForecastStrip days={weather.days} />
        </Card>
      ) : data.user.latitude == null ? (
        <Card onPress={() => router.push('/account')}>
          <Notice tone="info" icon="location">
            {t('Choose your county to get weather alerts and planting reminders for your area.')}
          </Notice>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('Set my location')}</Text>
        </Card>
      ) : (
        <Notice icon="cloud-offline">{t('The weather forecast is not available right now. Please try again later')}</Notice>
      )}

      {weather && weather.alerts.length > 0 && (
        <>
          <SectionTitle action={weather.alerts.length > MAX_ALERTS ? { label: t('See all'), onPress: () => router.push('/weather') } : undefined}>
            {t('Alerts')}
          </SectionTitle>
          {weather.alerts.slice(0, MAX_ALERTS).map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </>
      )}

      <Card style={{ flexDirection: 'row', paddingVertical: 12 }}>
        <QuickAction icon="add-circle" label={t('Add a plot')} onPress={() => router.push('/plot/new')} />
        <QuickAction icon="camera" label={t('Check a crop')} onPress={() => router.push('/check')} />
        <QuickAction icon="receipt" label={t('Add an expense')} onPress={() => router.push('/expense/new')} />
        <QuickAction icon="basket" label={t('Add a harvest')} onPress={() => router.push('/harvest/new')} />
      </Card>

      <SectionTitle action={{ label: t('See all'), onPress: () => router.push('/farm') }}>{t('This week on the farm')}</SectionTitle>
      <Card>
        {data.tasks.length === 0 ? (
          <Empty icon="checkmark-done" text={data.plots.length ? t('Nothing due this week.') : t('Add a plot and ShambaSmart lays out the season’s work for you.')} />
        ) : (
          data.tasks.slice(0, MAX_TASKS).map((task) => <TaskRow key={task.id} task={task} onChanged={home.reload} />)
        )}
        {data.tasks.length > MAX_TASKS && <Muted style={{ marginTop: 8 }}>{t('{n} more on the Farm tab', { n: data.tasks.length - MAX_TASKS })}</Muted>}
      </Card>

      <SectionTitle>{t('Growing now')}</SectionTitle>
      {data.plots.length === 0 ? (
        <Button title={t('Add your first plot')} icon="add" onPress={() => router.push('/plot/new')} />
      ) : (
        data.plots.map((p) => <PlotCard key={p.id} plot={p} />)
      )}

      <SectionTitle action={{ label: t('Records'), onPress: () => router.push('/records') }}>{t('This month')}</SectionTitle>
      <MoneyStats money={data.month} />
    </Screen>
  );
}
