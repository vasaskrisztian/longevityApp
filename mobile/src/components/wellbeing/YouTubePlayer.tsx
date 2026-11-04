import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildPlayerHtml, type PlayerEvent } from '@/src/wellbeing/videoWatch';
import type { YouTubePlayerProps } from './youtubePlayerTypes';

/**
 * Phone player: a WebView running the YouTube IFrame API (see `buildPlayerHtml`),
 * which reports state and position back as messages. The web build has its own
 * `YouTubePlayer.web.tsx` that drives the same API directly.
 */
export function YouTubePlayer({ videoId, onEvent }: YouTubePlayerProps) {
  const source = useMemo(() => ({ html: buildPlayerHtml(videoId), baseUrl: 'https://www.youtube-nocookie.com' }), [videoId]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as PlayerEvent & { state?: string };
      if (data.type === 'tick') onEvent({ type: 'tick', state: data.state as never, position: Number(data.position), rate: Number(data.rate) });
      else if (data.type === 'ready') onEvent({ type: 'ready' });
      else if (data.type === 'error') onEvent({ type: 'error', code: Number(data.code) });
    } catch {
      // A message that is not ours — ignore.
    }
  }

  return (
    <View style={styles.frame}>
      <WebView
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction
        setSupportMultipleWindows={false}
        // Only the player and YouTube's own frames may load — no navigating away inside the app.
        onShouldStartLoadWithRequest={(request) => /^(about:|data:|https:\/\/([a-z0-9-]+\.)*(youtube|youtube-nocookie|ytimg|googlevideo|google|gstatic)\.com)/i.test(request.url)}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#000' },
});
