import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Small saved values (the sign-in, the language). On the phone: encrypted secure storage. On the web: the browser's
// localStorage (secure storage does not exist there). Failures are quiet: the app then just asks again.
const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  try {
    return web ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string) {
  try {
    if (web) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Not saved: nothing else to do.
  }
}

export async function removeItem(key: string) {
  try {
    if (web) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone.
  }
}
