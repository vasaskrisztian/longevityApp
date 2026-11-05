import { t } from '@/src/i18n';

/**
 * Plain-language explanations for the values and terms the app shows.
 * Shown by `InfoLabel` (hover on web, tap on the phone). Wording stays on the
 * wellness side of the line: it explains what a number is and how to read it,
 * never what it means for anyone's health or what they should do medically.
 *
 * The wording lives in the `glossary.<term>.title` / `.text` catalogue keys
 * (the content namespace of src/i18n/locales). `GLOSSARY[term].title` and `.text` are
 * getters, so they resolve in the current language each time they are read —
 * at render time, never frozen at import.
 */
export interface GlossaryEntry {
  title: string;
  text: string;
}

const TERMS = [
  'sleepScore',
  'readinessScore',
  'activityScore',
  'scores',
  'hrv',
  'restingHr',
  'sleepDuration',
  'steps',
  'activeCalories',
  'workouts',
  'baseline',
  'weightKg',
  'bodyFatPercentage',
  'skeletalMuscleMassKg',
  'fatFreeMassKg',
  'bmi',
  'inBodyScore',
  'visceralFatLevel',
  'basalMetabolicRateKcal',
  'totalBodyWaterL',
  'ecwRatio',
] as const;

export type GlossaryKey = (typeof TERMS)[number];

function entryFor(key: GlossaryKey): GlossaryEntry {
  return {
    get title() {
      return t(`glossary.${key}.title`);
    },
    get text() {
      return t(`glossary.${key}.text`);
    },
  };
}

export const GLOSSARY = Object.fromEntries(TERMS.map((key) => [key, entryFor(key)])) as Record<GlossaryKey, GlossaryEntry>;

export function isGlossaryKey(value: string): value is GlossaryKey {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, value);
}
