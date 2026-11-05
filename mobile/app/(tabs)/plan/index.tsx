import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { getProtocolOverlay, type ProtocolOverlay } from '@/src/api/dashboard';
import { Card } from '@/src/components/ui/Card';
import { HubList } from '@/src/components/ui/HubRow';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { useT } from '@/src/i18n';
import { protocolTargetLines } from '@/src/screens/protocolTargets';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';

function FollowingCard() {
  const { t } = useT();
  const [overlay, setOverlay] = useState<ProtocolOverlay | null | undefined>(undefined);

  useEffect(() => {
    getProtocolOverlay()
      .then(setOverlay)
      .catch(() => setOverlay(null));
  }, []);

  const protocol = overlay?.activeProtocol ?? null;
  if (overlay === undefined) return null;

  return (
    <Card style={styles.followingCard}>
      <Text style={styles.followingLabel}>{t('nav.plan.following')}</Text>
      {protocol ? (
        <>
          <Text style={styles.followingTitle}>{protocol.name}</Text>
          {protocol.description ? <Text style={styles.followingText}>{protocol.description}</Text> : null}
          {protocolTargetLines(protocol).map((line) => (
            <Text key={line} style={styles.followingText}>
              • {line}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.followingText}>{t('nav.plan.noActiveProtocol')}</Text>
      )}
    </Card>
  );
}

export default function PlanScreen() {
  const { t } = useT();
  const isDesktop = useIsDesktop();
  const hub = (
    <HubList
      items={[
        { label: t('nav.plan.protocols'), description: t('nav.plan.protocolsDescription'), icon: 'clipboard-outline', onPress: () => router.push('/plan/protocols') },
        { label: t('nav.plan.supplements'), description: t('nav.plan.supplementsDescription'), icon: 'medkit-outline', onPress: () => router.push('/plan/supplements') },
        { label: t('nav.plan.challenges'), description: t('nav.plan.challengesDescription'), icon: 'trophy-outline', onPress: () => router.push('/plan/challenges') },
      ]}
    />
  );

  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('nav.plan.intro')}</Text>
      {isDesktop ? (
        <View style={styles.columns}>
          <View style={styles.main}>{hub}</View>
          <View style={styles.side}>
            <FollowingCard />
          </View>
        </View>
      ) : (
        hub
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  intro: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  main: { flex: 1 },
  side: { width: 300 },
  followingCard: { gap: 6, borderColor: colors.primary.default },
  followingLabel: { fontFamily: fontFamily.sansMedium, fontSize: 12, color: colors.muted.foreground },
  followingTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 16, color: colors.foreground },
  followingText: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
});
