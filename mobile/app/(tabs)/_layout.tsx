import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppleHealthAutoSync } from '@/src/health/useAppleHealthAutoSync';

import { colors } from '@/src/theme/tokens';
import { useSession } from '@/src/auth/useSession';
import { getProfileBundle } from '@/src/api/profile';
import { DesktopShell } from '@/src/components/DesktopShell';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

// Mirrors the web app's sidebar nav (Dashboard/Trends/Profile/Devices —
// see ARCHITECTURE.md §2 repository structure / phase-1-summary.md's "Base
// UI shell"), plus Admin (phase 22): a 5th tab shown only to role === 'ADMIN',
// hidden from everyone else via `href: null` (expo-router's documented way
// to register a route without putting it in the tab bar — see
// node_modules/expo-router/build/layouts/Tabs.d.ts) rather than filtering
// the <Tabs.Screen> children array, so the route stays reachable even if
// something ever links to it directly. Lifestyle/Nutrition/Supplements/
// Goals live inside the Profile stack rather than as top-level tabs, same
// as the web sidebar groups them under Profile.
export default function TabLayout() {
  // The actual sign-in gate: every route under (tabs) requires a session.
  // Root _layout.tsx's `ready` gate already waits out `status === 'loading'`
  // before anything in this tree mounts, so by the time this runs status is
  // settled one way or the other.
  const { status, user } = useSession();
  const isDesktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  useAppleHealthAutoSync(status === 'signedIn');

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

  // Dashboard/Trends/Devices draw no native header (headerShown: false above),
  // so without this their first line sits under the iPhone's status
  // bar/camera cut-out. Profile and Admin are nested Stacks with their own
  // native header, which already handles the inset — they must NOT get it
  // twice. (On web and in the desktop shell the inset is 0.)
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          ...headerlessScene,
          title: 'Trends',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          ...headerlessScene,
          title: 'Devices',
          tabBarIcon: ({ color, size }) => <Ionicons name="watch-outline" size={size} color={color} />,
        }}
      />
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
