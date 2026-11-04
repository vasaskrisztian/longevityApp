import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { YT_STATE, type PlayerState } from '@/src/wellbeing/videoWatch';
import type { YouTubePlayerProps } from './youtubePlayerTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

let apiPromise: Promise<any> | null = null;

/** Loads the YouTube IFrame API script once and resolves with `window.YT`. */
function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(w.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('Could not load the YouTube player.'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/**
 * Web player: the YouTube IFrame API driven directly in the page (playback
 * speed locked to 1, related videos off), reporting state and position about
 * once a second — the same events the phone's WebView player sends.
 */
export function YouTubePlayer({ videoId, onEvent }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let player: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const host = containerRef.current;

    const tick = () => {
      if (!player?.getPlayerState) return;
      const state: PlayerState = YT_STATE[player.getPlayerState()] ?? 'unstarted';
      onEventRef.current({ type: 'tick', state, position: player.getCurrentTime() || 0, rate: player.getPlaybackRate() || 1 });
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host) return;
        const target = document.createElement('div');
        host.appendChild(target);
        player = new YT.Player(target, {
          width: '100%',
          height: '100%',
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, fs: 0, iv_load_policy: 3, disablekb: 1 },
          events: {
            onReady: () => onEventRef.current({ type: 'ready' }),
            onStateChange: tick,
            onPlaybackRateChange: (event: any) => {
              if (event.data !== 1) event.target.setPlaybackRate(1);
              tick();
            },
            onError: (event: any) => onEventRef.current({ type: 'error', code: Number(event.data) }),
          },
        });
        timer = setInterval(tick, 1000);
      })
      .catch(() => onEventRef.current({ type: 'error', code: -1 }));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy?.();
      } catch {
        // Already gone.
      }
      if (host) host.innerHTML = '';
    };
  }, [videoId]);

  return (
    <View style={styles.frame}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
});
