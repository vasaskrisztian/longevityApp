/**
 * YouTube links for group video challenges: pull the 11-character video id out
 * of the usual link shapes. Only the id is stored — the app builds the player
 * address itself (privacy-friendly `youtube-nocookie.com`), so nothing the
 * admin pasted ever ends up in a page as a raw URL.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** The video id of a YouTube link (watch, youtu.be, shorts, embed, live), or null if it is not one. */
export function parseYouTubeVideoId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') candidate = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) candidate = parts[1] ?? null;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/** Whether a string is a plain video id (what gets stored). */
export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}
