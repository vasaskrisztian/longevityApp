import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSession } from '@/src/auth/useSession';
import { colors, fontFamily, radii } from '@/src/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  label: string;
  href: Href;
  /** Path prefix used for the active highlight ('/' only matches exactly). */
  match: string;
  icon: IconName;
}

const BASE_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', match: '/', icon: 'speedometer-outline' },
  { label: 'Trends', href: '/trends', match: '/trends', icon: 'trending-up-outline' },
  { label: 'Profile', href: '/profile', match: '/profile', icon: 'person-outline' },
  { label: 'Devices', href: '/devices', match: '/devices', icon: 'watch-outline' },
];
const ADMIN_ITEM: NavItem = { label: 'Admin', href: '/admin', match: '/admin', icon: 'shield-checkmark-outline' };

/** Max width of the content column — keeps forms and cards readable on a
 * wide monitor instead of stretching edge to edge. */
const CONTENT_MAX_WIDTH = 960;
const SIDEBAR_WIDTH = 232;

/**
 * Desktop layout for the web build: a fixed left sidebar (the same
 * top-level groups as the phone tab bar and the old Next.js sidebar) next to
 * a centered, width-capped content column. The phone layout in
 * (tabs)/_layout.tsx is untouched — this only wraps it when the window is
 * wide (see useIsDesktop).
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useSession();
  const items = user?.role === 'ADMIN' ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <Text style={styles.brand}>Longevity Klub</Text>
        <View style={styles.nav}>
          {items.map((item) => {
            const active = item.match === '/' ? pathname === '/' : pathname.startsWith(item.match);
            return (
              <Pressable
                key={item.label}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(item.href)}
                style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}
              >
                <Ionicons name={item.icon} size={20} color={active ? colors.primary.default : colors.muted.foreground} />
                <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.footer}>
          {user?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => logout()} style={styles.logout}>
            <Ionicons name="log-out-outline" size={18} color={colors.muted.foreground} />
            <Text style={styles.logoutLabel}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.contentOuter}>
        <View style={styles.contentInner}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.card.default,
    borderRightWidth: 1,
    borderRightColor: colors.card.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  brand: { fontFamily: fontFamily.display, fontSize: 22, color: colors.foreground, paddingHorizontal: 8, marginBottom: 24 },
  nav: { gap: 4, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.xl },
  itemActive: { backgroundColor: colors.muted.default },
  itemPressed: { opacity: 0.7 },
  itemLabel: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.muted.foreground },
  itemLabelActive: { color: colors.primary.default },
  footer: { gap: 8, paddingHorizontal: 8 },
  email: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  logoutLabel: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.muted.foreground },
  contentOuter: { flex: 1, alignItems: 'center' },
  contentInner: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
});
