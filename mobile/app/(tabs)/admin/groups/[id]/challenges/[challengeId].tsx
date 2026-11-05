import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { deleteAdminGroupChallenge, getAdminGroupChallenge, type AdminChallengeDetail } from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { TeamChart } from '@/src/components/wellbeing/TeamChart';
import { CollectiveBar, ContributionLine, ProgressBar, ProgressLine, StatusBadge } from '@/src/components/wellbeing/parts';
import { useT } from '@/src/i18n';
import { formatVideoDuration } from '@/src/wellbeing/challengeForm';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { confirmDestructive } from '@/src/utils/confirm';
import { challengeTargetText, daysLeftLabel, displayName, formatDateRange, teamStatusLine } from '@/src/wellbeing/format';

/**
 * Corporate wellbeing — admin: where everyone stands in one group
 * challenge and where the team as a whole is. Progress is computed fresh on
 * every open, from the same rules the members and the end-of-challenge
 * summaries use.
 */
export default function AdminGroupChallengeScreen() {
  const { t } = useT();
  const { id, challengeId } = useLocalSearchParams<{ id: string; challengeId: string }>();
  const [detail, setDetail] = useState<AdminChallengeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!id || !challengeId) return;
    getAdminGroupChallenge(id, challengeId)
      .then((result) => {
        setDetail(result);
        setError(null);
      })
      .catch(() => setError(t('admin.challenge.loadFailed')));
  }, [id, challengeId, t]);

  useFocusEffect(load);

  async function handleDelete() {
    if (!id || !challengeId || !detail) return;
    const ok = await confirmDestructive(
      t('admin.challenge.deleteTitle', { name: detail.challenge.name }),
      t('admin.challenge.deleteMessage'),
      t('admin.challenge.deleteConfirm'),
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAdminGroupChallenge(id, challengeId);
      router.back();
    } catch {
      setError(t('admin.challenge.deleteFailed'));
      setDeleting(false);
    }
  }

  if (error && !detail) {
    return (
      <View style={styles.centered}>
        <Alert variant="destructive">{error}</Alert>
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const { challenge, team, collective, series, participants, notJoined } = detail;
  const left = daysLeftLabel(challenge.daysRemaining);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{challenge.name}</Text>
        <StatusBadge status={challenge.status} />
      </View>
      <Text style={styles.body}>{challengeTargetText(challenge)}</Text>
      <Text style={styles.muted}>
        {formatDateRange(challenge.startDate, challenge.endDate)}
        {left ? ` · ${left}` : ''}
      </Text>
      {challenge.description ? <Text style={styles.body}>{challenge.description}</Text> : null}
      {challenge.video ? (
        <Text style={styles.muted}>
          {t('admin.challenge.video', {
            title: challenge.video.title,
            duration: formatVideoDuration(challenge.video.durationSec),
            videoId: challenge.video.videoId,
          })}
        </Text>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.challenge.team')}</Text>
        {collective ? (
          <>
            <CollectiveBar type={challenge.type} collective={collective} />
            {series ? <TeamChart type={challenge.type} series={series} /> : null}
          </>
        ) : (
          <>
            <ProgressBar percent={team.averagePercent} />
            <Text style={styles.body}>{teamStatusLine(team)}</Text>
          </>
        )}
        <Text style={styles.muted}>
          {t('admin.challenge.groupJoined', { participants: team.participants, members: team.members })}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>
          {collective
            ? t('admin.challenge.contributions', { count: participants.length })
            : t('admin.challenge.participants', { count: participants.length })}
        </Text>
        {participants.length === 0 ? <Text style={styles.muted}>{t('admin.challenge.nobodyJoined')}</Text> : null}
        {participants.map((participant) => (
          <Pressable
            key={participant.userId}
            style={styles.participant}
            accessibilityRole="button"
            onPress={() => router.push(`/admin/groups/${id}/members/${participant.userId}`)}
          >
            <Text style={styles.rowTitle}>{displayName(participant)}</Text>
            {collective ? (
              <ContributionLine type={challenge.type} progress={participant.progress} />
            ) : (
              <ProgressLine progress={participant.progress} />
            )}
          </Pressable>
        ))}
      </Card>

      {notJoined.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin.challenge.notJoined', { count: notJoined.length })}</Text>
          {notJoined.map((member) => (
            <Text key={member.userId} style={styles.body}>
              {displayName(member)}
            </Text>
          ))}
        </Card>
      ) : null}

      <Button title={t('admin.challenge.delete')} variant="destructive" loading={deleting} onPress={handleDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  content: { padding: 20, gap: 12 },
  centered: { flex: 1, backgroundColor: screenBackground, padding: 20, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground },
  card: { gap: 10 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 16, color: colors.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  muted: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, lineHeight: 18 },
  rowTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 15, color: colors.foreground },
  participant: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.card.border },
});
