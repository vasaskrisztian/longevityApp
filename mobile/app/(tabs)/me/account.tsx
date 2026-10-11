import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { getPublicProfileStatus, setPublicProfileConsent, type PublicProfileStatus } from '@/src/api/creators';
import { useSession } from '@/src/auth/useSession';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Me > Account: who you are signed in as, the creator public-profile switch
 * (only for accounts the admin has granted CREATOR status — mirrors the web
 * app's creator-consent-toggle.tsx) and Log out. Password change, data sharing
 * overview and account deletion arrive with the account-functions step.
 */
export default function AccountScreen() {
  const { user, logout } = useSession();
  const [publicProfileStatus, setPublicProfileStatus] = useState<PublicProfileStatus | null>(null);
  const [togglingConsent, setTogglingConsent] = useState(false);

  useEffect(() => {
    getPublicProfileStatus()
      .then(setPublicProfileStatus)
      .catch(() => setPublicProfileStatus(null));
  }, []);

  async function handleToggleConsent() {
    if (!publicProfileStatus) return;
    setTogglingConsent(true);
    const nextConsent = !publicProfileStatus.canPublish;
    try {
      await setPublicProfileConsent(nextConsent);
      setPublicProfileStatus({ ...publicProfileStatus, canPublish: nextConsent });
    } finally {
      setTogglingConsent(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Signed in as</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </Card>

      {publicProfileStatus?.accountType === 'CREATOR' ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Creator public profile</Text>
          <Text style={styles.description}>
            {publicProfileStatus.canPublish
              ? 'Your public protocols, challenges, and recent data are visible to anyone in the Creators directory.'
              : 'Turn this on to let followers see your public protocols, challenges, and recent data in the Creators directory.'}
          </Text>
          <Button
            title={togglingConsent ? 'Updating…' : publicProfileStatus.canPublish ? 'Make profile private' : 'Publish profile publicly'}
            variant={publicProfileStatus.canPublish ? 'outline' : 'primary'}
            size="sm"
            onPress={handleToggleConsent}
            loading={togglingConsent}
          />
        </Card>
      ) : null}

      <Button title="Log out" variant="destructive" onPress={() => logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  card: { gap: 10 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 17, color: colors.foreground },
  description: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
  email: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground },
});
