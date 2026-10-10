import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { groupLogoUri, type GroupChallengeStatus, type MemberProgress } from '@/src/api/groups';
import { colors, fontFamily, radii } from '@/src/theme/tokens';
import { STATUS_LABEL } from '@/src/wellbeing/format';

/** A group's logo, or a neutral placeholder when it has none. `uri` overrides (a just-picked local preview). */
export function GroupLogo({ logoUrl, uri, size = 48 }: { logoUrl?: string | null; uri?: string | null; size?: number }) {
  const source = uri ?? groupLogoUri(logoUrl ?? null);
  if (source) {
    return (
      <Image
        source={{ uri: source }}
        accessibilityLabel="Group logo"
        alt="Group logo"
        style={{ width: size, height: size, borderRadius: radii.xl / 2, backgroundColor: colors.muted.default }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <Ionicons name="people-outline" size={size * 0.5} color={colors.muted.foreground} />
    </View>
  );
}

export function ProgressBar({ percent, completed }: { percent: number; completed?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <View style={[styles.fill, { width: `${clamped}%` }, completed && styles.fillDone]} />
    </View>
  );
}

const BADGE_COLORS: Record<GroupChallengeStatus, { bg: string; fg: string }> = {
  UPCOMING: { bg: colors.muted.default, fg: colors.muted.foreground },
  ACTIVE: { bg: '#E8F5EE', fg: colors.success },
  ENDED: { bg: colors.muted.default, fg: colors.muted.foreground },
};

export function StatusBadge({ status }: { status: GroupChallengeStatus }) {
  const palette = BADGE_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

/** "3 of 5 · 60%" with a bar — one person's progress. */
export function ProgressLine({ progress, label }: { progress: MemberProgress; label?: string }) {
  return (
    <View style={styles.progressLine}>
      <View style={styles.progressText}>
        {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
        <Text style={styles.progressValue}>
          {progress.currentCount} of {progress.requiredCount}
          {progress.completed ? ' · goal reached' : ` · ${progress.percent}%`}
        </Text>
      </View>
      <ProgressBar percent={progress.percent} completed={progress.completed} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: radii.xl / 2,
    backgroundColor: colors.muted.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.muted.default, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent.default },
  fillDone: { backgroundColor: colors.success },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fontFamily.sansSemibold, fontSize: 11 },
  progressLine: { gap: 6 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressLabel: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.foreground },
  progressValue: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
});
