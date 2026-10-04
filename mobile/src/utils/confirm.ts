import { Alert, Platform } from 'react-native';

/**
 * Cross-platform "are you sure?" prompt for destructive actions.
 *
 * `Alert.alert` with buttons is a no-op on react-native-web (nothing is
 * shown and no callback ever fires), so on web this falls back to the
 * browser's own `window.confirm` — same as the web app's own delete
 * buttons use. On native it shows the OS alert with a destructive-styled
 * confirm button. Resolves `true` only when the user explicitly confirms.
 */
export function confirmDestructive(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as { confirm?: (text?: string) => boolean }).confirm;
    return Promise.resolve(confirmFn ? confirmFn(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
