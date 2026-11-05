import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { completeVideoWatch, groupErrorMessage, startVideoWatch, type MyGroupChallenge, type VideoWatchResult } from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';
import { formatVideoDuration } from '@/src/wellbeing/challengeForm';
import {
  playerErrorMessage,
  watchedLabel,
  WatchTracker,
  type PlayerEvent,
} from '@/src/wellbeing/videoWatch';
import { ProgressBar } from './parts';
import { YouTubePlayer } from './YouTubePlayer';

type Phase = 'idle' | 'disclaimer' | 'starting' | 'watching' | 'submitting' | 'done';

/**
 * The "watch today's video" part of a video challenge: a short non-medical
 * notice, the player, a live "watched so far" bar, and — once the video has
 * played to the end — the call that counts the session. Watching is optional
 * and one finished viewing per day counts.
 */
export function VideoChallengePanel({
  challenge,
  groupId,
  onChanged,
}: {
  challenge: MyGroupChallenge;
  groupId: string;
  onChanged: () => void;
}) {
  const { t } = useT();
  const video = challenge.video;
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [result, setResult] = useState<VideoWatchResult | null>(null);
  const tracker = useRef(new WatchTracker());
  const watchId = useRef<string | null>(null);
  const submitted = useRef(false);

  const finish = useCallback(async () => {
    if (submitted.current || !watchId.current) return;
    submitted.current = true;
    setPhase('submitting');
    try {
      const outcome = await completeVideoWatch(groupId, challenge.id, {
        watchId: watchId.current,
        watchedSeconds: Math.round(tracker.current.watchedSeconds),
      });
      setResult(outcome);
      setPhase('done');
      onChanged();
    } catch (err) {
      setError(groupErrorMessage(err, t('video.countFailed')));
      setPhase('idle');
    }
  }, [challenge.id, groupId, onChanged, t]);

  const handleEvent = useCallback(
    (event: PlayerEvent) => {
      if (!video) return;
      if (event.type === 'error') {
        setError(playerErrorMessage(event.code));
        setPhase('idle');
        return;
      }
      if (event.type !== 'tick') return;
      tracker.current.update(event);
      setWatchedSeconds(tracker.current.watchedSeconds);
      if (event.state === 'ended') {
        if (tracker.current.isComplete(video.durationSec)) void finish();
        else {
          setError(
            t('video.notEnough', {
              watched: formatVideoDuration(tracker.current.watchedSeconds),
              total: formatVideoDuration(video.durationSec),
            }),
          );
          setPhase('idle');
        }
      }
    },
    [video, finish, t],
  );

  async function start() {
    setPhase('starting');
    setError(null);
    try {
      const watch = await startVideoWatch(groupId, challenge.id);
      watchId.current = watch.watchId;
      tracker.current.reset();
      submitted.current = false;
      setWatchedSeconds(0);
      setResult(null);
      setPhase('watching');
    } catch (err) {
      setError(groupErrorMessage(err, t('video.startFailed')));
      setPhase('idle');
    }
  }

  if (!video || challenge.status !== 'ACTIVE') return null;
  if (!challenge.joined) {
    return <Text style={styles.muted}>{t('video.joinToWatch')}</Text>;
  }

  const percent = Math.min(100, Math.round((watchedSeconds / Math.max(1, video.durationSec)) * 100));

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{video.title}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {phase === 'idle' || phase === 'done' ? (
        <>
          {phase === 'done' && result ? (
            <Alert variant="success">
              {result.counted ? t('video.counted', { count: result.sessions }) : t('video.alreadyCounted')}
            </Alert>
          ) : challenge.videoDoneToday ? (
            <Text style={styles.muted}>{t('video.doneToday')}</Text>
          ) : null}
          <Button
            title={
              challenge.videoDoneToday || phase === 'done'
                ? t('video.watchAgain')
                : t('video.watchToday', { duration: formatVideoDuration(video.durationSec) })
            }
            variant={challenge.videoDoneToday || phase === 'done' ? 'outline' : 'primary'}
            size="sm"
            onPress={() => setPhase('disclaimer')}
          />
        </>
      ) : null}

      {phase === 'disclaimer' ? (
        <>
          <Text style={styles.body}>{t('video.disclaimer')}</Text>
          <View style={styles.row}>
            <Button title={t('common.cancel')} variant="outline" size="sm" style={styles.flex} onPress={() => setPhase('idle')} />
            <Button title={t('video.start')} size="sm" style={styles.flex} onPress={start} />
          </View>
        </>
      ) : null}

      {phase === 'starting' ? <Text style={styles.muted}>{t('video.starting')}</Text> : null}

      {phase === 'watching' || phase === 'submitting' ? (
        <>
          <YouTubePlayer videoId={video.videoId} onEvent={handleEvent} />
          <View style={styles.progress}>
            <View style={styles.progressText}>
              <Text style={styles.label}>{t('video.watched')}</Text>
              <Text style={styles.value}>{watchedLabel(watchedSeconds, video.durationSec, formatVideoDuration)}</Text>
            </View>
            <ProgressBar percent={percent} />
          </View>
          <Text style={styles.muted}>
            {phase === 'submitting' ? t('video.counting') : t('video.watchHint')}
          </Text>
          {phase === 'watching' ? <Button title={t('video.stop')} variant="ghost" size="sm" onPress={() => setPhase('idle')} /> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.muted.default },
  title: { fontFamily: fontFamily.sansSemibold, fontSize: 14, color: colors.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.foreground, lineHeight: 19 },
  muted: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  progress: { gap: 6 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.foreground },
  value: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
});
