import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  followCreator,
  getCreatorProfile,
  getFollowStatus,
  unfollowCreator,
  type CreatorPublicProfile,
} from '@/src/api/creators';
import { useSession } from '@/src/auth/useSession';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Mirrors the web app's app/creators/[id]/page.tsx: a creator's public
 * protocols/challenges/recent metrics, plus a Follow/Unfollow action
 * (hidden on one's own profile). Phase 20 — see
 * claude/phase-15-mobile-migration-plan.md and creators/index.tsx's doc
 * comment for why this is a plain authed screen rather than the web app's
 * logged-out-reachable version.
 *
 * Protocol/Challenge display here is intentionally a small, read-only
 * duplicate of profile/protocols.tsx + profile/challenges.tsx's own
 * rendering (no edit/delete/publish actions apply to someone else's data),
 * same as the web app keeps its own creator-profile rendering separate
 * from its owner-facing manager components.
 */

type ChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';

const TYPE_META: Record<ChallengeType, { label: string; periodNoun: string; thresholdLabel: string; thresholdUnit: string }> = {
  SLEEP_SCORE: { label: 'Sleep score', periodNoun: 'nights', thresholdLabel: 'Sleep score above', thresholdUnit: 'points' },
  DAILY_STEPS: { label: 'Daily steps', periodNoun: 'days', thresholdLabel: 'Steps above', thresholdUnit: 'steps' },
  WEEKLY_WORKOUTS: { label: 'Weekly workouts', periodNoun: 'weeks', thresholdLabel: 'Workouts above', thresholdUnit: 'per week' },
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

function describeTerms(c: { type: ChallengeType; requiredCount: number; threshold: number; windowDays: number }): string {
  const meta = TYPE_META[c.type];
  return `${meta.thresholdLabel} ${c.threshold} ${meta.thresholdUnit}, for ${c.requiredCount} ${meta.periodNoun}, within ${c.windowDays} days of activation`;
}

function formatMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function ProgressBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function PublicProtocolCard({ protocol }: { protocol: CreatorPublicProfile['protocols'][number] }) {
  const targets = [
    protocol.targetSleepScore != null ? `Sleep score ≥ ${protocol.targetSleepScore}` : null,
    formatMinutes(protocol.targetSleepMinutes) ? `Sleep ${formatMinutes(protocol.targetSleepMinutes)}` : null,
    protocol.targetWeeklyWorkouts != null ? `${protocol.targetWeeklyWorkouts} workouts/week` : null,
    protocol.targetDailyActiveCalories != null ? `${protocol.targetDailyActiveCalories} active kcal/day` : null,
  ].filter(Boolean);

  return (
    <Card>
      <Text style={styles.rowTitle}>{protocol.name}</Text>
      {protocol.description ? <Text style={styles.rowSubtitle}>{protocol.description}</Text> : null}
      {targets.length > 0 ? <Text style={styles.rowSubtitle}>{targets.join(' · ')}</Text> : null}
      {protocol.supplements.length > 0 ? (
        <Text style={styles.rowSubtitle}>Supplements: {protocol.supplements.map((s) => s.name).join(', ')}</Text>
      ) : null}
    </Card>
  );
}

function PublicChallengeCard({ challenge }: { challenge: CreatorPublicProfile['challenges'][number] }) {
  const { status, currentCount, requiredCount } = challenge.progress;
  return (
    <Card>
      <Text style={styles.rowTitle}>{challenge.name || TYPE_META[challenge.type].label}</Text>
      <Text style={styles.rowSubtitle}>{STATUS_LABEL[status] ?? status}</Text>
      <Text style={styles.rowSubtitle}>{describeTerms(challenge)}</Text>
      {status !== 'DRAFT' ? (
        <View style={styles.progressBlock}>
          <ProgressBar current={currentCount} required={requiredCount} />
          <Text style={styles.rowSubtitle}>
            {currentCount}/{requiredCount} {TYPE_META[challenge.type].periodNoun}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function CreatorPublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [profile, setProfile] = useState<CreatorPublicProfile | null | undefined>(undefined);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([getCreatorProfile(id), getFollowStatus(id).catch(() => false)])
      .then(([profileData, isFollowing]) => {
        setProfile(profileData);
        setFollowing(isFollowing);
      })
      .catch(() => setError('Could not load this creator.'));
  }, [id]);

  useEffect(load, [load]);

  async function handleFollowToggle() {
    if (!id) return;
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowCreator(id);
        setFollowing(false);
      } else {
        await followCreator(id);
        setFollowing(true);
      }
    } catch {
      // leave state as-is; the button simply stays actionable for a retry
    } finally {
      setFollowBusy(false);
    }
  }

  if (profile === undefined) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={styles.centered}>
        <Alert variant="destructive">This creator profile isn&apos;t available.</Alert>
      </View>
    );
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <Text style={styles.name}>{profile.fullName ?? 'Creator'}</Text>
        <Text style={styles.rowSubtitle}>
          Member since {new Date(profile.memberSince).toLocaleDateString()} · {profile.followerCount} follower
          {profile.followerCount === 1 ? '' : 's'}
        </Text>
        {!isOwnProfile ? (
          <Button
            title={followBusy ? 'Updating…' : following ? 'Unfollow' : 'Follow'}
            variant={following ? 'outline' : 'primary'}
            size="sm"
            onPress={handleFollowToggle}
            loading={followBusy}
          />
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>Protocols</Text>
      {profile.protocols.length === 0 ? (
        <Text style={styles.empty}>No public protocols yet.</Text>
      ) : (
        profile.protocols.map((p) => <PublicProtocolCard key={p.id} protocol={p} />)
      )}

      <Text style={styles.sectionTitle}>Challenges</Text>
      {profile.challenges.length === 0 ? (
        <Text style={styles.empty}>No public challenges yet.</Text>
      ) : (
        profile.challenges.map((c) => <PublicChallengeCard key={c.id} challenge={c} />)
      )}

      <Text style={styles.sectionTitle}>Recent health data</Text>
      {profile.recentMetrics.length === 0 ? (
        <Text style={styles.empty}>No recent data shared.</Text>
      ) : (
        <Card>
          <ScrollView horizontal style={styles.tableScroll}>
            <View>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {['Date', 'Sleep', 'Steps', 'Resting HR', 'HRV', 'Active kcal'].map((h) => (
                  <Text key={h} style={styles.tableHeaderCell}>
                    {h}
                  </Text>
                ))}
              </View>
              {profile.recentMetrics.map((m) => (
                <View key={m.date} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{m.date}</Text>
                  <Text style={styles.tableCell}>{m.sleepScore ?? '—'}</Text>
                  <Text style={styles.tableCell}>{m.steps ?? '—'}</Text>
                  <Text style={styles.tableCell}>{m.restingHeartRate ?? '—'}</Text>
                  <Text style={styles.tableCell}>{m.averageHrv ?? '—'}</Text>
                  <Text style={styles.tableCell}>{m.activeCalories ?? '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
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
  header: {
    gap: 8,
    alignItems: 'flex-start',
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: colors.foreground,
  },
  sectionTitle: {
    marginTop: 8,
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  progressBlock: {
    marginTop: 8,
    gap: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted.default,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary.default,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  tableScroll: {
    marginTop: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.card.border,
    paddingVertical: 8,
  },
  tableHeaderRow: {
    borderBottomWidth: 2,
  },
  tableHeaderCell: {
    width: 90,
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  tableCell: {
    width: 90,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.foreground,
  },
});
