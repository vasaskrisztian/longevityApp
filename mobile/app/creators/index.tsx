import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import type { CreatorDirectoryItem } from '@/src/api/creators';
import { getPublicCreatorDirectory } from '@/src/api/publicCreators';
import { useSession } from '@/src/auth/useSession';
import { JoinCard, PublicLayout } from '@/src/components/PublicLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Public (signed-out) creators directory at /creators — the same URL the
 * web app serves. Only names and counts; everything behind them requires
 * an account. Signed-in users are sent to the full in-app directory.
 */

function Row({ creator }: { creator: CreatorDirectoryItem }) {
  return (
    <Pressable onPress={() => router.push(`/creators/${creator.id}`)} accessibilityRole="link">
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{creator.fullName ?? 'Creator'}</Text>
          <Text style={styles.rowSubtitle}>
            Member since {new Date(creator.memberSince).toLocaleDateString()} · {creator.followerCount} follower
            {creator.followerCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.rowSubtitle}>
            {creator.publicProtocolCount} protocol{creator.publicProtocolCount === 1 ? '' : 's'} ·{' '}
            {creator.publicChallengeCount} challenge{creator.publicChallengeCount === 1 ? '' : 's'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
      </Card>
    </Pressable>
  );
}

export default function PublicCreatorsScreen() {
  const { status } = useSession();
  const [creators, setCreators] = useState<CreatorDirectoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signedIn') return;
    getPublicCreatorDirectory()
      .then(setCreators)
      .catch(() => setError('Could not load the creators directory.'));
  }, [status]);

  if (status === 'signedIn') return <Redirect href="/profile/creators" />;

  return (
    <PublicLayout>
      <View style={styles.intro}>
        <Text style={styles.heading}>Creators</Text>
        <Text style={styles.lede}>Meet the people sharing how they train, sleep and recover.</Text>
      </View>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {!creators && !error ? <ActivityIndicator color={colors.primary.default} /> : null}
      {creators?.length === 0 ? <Text style={styles.empty}>No creators are publishing publicly yet.</Text> : null}
      {creators?.map((creator) => <Row key={creator.id} creator={creator} />)}

      <JoinCard
        headline="See what they actually do"
        body="Create a free account to read their protocols, follow their challenges and track your own progress alongside them."
      />
    </PublicLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4 },
  heading: { fontFamily: fontFamily.display, fontSize: 26, color: colors.foreground },
  lede: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 15, color: colors.foreground },
  rowSubtitle: { marginTop: 2, fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  empty: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
});
