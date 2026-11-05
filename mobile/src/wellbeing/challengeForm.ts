import { t } from '@/src/i18n';
import type { CreateGroupChallengeInput, GroupChallengeMode, GroupChallengeType } from '@/src/api/groups';

/** Metrics whose results can be added up across people (sleep scores cannot). */
export const COLLECTIVE_TYPES: GroupChallengeType[] = ['DAILY_STEPS', 'WEEKLY_WORKOUTS', 'VIDEO_SESSIONS'];

export interface CollectiveField {
  typeLabel: string;
  label: string;
  hint: string;
  default: string;
}

/**
 * Texts of the team-total form fields. The texts are getters, so they are
 * translated when a screen reads them (never frozen at import time).
 */
export const COLLECTIVE_FIELDS: Partial<Record<GroupChallengeType, CollectiveField>> = {
  DAILY_STEPS: {
    get typeLabel() {
      return t('wellbeing.form.steps.typeLabel');
    },
    get label() {
      return t('wellbeing.form.steps.label');
    },
    get hint() {
      return t('wellbeing.form.steps.hint');
    },
    default: '100000',
  },
  WEEKLY_WORKOUTS: {
    get typeLabel() {
      return t('wellbeing.form.workouts.typeLabel');
    },
    get label() {
      return t('wellbeing.form.workouts.label');
    },
    get hint() {
      return t('wellbeing.form.workouts.hint');
    },
    default: '40',
  },
  VIDEO_SESSIONS: {
    get typeLabel() {
      return t('wellbeing.form.video.typeLabel');
    },
    get label() {
      return t('wellbeing.form.video.label');
    },
    get hint() {
      return t('wellbeing.form.video.hint');
    },
    default: '100',
  },
};

/** Personal-goal defaults per metric: [threshold, requiredCount]. */
export const INDIVIDUAL_DEFAULTS: Record<GroupChallengeType, [string, string]> = {
  DAILY_STEPS: ['8000', '10'],
  SLEEP_SCORE: ['80', '10'],
  WEEKLY_WORKOUTS: ['2', '4'],
  // No threshold — one finished viewing per day counts; the second number is the days required.
  VIDEO_SESSIONS: ['0', '10'],
};

export const MIN_VIDEO_SECONDS = 10;
export const MAX_VIDEO_SECONDS = 4 * 60 * 60;

/**
 * "5:00" / "1:02:30" → seconds; a plain number is minutes ("5" → 300).
 * Null when it is not a time between 10 seconds and 4 hours.
 */
export function parseVideoDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  let seconds: number;
  if (/^\d+$/.test(value)) {
    seconds = Number(value) * 60;
  } else {
    const match = /^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/.exec(value);
    if (!match) return null;
    seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return seconds >= MIN_VIDEO_SECONDS && seconds <= MAX_VIDEO_SECONDS ? seconds : null;
}

/** 300 → "5:00", 3725 → "1:02:05". */
export function formatVideoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A YouTube link in any of the usual shapes — a light check; the server extracts the video id. */
export function looksLikeYouTubeUrl(text: string): boolean {
  return /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\/\S+/i.test(text.trim());
}

/** The type chips of the create form: a team total is "Steps" / "Workouts", not "Daily steps" / "Weekly workouts" (there is no per-day or per-week target). */
export function typeOptionsFor(
  mode: GroupChallengeMode,
  options: { value: string; label: string }[],
): { value: string; label: string }[] {
  if (mode !== 'COLLECTIVE') return options;
  return options
    .filter((option) => COLLECTIVE_FIELDS[option.value as GroupChallengeType])
    .map((option) => ({ value: option.value, label: COLLECTIVE_FIELDS[option.value as GroupChallengeType]!.typeLabel }));
}

/** The type to use after switching the mode: a team total cannot be a sleep score. */
export function typeForMode(mode: GroupChallengeMode, type: GroupChallengeType): GroupChallengeType {
  return mode === 'COLLECTIVE' && !COLLECTIVE_TYPES.includes(type) ? 'DAILY_STEPS' : type;
}

export interface ChallengeFormValues {
  mode: GroupChallengeMode;
  type: GroupChallengeType;
  threshold: string;
  requiredCount: string;
  targetTotal: string;
  /** VIDEO_SESSIONS only. */
  videoUrl?: string;
  videoTitle?: string;
  /** "5:00" (or minutes) — VIDEO_SESSIONS only; empty = read from YouTube. */
  videoDuration?: string;
}

const isPositiveInt = (value: number) => Number.isInteger(value) && value >= 1;

/** Field errors for the goal part of the form (the dates and name are checked by the screen). */
export function validateGoal(values: ChallengeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const message = t('wellbeing.form.wholeNumber');
  if (values.type === 'VIDEO_SESSIONS') {
    if (!values.videoUrl?.trim()) errors.videoUrl = t('wellbeing.form.videoUrlRequired');
    else if (!looksLikeYouTubeUrl(values.videoUrl)) errors.videoUrl = t('wellbeing.form.videoUrlInvalid');
    // Optional: left empty, the server reads the length from YouTube.
    if (values.videoDuration?.trim() && parseVideoDuration(values.videoDuration) === null) {
      errors.videoDuration = t('wellbeing.form.videoDurationInvalid');
    }
  }
  if (values.mode === 'COLLECTIVE') {
    if (!isPositiveInt(Number(values.targetTotal.replace(/\s/g, '')))) errors.targetTotal = message;
  } else {
    // A video challenge has no threshold: one finished viewing a day counts.
    if (values.type !== 'VIDEO_SESSIONS' && !isPositiveInt(Number(values.threshold))) errors.threshold = message;
    if (!isPositiveInt(Number(values.requiredCount))) errors.requiredCount = message;
  }
  return errors;
}

/** The goal fields of the request body — validated first with `validateGoal`. */
export function goalPayload(
  values: ChallengeFormValues,
): Pick<CreateGroupChallengeInput, 'mode' | 'threshold' | 'requiredCount' | 'targetTotal' | 'videoUrl' | 'videoTitle' | 'videoDurationSec'> {
  const video =
    values.type === 'VIDEO_SESSIONS'
      ? {
          videoUrl: (values.videoUrl ?? '').trim(),
          ...(values.videoTitle?.trim() ? { videoTitle: values.videoTitle.trim() } : {}),
          ...(values.videoDuration?.trim() ? { videoDurationSec: parseVideoDuration(values.videoDuration) ?? undefined } : {}),
        }
      : {};
  if (values.mode === 'COLLECTIVE') {
    return { mode: 'COLLECTIVE', targetTotal: Number(values.targetTotal.replace(/\s/g, '')), ...video };
  }
  if (values.type === 'VIDEO_SESSIONS') {
    return { mode: 'INDIVIDUAL', requiredCount: Number(values.requiredCount), ...video };
  }
  return { mode: 'INDIVIDUAL', threshold: Number(values.threshold), requiredCount: Number(values.requiredCount) };
}
