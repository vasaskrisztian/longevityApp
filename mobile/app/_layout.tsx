import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { colors } from '@/src/theme/tokens';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Longevity Klub brand theme (forest green primary, warm gold accent —
// see src/theme/tokens.ts, ported from the web app's tailwind.config.ts).
// Dark mode is deliberately out of scope for phase 15 (the web app's
// `darkMode: ['class']` toggle hasn't been ported yet) — single light
// theme for now, revisit when a screen actually needs it.
const brandTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary.default,
    background: colors.background,
    card: colors.card.default,
    text: colors.foreground,
    border: colors.card.border,
    notification: colors.danger,
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Fraunces_600SemiBold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={brandTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
