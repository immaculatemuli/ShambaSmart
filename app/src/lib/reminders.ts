import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from './i18n';
import type { Task } from './types';

// Reminders on the phone itself for the coming farm tasks: a notification at 7 in the morning on the day each task
// is due. They are set again every time the home screen loads, so they follow the latest tasks. Not on the web.
const HOUR = 7;
const MAX = 30;
const TAG = 'shambasmart-task';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let asked = false;

async function allowed() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (asked) return false;
  asked = true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.content.data?.tag === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Nothing scheduled.
  }
}

export async function scheduleTaskReminders(tasks: Task[]) {
  if (Platform.OS === 'web') return;
  try {
    if (!(await allowed())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('farm', { name: t('Farm reminders'), importance: Notifications.AndroidImportance.DEFAULT });
    }
    await cancelReminders();
    const now = Date.now();
    // Tasks due the same day share one reminder.
    const byDay = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.done_at) continue;
      byDay.set(task.due_on, [...(byDay.get(task.due_on) ?? []), task]);
    }
    let count = 0;
    for (const [day, list] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
      const [y, m, d] = day.split('-').map(Number);
      const when = new Date(y, m - 1, d, HOUR, 0, 0);
      if (when.getTime() <= now || count >= MAX) continue;
      const first = list[0];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: list.length === 1 ? first.title : t('{n} farm tasks today', { n: list.length }),
          body: list.length === 1 ? (first.plot_name ?? t('Farm task today')) : list.map((x) => x.title).join(' · '),
          data: { tag: TAG, url: '/farm' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'farm' },
      });
      count += 1;
    }
  } catch {
    // Reminders are a help, not a must: the tasks are still on the farm screen.
  }
}
