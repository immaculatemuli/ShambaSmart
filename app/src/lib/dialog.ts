import { Alert, Platform } from 'react-native';
import { t } from './i18n';

// Messages and yes/no questions that work on phones (Alert) and in the browser (alert/confirm).

export function notify(message: string, title?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(title ? `${title}\n\n${message}` : message);
  else Alert.alert(title ?? '', message);
}

export function confirm(message: string, yes: string, { destructive = false } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(message) ?? false);
  return new Promise((resolve) =>
    Alert.alert('', message, [
      { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}
