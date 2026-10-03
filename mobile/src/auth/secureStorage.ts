import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store wraps the iOS Keychain / Android Keystore and is
 * unimplemented on web (it throws) — react-native-web still needs
 * somewhere to put the refresh token when the Expo app runs in a browser,
 * so this falls back to plain localStorage there. That's a real security
 * trade-off (no OS-level encryption-at-rest on web), acceptable for now
 * since web is a development/preview target in this phase, not the
 * primary mobile distribution channel.
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = { getItem, setItem, deleteItem };
