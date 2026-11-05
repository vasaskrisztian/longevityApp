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
import { useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Public (signed-out) creators directory at /creators — the same URL the
 * web app serves. Only names and counts; everything behind them requires
 * an account. Signed-in users are sent to the full in-app directory.
 */

function Row({ creator }: { creator: CreatorDirectoryItem }) {
  const { t, locale } = useT();
  return (
    <Pressable onPress={() => router.push(`/creators/${creator.id}`)} accessibilityRole="link">
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

export default function PublicCreatorsScreen() {
  const { t } = useT();
  const { status } = useSession();
  const [creators, setCreators] = useState<CreatorDirectoryItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') return;
    getPublicCreatorDirectory()
      .then(setCreators)
      .catch(() => setError(true));
  }, [status]);

  if (status === 'signedIn') return <Redirect href="/community/browse" />;

  return (
    <PublicLayout>
      <View style={styles.intro}>
        <Text style={styles.heading}>{t('creators.public.heading')}</Text>
        <Text style={styles.lede}>{t('creators.public.lede')}</Text>
      </View>

      {error ? <Alert variant="destructive">{t('creators.directory.loadFailed')}</Alert> : null}
      {!creators && !error ? <ActivityIndicator color={colors.primary.default} /> : null}
      {creators?.length === 0 ? <Text style={styles.empty}>{t('creators.directory.empty')}</Text> : null}
      {creators?.map((creator) => <Row key={creator.id} creator={creator} />)}

      <JoinCard
        headline={t('creators.public.joinHeadline')}
        body={t('creators.public.joinBody')}
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
