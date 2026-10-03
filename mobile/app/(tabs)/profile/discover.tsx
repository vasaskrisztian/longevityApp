import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { getMyFollowing, unfollowCreator, type FollowedCreatorSummary } from '@/src/api/creators';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Mirrors the web app's profile/discover/page.tsx — the creators the
 * current user follows, each with an Unfollow action, plus a link into the
 * Creators directory. Phase 20 (see claude/phase-15-mobile-migration-plan.md):
 * unlike the web app, mobile gates EVERYTHING behind login (the tab layout
 * redirects a signed-out session to /login), so the directory/profile
 * screens this links to are plain authed screens in this same Profile
 * stack — not the web's deliberately public, logged-out-reachable /creators.
 */

function FollowingRow({
  creator,
  onUnfollowed,
}: {
  creator: FollowedCreatorSummary;
  onUnfollowed: () => void;
}) {
  const [unfollowing, setUnfollowing] = useState(false);

  async function handleUnfollow() {
    setUnfollowing(true);
    try {
      await unfollowCreator(creator.id);
      onUnfollowed();
    } catch {
      setUnfollowing(false);
    }
  }

  return (
    <Card style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{creator.fullName ?? 'Creator'}</Text>
        <Text style={styles.rowSubtitle}>
          Following since {new Date(creator.followedAt).toLocaleDateString()} ·{' '}
          {creator.publicProtocolCount} protocol{creator.publicProtocolCount === 1 ? '' : 's'} ·{' '}
          {creator.publicChallengeCount} challenge{creator.publicChallengeCount === 1 ? '' : 's'}
        </Text>
      </View>
      <Button
        title={unfollowing ? 'Unfollowing…' : 'Unfollow'}
        variant="outline"
        size="sm"
        onPress={handleUnfollow}
        loading={unfollowing}
      />
    </Card>
  );
}

export default function DiscoverScreen() {
  const [following, setFollowing] = useState<FollowedCreatorSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      setFollowing(await getMyFollowing());
    } catch {
      setError('Could not load who you follow.');
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (!following) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <Button
        title="Browse all creators"
        variant="outline"
        size="sm"
        onPress={() => router.push('/profile/creators')}
      />

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {following.length === 0 ? (
        <Text style={styles.empty}>
          You&apos;re not following anyone yet. Browse creators above to find someone to follow.
        </Text>
      ) : (
        following.map((creator) => (
          <FollowingRow
            key={creator.id}
            creator={creator}
            onUnfollowed={() => setFollowing((prev) => (prev ?? []).filter((c) => c.id !== creator.id))}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
});
