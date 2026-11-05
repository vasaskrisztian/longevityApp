import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { getCreatorTeaser, RateLimitedError, type CreatorTeaser } from '@/src/api/publicCreators';
import { useSession } from '@/src/auth/useSession';
import { JoinCard, PublicLayout } from '@/src/components/PublicLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Public (signed-out) creator teaser at /creators/:id. Shows only what the
 * stripped teaser endpoint returns — name, join date and counts — and sells
 * the rest ("register to see protocols, challenges and results"). Signed-in
 * users are sent to the full in-app profile.
 */

function Stat({ value, label }: { value: number; label: string }) {
  const { locale } = useT();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString(locale)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function PublicCreatorScreen() {
  const { t, locale } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useSession();
  const [teaser, setTeaser] = useState<CreatorTeaser | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<'rateLimited' | 'loadFailed' | null>(null);

  useEffect(() => {
    if (status === 'signedIn' || !id) return;
    getCreatorTeaser(id)
      .then(setTeaser)
      .catch((e) =>
        setError(e instanceof RateLimitedError ? 'rateLimited' : 'loadFailed'),
      );
  }, [id, status]);

  if (status === 'signedIn') return <Redirect href={`/community/creators/${id}`} />;

  return (
    <PublicLayout>
      <Pressable onPress={() => router.navigate('/creators')} accessibilityRole="link">
        <Text style={styles.back}>{t('creators.teaser.back')}</Text>
      </Pressable>

      {error ? (
        <Alert variant="destructive">
          {error === 'rateLimited' ? t('creators.teaser.rateLimited') : t('creators.loadFailed')}
        </Alert>
      ) : null}
      {teaser === undefined && !error ? <ActivityIndicator color={colors.primary.default} /> : null}

      {teaser === null ? (
        <Card style={styles.notFound}>
          <Text style={styles.name}>{t('creators.teaser.notFoundTitle')}</Text>
          <Text style={styles.muted}>{t('creators.teaser.notFoundBody')}</Text>
        </Card>
      ) : null}

      {teaser ? (
        <>
          <Card style={styles.profile}>
            <Text style={styles.name}>{teaser.fullName ?? t('creators.fallbackName')}</Text>
            <Text style={styles.muted}>
              {t('creators.memberSince', { date: new Date(teaser.memberSince).toLocaleDateString(locale) })}
            </Text>
            <View style={styles.stats}>
              <Stat value={teaser.followerCount} label={t('creators.stat.followers', { count: teaser.followerCount })} />
              <Stat value={teaser.publicProtocolCount} label={t('creators.stat.protocols', { count: teaser.publicProtocolCount })} />
              <Stat value={teaser.publicChallengeCount} label={t('creators.stat.challenges', { count: teaser.publicChallengeCount })} />
              <Stat value={teaser.trackedDays} label={t('creators.stat.trackedDays', { count: teaser.trackedDays })} />
            </View>
          </Card>

          <JoinCard
            headline={
              teaser.fullName
                ? t('creators.teaser.unlockHeadline', { name: teaser.fullName })
                : t('creators.teaser.unlockHeadlineAnon')
            }
            body={t('creators.teaser.joinBody')}
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
