/**
 * Pure rules of watching a challenge video in the app: how much of it really
 * played, when it counts as watched, and the small page the phone's WebView
 * loads to run the YouTube player. (The web build drives the YouTube IFrame
 * API directly; both feed the same `PlayerTick`s into the same tracker.)
 */

/** YouTube's player states, named. */
export type PlayerState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

export const YT_STATE: Record<number, PlayerState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
};

/** What a player reports about once a second, and right when its state changes. */
export interface PlayerTick {
  state: PlayerState;
  /** Seconds into the video. */
  position: number;
  /** Playback speed; only 1 counts. */
  rate: number;
}

export type PlayerEvent =
  | { type: 'ready' }
  | { type: 'tick' } & PlayerTick
  | { type: 'error'; code: number };

/** Share of the video that has to really play (matches the server's rule). */
export const WATCH_RATIO = 0.9;
/** Between two ticks the position may advance by at most this much and still count as normal playing. */
const MAX_STEP_SECONDS = 3;

/**
 * Adds up the time the video genuinely played: only the steps between two
 * consecutive "playing" reports at normal speed whose position advanced a little
 * count. Jumping ahead, pausing, buffering and fast playback add nothing.
 */
export class WatchTracker {
  watchedSeconds = 0;
  ended = false;
  private lastPosition: number | null = null;
  private lastState: PlayerState | null = null;

  update(tick: PlayerTick): void {
    if (tick.state === 'ended') this.ended = true;
    const normalSpeed = Math.abs(tick.rate - 1) < 0.01;
    if (tick.state === 'playing' && this.lastState === 'playing' && this.lastPosition !== null && normalSpeed) {
      const step = tick.position - this.lastPosition;
      if (step > 0 && step <= MAX_STEP_SECONDS) this.watchedSeconds += step;
    }
    this.lastPosition = tick.position;
    this.lastState = tick.state;
  }

  /** The video reached its end and enough of it really played. */
  isComplete(durationSec: number): boolean {
    return this.ended && this.watchedSeconds >= Math.floor(durationSec * WATCH_RATIO);
  }

  reset(): void {
    this.watchedSeconds = 0;
    this.ended = false;
    this.lastPosition = null;
    this.lastState = null;
  }
}

/** "1:23 of 5:00" */
export function watchedLabel(watchedSeconds: number, durationSec: number, format: (seconds: number) => string): string {
  return `${format(Math.min(watchedSeconds, durationSec))} of ${format(durationSec)}`;
}

/** A plain YouTube video id (11 characters) — the only thing ever put into the player page. */
export function isVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

/** Embed errors the player can report, as a sentence for the person. */
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150 || code === 153) return 'This video cannot be played inside the app. Ask the administrator to use a video that allows embedding.';
  if (code === 100) return 'This video is not available any more.';
  return 'The video could not be played. Check your connection and try again.';
}

/**
 * The page the phone's WebView runs: the YouTube IFrame API with the player
 * (playback speed locked to 1, no fullscreen, related videos off), reporting
 * its state and position back to the app once a second.
 */
export function buildPlayerHtml(videoId: string): string {
  if (!isVideoId(videoId)) throw new Error('Invalid video id');
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#player{width:100%;height:100%}</style></head>
<body><div id="player"></div>
<script>
var player;
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var STATES={'-1':'unstarted','0':'ended','1':'playing','2':'paused','3':'buffering','5':'cued'};
function tick(){
  if(!player||!player.getPlayerState)return;
  var s=STATES[String(player.getPlayerState())]||'unstarted';
  send({type:'tick',state:s,position:player.getCurrentTime()||0,rate:player.getPlaybackRate()||1});
}
function onYouTubeIframeAPIReady(){
  player=new YT.Player('player',{
    width:'100%',height:'100%',videoId:'${videoId}',host:'https://www.youtube-nocookie.com',
    playerVars:{rel:0,modestbranding:1,playsinline:1,fs:0,iv_load_policy:3,disablekb:1},
    events:{
      onReady:function(){send({type:'ready'});},
      onStateChange:function(){tick();},
      onPlaybackRateChange:function(e){if(e.data!==1){e.target.setPlaybackRate(1);}tick();},
      onError:function(e){send({type:'error',code:e.data});}
    }
  });
  setInterval(tick,1000);
}
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body></html>`;
}
