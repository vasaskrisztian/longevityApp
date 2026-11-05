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
/** A step counts when the video moved at most this many times the real time that passed (normal speed = 1) … */
const SPEED_TOLERANCE = 1.25;
/** … plus this much slack in seconds (timer jitter, the player's position granularity). */
const SLACK_SECONDS = 1;

/**
 * Adds up the time the video genuinely played. A step from a "playing" (or
 * "buffering", a short stall mid-video) report to the next "playing" one at normal speed counts when the video advanced by about as
 * much as the real clock did — so a browser that slows the page's timers in a
 * background tab (fewer, later reports) still counts honestly, while jumping
 * ahead (the video moves far more than the clock), going back, pausing,
 * buffering and fast playback add nothing.
 */
export class WatchTracker {
  watchedSeconds = 0;
  ended = false;
  private lastPosition: number | null = null;
  private lastState: PlayerState | null = null;
  private lastAt = 0;

  update(tick: PlayerTick, nowMs: number = Date.now()): void {
    if (tick.state === 'ended') this.ended = true;
    const normalSpeed = Math.abs(tick.rate - 1) < 0.01;
    const continuing = this.lastState === 'playing' || this.lastState === 'buffering';
    if (tick.state === 'playing' && continuing && this.lastPosition !== null && normalSpeed) {
      const step = tick.position - this.lastPosition;
      const real = Math.max(0, (nowMs - this.lastAt) / 1000);
      if (step > 0 && step <= real * SPEED_TOLERANCE + SLACK_SECONDS) this.watchedSeconds += step;
    }
    this.lastPosition = tick.position;
    this.lastState = tick.state;
    this.lastAt = nowMs;
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
    this.lastAt = 0;
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
