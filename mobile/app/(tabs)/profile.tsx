import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/src/auth/useSession';
import { colors, fontFamily } from '@/src/theme/tokens';

// Real screen content starts here (phase 16: auth) — the rest of Profile
// (onboarding, lifestyle, nutrition, supplements, goals, inbody,
// protocols, discover) is still phase 18.
export default function ProfileScreen() {
  const { user, logout } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      <Pressable style={styles.button} onPress={() => logout()}>
        <Text style={styles.buttonText}>Kijelentkezés</Text>
      </Pressable>
      <Text style={styles.note}>
        Phase 18-ban: onboarding, lifestyle, nutrition, supplements, goals, inbody, protocols, discover.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: colors.foreground,
  },
  email: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: colors.muted.foreground,
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.sansSemibold,
    fontSize: 14,
  },
  note: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
    textAlign: 'center',
    marginTop: 16,
  },
});
