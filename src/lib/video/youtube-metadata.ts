/**
 * Reads a YouTube video's length (and title) on the server, so the admin of a
 * video challenge does not have to type it in. Two sources, in this order:
 *
 *  1. the YouTube Data API, when `YOUTUBE_API_KEY` is set (the dependable way);
 *  2. the public watch page (`lengthSeconds` in its embedded player data) —
 *     needs no key but is not a documented interface, so it may stop working.
 *
 * Any failure returns null; the caller then asks the admin for the length.
 */

export interface YouTubeMetadata {
  durationSec: number;
  title: string | null;
}

const REQUEST_TIMEOUT_MS = 6000;
const MAX_PAGE_CHARS = 2_000_000;

/** "PT1H2M3S" / "PT5M" / "PT45S" → seconds (null for anything else, e.g. a live "P0D"). */
export function parseIsoDuration(value: string): number | null {
  const match = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Length and title out of a YouTube watch page's HTML; null when there is no usable length. */
export function parseWatchPage(html: string): YouTubeMetadata | null {
  let durationSec: number | null = null;
  const seconds = /"lengthSeconds"\s*:\s*"(\d+)"/.exec(html);
  if (seconds) durationSec = Number(seconds[1]);
  if (durationSec === null) {
    const meta = /<meta\s+itemprop="duration"\s+content="([^"]+)"/i.exec(html);
    if (meta) durationSec = parseIsoDuration(meta[1] as string);
  }
  if (!durationSec || durationSec <= 0) return null;

  const titleMatch = /<meta\s+(?:name="title"|property="og:title")\s+content="([^"]*)"/i.exec(html);
  const title = titleMatch ? decodeHtml(titleMatch[1] as string).trim().slice(0, 200) : '';
  return { durationSec, title: title || null };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function viaDataApi(videoId: string, apiKey: string, fetchImpl: FetchLike): Promise<YouTubeMetadata | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    items?: { contentDetails?: { duration?: string }; snippet?: { title?: string } }[];
  };
  const item = body.items?.[0];
  const durationSec = item?.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null;
  if (!durationSec) return null;
  return { durationSec, title: item?.snippet?.title?.trim().slice(0, 200) || null };
}

async function viaWatchPage(videoId: string, fetchImpl: FetchLike): Promise<YouTubeMetadata | null> {
  const response = await fetchImpl(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      // Skips the cookie-consent interstitial that European visitors otherwise get instead of the page.
      Cookie: 'CONSENT=YES+1; SOCS=CAI',
      'User-Agent': 'Mozilla/5.0 (compatible; LongevityKlub/1.0)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return parseWatchPage((await response.text()).slice(0, MAX_PAGE_CHARS));
}

/**
 * The length and title of a YouTube video, or null when neither source could
 * tell (private/removed video, network trouble, YouTube changed its page).
 * `videoId` must already be a validated 11-character id.
 */
export async function fetchYouTubeMetadata(
  videoId: string,
  options: { apiKey?: string | null; fetchImpl?: FetchLike } = {},
): Promise<YouTubeMetadata | null> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const apiKey = options.apiKey === undefined ? process.env.YOUTUBE_API_KEY : options.apiKey;
  if (apiKey) {
    try {
      const fromApi = await viaDataApi(videoId, apiKey, fetchImpl);
      if (fromApi) return fromApi;
    } catch {
      // Fall through to the watch page.
    }
  }
  try {
    return await viaWatchPage(videoId, fetchImpl);
  } catch {
    return null;
  }
}
