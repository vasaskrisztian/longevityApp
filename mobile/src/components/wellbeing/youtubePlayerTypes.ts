import type { PlayerEvent } from '@/src/wellbeing/videoWatch';

export interface YouTubePlayerProps {
  /** A plain 11-character YouTube video id. */
  videoId: string;
  onEvent: (event: PlayerEvent) => void;
}
