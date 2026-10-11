import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { BellButton } from '@/src/components/BellButton';
import { colors, fontFamily } from '@/src/theme/tokens';

/** Header look shared by the Plan / Community / Me / Admin stacks (bell with badge on the right). */
export const mainStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.card.default },
  headerTintColor: colors.foreground,
  headerTitleStyle: { fontFamily: fontFamily.sansSemibold },
  headerShadowVisible: false,
  headerRight: () => <BellButton />,
};
