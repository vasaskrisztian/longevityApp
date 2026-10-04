import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { getCreatorTeaser, RateLimitedError, type CreatorTeaser } from '@/src/api/publicCreators';
import { useSession } from '@/src/auth/useSession';
import { JoinCard, PublicLayout } from '@/src/components/PublicLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Public (signed-out) creator teaser at /creators/:id. Shows only what the
 * stripped teaser endpoint returns — name, join date and counts — and sells
 * the rest ("register to see protocols, challenges and results"). Signed-in
 * users are sent to the full in-app profile.
 */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return n === 1 ? singular : pluralForm;
}

export default function PublicCreatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useSession();
  const [teaser, setTeaser] = useState<CreatorTeaser | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signedIn' || !id) return;
    getCreatorTeaser(id)
      .then(setTeaser)
      .catch((e) =>
        setError(e instanceof RateLimitedError ? 'Too many requests — try again in a minute.' : 'Could not load this creator.'),
      );
  }, [id, status]);

  if (status === 'signedIn') return <Redirect href={`/profile/creators/${id}`} />;

  return (
    <PublicLayout>
      <Pressable onPress={() => router.navigate('/creators')} accessibilityRole="link">
        <Text style={styles.back}>‹ All creators</Text>
      </Pressable>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {teaser === undefined && !error ? <ActivityIndicator color={colors.primary.default} /> : null}

      {teaser === null ? (
        <Card style={styles.notFound}>
          <Text style={styles.name}>Creator not found</Text>
          <Text style={styles.muted}>This profile doesn’t exist or isn’t public.</Text>
        </Card>
      ) : null}

      {teaser ? (
        <>
          <Card style={styles.profile}>
            <Text style={styles.name}>{teaser.fullName ?? 'Creator'}</Text>
            <Text style={styles.muted}>Member since {new Date(teaser.memberSince).toLocaleDateString()}</Text>
            <View style={styles.stats}>
              <Stat value={teaser.followerCount} label={plural(teaser.followerCount, 'follower')} />
              <Stat value={teaser.publicProtocolCount} label={plural(teaser.publicProtocolCount, 'protocol')} />
              <Stat value={teaser.publicChallengeCount} label={plural(teaser.publicChallengeCount, 'challenge')} />
              <Stat value={teaser.trackedDays} label={`${plural(teaser.trackedDays, 'day')} tracked`} />
            </View>
          </Card>

          <JoinCard
            headline={`Unlock ${teaser.fullName ?? 'this creator'}’s full profile`}
            body="Create a free account to read their protocols, follow their challenges and see their recent sleep, activity and recovery."
          />
        </>
      ) : null}
    </PublicLayout>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fontFamily.sansSemibold, fontSize: 14, color: colors.primary.default },
  profile: { gap: 8 },
  notFound: { gap: 6 },
  name: { fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground },
  muted: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 8 },
  stat: { minWidth: 80 },
  statValue: { fontFamily: fontFamily.display, fontSize: 22, color: colors.foreground },
  statLabel: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
});
