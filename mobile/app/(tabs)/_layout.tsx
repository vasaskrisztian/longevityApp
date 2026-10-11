import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceAutoSync } from '@/src/health/useDeviceAutoSync';
import { useNotificationPolling } from '@/src/notifications/useNotificationPolling';
import { useUnreadCount } from '@/src/notifications/unreadStore';
import { usePendingInvitations } from '@/src/wellbeing/pendingInvitationsStore';
import { usePendingInvitationsSync } from '@/src/wellbeing/usePendingInvitationsSync';

import { colors } from '@/src/theme/tokens';
import { useSession } from '@/src/auth/useSession';
import { getProfileBundle } from '@/src/api/profile';
import { DesktopShell } from '@/src/components/DesktopShell';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

// Four areas (see the UI review): Today (scores, trends, body), Plan
// (protocols, supplements, goals, my challenges), Community (groups,
// creators) and Me (about me, devices and data, account), plus Admin as a
// 5th tab shown only to role === 'ADMIN' — hidden from everyone else via
// `href: null` (expo-router's documented way to register a route without
// putting it in the tab bar) rather than filtering the children, so the
// route stays reachable even if something ever links to it directly.
// Notifications has no tab: the bell with its unread badge sits in every header.
export default function TabLayout() {
  // The actual sign-in gate: every route under (tabs) requires a session.
  // Root _layout.tsx's `ready` gate already waits out `status === 'loading'`
  // before anything in this tree mounts, so by the time this runs status is
  // settled one way or the other.
  const { status, user } = useSession();
  const isDesktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  useDeviceAutoSync(status === 'signedIn');
  useNotificationPolling(status === 'signedIn');
  const unread = useUnreadCount();
  usePendingInvitationsSync(status === 'signedIn', unread);
  const pendingInvitations = usePendingInvitations();

  // Mirrors requireOnboardedUserForPage (lib/auth/page-guards.ts): an
  // authenticated non-admin user who hasn't completed the onboarding wizard
  // is sent to /onboarding instead of seeing an empty dashboard/profile.
  // Admins are exempt, same as the web app. Fetched here rather than cached
  // globally — this is the one place that needs it, and it only runs once
  // per (tabs) mount (leaving /onboarding and coming back is a fresh mount).
  const [onboarding, setOnboarding] = useState<'loading' | 'incomplete' | 'complete'>(
    user?.role === 'ADMIN' ? 'complete' : 'loading',
  );

  useEffect(() => {
    if (status !== 'signedIn' || user?.role === 'ADMIN') return;
    let cancelled = false;
    getProfileBundle()
      .then((bundle) => {
        if (!cancelled) setOnboarding(bundle.onboardingCompletedAt ? 'complete' : 'incomplete');
      })
      .catch(() => {
        // Can't tell — fail open rather than trap the user in a redirect
        // loop if /api/profile is briefly unreachable; the dashboard's own
        // empty states already handle a user with no profile data yet.
        if (!cancelled) setOnboarding('complete');
      });
    return () => {
      cancelled = true;
    };
  }, [status, user?.role]);

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }
  if (onboarding === 'loading') {
    return null;
  }
  if (onboarding === 'incomplete') {
    return <Redirect href="/onboarding" />;
  }

  // Today and Notifications draw no native header (headerShown: false above),
  // so without this their first line sits under the iPhone's status
  // bar/camera cut-out. Plan, Community, Me and Admin are nested Stacks with
  // their own native header, which already handles the inset — they must NOT
  // get it twice. (On web and in the desktop shell the inset is 0.)
  const headerlessScene = { sceneStyle: { paddingTop: insets.top } };

  const tabs = (
    <Tabs
      // On a wide web window the bottom bar is replaced by DesktopShell's
      // sidebar (the navigator itself, routes and guards are identical).
      tabBar={isDesktop ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.default,
        tabBarInactiveTintColor: colors.muted.foreground,
        tabBarStyle: {
          backgroundColor: colors.card.default,
          borderTopColor: colors.card.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          ...headerlessScene,
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarBadge: pendingInvitations > 0 ? pendingInvitations : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
      {/* Notifications is reached from the bell in every header, not from the tab bar. */}
      <Tabs.Screen name="notifications" options={{ ...headerlessScene, title: 'Notifications', href: null }} />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: user?.role === 'ADMIN' ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );

  return isDesktop ? <DesktopShell>{tabs}</DesktopShell> : tabs;
}
