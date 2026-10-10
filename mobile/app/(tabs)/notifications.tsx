import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { listNotifications, markNotificationsRead, type AppNotification } from '@/src/api/notifications';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { setUnreadCount } from '@/src/notifications/unreadStore';
import { colors, fontFamily } from '@/src/theme/tokens';
import { timeAgo } from '@/src/wellbeing/format';

const ICON: Record<AppNotification['type'], React.ComponentProps<typeof Ionicons>['name']> = {
  GROUP_INVITATION: 'mail-outline',
  GROUP_CHALLENGE_NEW: 'flag-outline',
  GROUP_CHALLENGE_SUMMARY: 'trophy-outline',
};

/**
 * The in-app notification inbox: group invitations, new group challenges and
 * end-of-challenge summaries. Opening a notification marks it read and takes
 * the person to the Wellbeing page, where invitations are accepted (with the
 * consent text) and challenges joined.
 */
export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listNotifications(50)
      .then((result) => {
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setError(null);
      })
      .catch(() => setError('Could not load your notifications.'));
  }, []);

  // Refresh whenever the tab gets focus, so a notification that arrived while
  // the person was elsewhere shows up without a manual reload.
  useFocusEffect(load);

  async function open(notification: AppNotification) {
    if (!notification.readAt) {
      setItems((current) =>
        current ? current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)) : current,
      );
      markNotificationsRead([notification.id])
        .then(() => listNotifications(1))
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => undefined);
    }
    router.push('/profile/wellbeing');
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await markNotificationsRead('all');
      setItems((current) => (current ? current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : current));
      setUnreadCount(0);
    } catch {
      setError('Could not mark the notifications as read.');
    } finally {
      setBusy(false);
    }
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 ? <Button title="Mark all as read" size="sm" variant="outline" loading={busy} onPress={markAllRead} /> : null}
      </View>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {items === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}

      {items && items.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            Nothing here yet. Group invitations, new group challenges and challenge results will show up in this list.
          </Text>
        </Card>
      ) : null}

      {items?.map((notification) => (
        <Pressable key={notification.id} onPress={() => open(notification)} accessibilityRole="button">
          <Card style={[styles.item, !notification.readAt && styles.itemUnread]}>
            <Ionicons name={ICON[notification.type]} size={22} color={notification.readAt ? colors.muted.foreground : colors.primary.default} />
            <View style={styles.itemText}>
              <View style={styles.itemTitleRow}>
                <Text style={[styles.itemTitle, !notification.readAt && styles.itemTitleUnread]}>{notification.title}</Text>
                {!notification.readAt ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
              </View>
              <Text style={styles.itemBody}>{notification.body}</Text>
              <Text style={styles.itemTime}>{timeAgo(notification.createdAt)}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: fontFamily.display, fontSize: 26, color: colors.foreground },
  centered: { paddingVertical: 24, alignItems: 'center' },
  empty: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground, lineHeight: 20 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  itemUnread: { borderColor: colors.primary.default },
  itemText: { flex: 1, gap: 4 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flexShrink: 1, fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.foreground },
  itemTitleUnread: { fontFamily: fontFamily.sansSemibold },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.default },
  itemBody: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground, lineHeight: 19 },
  itemTime: { fontFamily: fontFamily.sans, fontSize: 11, color: colors.muted.foreground },
});
