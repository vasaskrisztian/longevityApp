import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '@/src/auth/useSession';
import { Button } from '@/src/components/ui/Button';
import { HubList } from '@/src/components/ui/HubRow';
import { colors, fontFamily } from '@/src/theme/tokens';

export default function MeScreen() {
  const { user, logout } = useSession();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      <HubList
        items={[
          { label: 'About me', description: 'Personal details, exercise, nutrition', icon: 'person-outline', onPress: () => router.push('/me/about') },
          { label: 'Devices and data', description: 'Oura, Apple Health and syncing', icon: 'watch-outline', onPress: () => router.push('/me/devices') },
          { label: 'Account', description: 'Sign-in, public profile', icon: 'settings-outline', onPress: () => router.push('/me/account') },
        ]}
      />
      <Button title="Log out" variant="destructive" onPress={() => logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  email: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.muted.foreground },
});
