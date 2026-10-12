import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { BellButton } from '@/src/components/BellButton';
import { colors, fontFamily } from '@/src/theme/tokens';

/** Header look shared by the Plan / Community / Me / Admin stacks (bell with badge on the right). */
export const mainStackScreenOptions: NativeStackNavigationOptions = {
  // Transparent on the web so the backdrop behind the content area runs up to the top edge.
  headerStyle: { backgroundColor: Platform.OS === 'web' ? 'transparent' : colors.card.default },
  headerTintColor: colors.foreground,
  headerTitleStyle: { fontFamily: fontFamily.sansSemibold },
  headerShadowVisible: false,
  headerRight: () => <BellButton />,
};
