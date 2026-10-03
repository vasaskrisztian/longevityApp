import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/src/theme/tokens';
import { useSession } from '@/src/auth/useSession';

// Mirrors the web app's sidebar nav (Dashboard/Trends/Profile/Devices —
// see ARCHITECTURE.md §2 repository structure / phase-1-summary.md's "Base
// UI shell"). Admin is intentionally not a tab yet — it's gated behind the
// ADMIN role and will be added in phase 22 once role-aware auth (phase 16)
// exists; Lifestyle/Nutrition/Supplements/Goals live inside the Profile
// stack rather than as top-level tabs, same as the web sidebar groups them
// under Profile.
export default function TabLayout() {
  // The actual sign-in gate: every route under (tabs) requires a session.
  // Root _layout.tsx's `ready` gate already waits out `status === 'loading'`
  // before anything in this tree mounts, so by the time this runs status is
  // settled one way or the other.
  const { status } = useSession();
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
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
          title: 'Devices',
          tabBarIcon: ({ color, size }) => <Ionicons name="watch-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
