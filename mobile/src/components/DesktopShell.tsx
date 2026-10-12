import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSession } from '@/src/auth/useSession';
import { useUnreadCount } from '@/src/notifications/unreadStore';
import { usePendingInvitations } from '@/src/wellbeing/pendingInvitationsStore';
import { AppBackdrop } from '@/src/components/AppBackdrop';
import { BrandGradient } from '@/src/components/ui/BrandGradient';
import { isHovered } from '@/src/components/ui/hover';
import { colors, fontFamily, gradients, radii, shadows, tints } from '@/src/theme/tokens';

// The seal, as generated for the app icon (square, cream corners): shown as a
// circle with the same green glow the old web sidebar gave it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SEAL = require('../../assets/images/icon.png');

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  label: string;
  href: Href;
  /** Path prefix used for the active highlight ('/' only matches exactly). */
  match: string;
  icon: IconName;
}

const BASE_ITEMS: NavItem[] = [
  { label: 'Today', href: '/', match: '/', icon: 'sunny-outline' },
  { label: 'Plan', href: '/plan', match: '/plan', icon: 'clipboard-outline' },
  { label: 'Community', href: '/community', match: '/community', icon: 'people-outline' },
  { label: 'Me', href: '/me', match: '/me', icon: 'person-circle-outline' },
  { label: 'Notifications', href: '/notifications', match: '/notifications', icon: 'notifications-outline' },
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
  const unread = useUnreadCount();
  const pendingInvitations = usePendingInvitations();
  const items = user?.role === 'ADMIN' ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <BrandGradient colors={gradients.sidebar} direction="vertical" />
        <View style={styles.brandRow}>
          <View style={styles.sealWrap}>
            <Image source={SEAL} style={styles.seal} alt="Longevity Klub" />
          </View>
          <View>
            <Text style={styles.brandTop}>Longevity</Text>
            <Text style={styles.brandKlub}>KLUB</Text>
          </View>
        </View>
        <View style={styles.nav}>
          {items.map((item) => {
            const active = item.match === '/' ? pathname === '/' : pathname.startsWith(item.match);
            return (
              <Pressable
                key={item.label}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(item.href)}
                style={(state) => [
                  styles.item,
                  active && styles.itemActive,
                  !active && isHovered(state) && styles.itemHover,
                  state.pressed && styles.itemPressed,
                ]}
              >
                {active ? (
                  <View style={styles.itemClip}>
                    <BrandGradient colors={gradients.active} />
                  </View>
                ) : null}
                <Ionicons name={item.icon} size={20} color={active ? colors.accent.light : colors.muted.foreground} />
                <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
                {item.match === '/notifications' && unread > 0 ? (
                  <View style={styles.badge} accessibilityLabel={`${unread} unread`}>
                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
                {item.match === '/community' && pendingInvitations > 0 ? (
                  <View style={styles.badge} accessibilityLabel={`${pendingInvitations} pending invitations`}>
                    <Text style={styles.badgeText}>{pendingInvitations}</Text>
                  </View>
                ) : null}
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
        <AppBackdrop />
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, marginBottom: 28 },
  sealWrap: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FBF8F0', ...shadows.glow },
  // 112%: crops the white corners of the square icon so only the seal shows.
  seal: { width: '112%', height: '112%', marginLeft: '-6%', marginTop: '-6%' },
  brandTop: { fontFamily: fontFamily.display, fontSize: 17, color: colors.primary.default },
  brandKlub: { fontFamily: fontFamily.display, fontSize: 14, color: colors.accent.default, letterSpacing: 3.2 },
  nav: { gap: 6, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.xl },
  // The selected entry: green gradient pill + glow (gradient sits in itemClip).
  itemActive: { ...shadows.glow },
  itemClip: { ...StyleSheet.absoluteFillObject, borderRadius: radii.xl, overflow: 'hidden' },
  itemHover: { backgroundColor: tints.gold },
  itemPressed: { opacity: 0.8 },
  itemLabel: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.muted.foreground },
  itemLabelActive: { color: colors.primary.foreground, fontFamily: fontFamily.sansSemibold },
  badge: { marginLeft: 'auto', minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.accent.default, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fontFamily.sansSemibold, fontSize: 11, color: colors.accent.foreground },
  footer: { gap: 8, paddingHorizontal: 8 },
  email: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  logoutLabel: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.muted.foreground },
  contentOuter: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  contentInner: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
});
