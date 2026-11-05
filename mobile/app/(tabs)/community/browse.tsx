import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getCreatorDirectory, type CreatorDirectoryItem } from '@/src/api/creators';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';

/**
 * Mirrors the web app's app/creators/page.tsx — the public directory of
 * consenting creators. Unlike the web app (deliberately reachable while
 * signed out), this is a plain authed screen in the Profile stack: Phase 20
 * (see claude/phase-15-mobile-migration-plan.md) resolved mobile's
 * login-only gate for Creators by the user's own explicit decision, rather
 * than building a new "bypass the auth gate" navigation pattern.
 */

function DirectoryRow({ creator }: { creator: CreatorDirectoryItem }) {
  const { t, locale } = useT();
  return (
    <Pressable onPress={() => router.push(`/community/creators/${creator.id}`)}>
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{creator.fullName ?? t('creators.fallbackName')}</Text>
          <Text style={styles.rowSubtitle}>
            {t('creators.memberSince', { date: new Date(creator.memberSince).toLocaleDateString(locale) })} ·{' '}
            {t('creators.followers', { count: creator.followerCount })}
          </Text>
          <Text style={styles.rowSubtitle}>
            {t('creators.protocols', { count: creator.publicProtocolCount })} ·{' '}
            {t('creators.challenges', { count: creator.publicChallengeCount })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
      </Card>
    </Pressable>
  );
}

export default function CreatorsDirectoryScreen() {
  const { t } = useT();
  const [creators, setCreators] = useState<CreatorDirectoryItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(false);
    try {
      setCreators(await getCreatorDirectory());
    } catch {
      setError(true);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (!creators) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{t('creators.directory.loadFailed')}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {error ? <Alert variant="destructive">{t('creators.directory.loadFailed')}</Alert> : null}

      {creators.length === 0 ? (
        <Text style={styles.empty}>{t('creators.directory.empty')}</Text>
      ) : (
        creators.map((creator) => <DirectoryRow key={creator.id} creator={creator} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackground,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
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
