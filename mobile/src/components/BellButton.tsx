import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { useUnreadCount } from '@/src/notifications/unreadStore';
import { colors, fontFamily } from '@/src/theme/tokens';

/** The notifications bell with its unread badge — in every header, replacing the old "Alerts" tab. */
export function BellButton() {
  const unread = useUnreadCount();
  // The desktop sidebar already has a Notifications entry with the same badge.
  if (useIsDesktop()) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={() => router.navigate('/notifications')}
      hitSlop={10}
      style={styles.button}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4, marginRight: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.sansSemibold, fontSize: 10, color: colors.accent.foreground },
});
