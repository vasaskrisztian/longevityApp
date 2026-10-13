/**
 * Plain-language explanations for the values and terms the app shows.
 * Shown by `InfoLabel` (hover on web, tap on the phone). Wording stays on the
 * wellness side of the line: it explains what a number is and how to read it,
 * never what it means for anyone's health or what they should do medically.
 */
export interface GlossaryEntry {
  title: string;
  text: string;
}

export const GLOSSARY = {
  // Today / Trends
  sleepScore: {
    title: 'Sleep score',
    text: 'A 0–100 summary of last night’s sleep from your wearable, combining how long, how deep and how undisturbed it was. Higher is better; the exact formula is the device maker’s.',
  },
  readinessScore: {
    title: 'Readiness score',
    text: 'A 0–100 estimate from your wearable of how ready your body is for the day, based on recent sleep, resting heart rate, HRV and recent activity. Higher means better recovered.',
  },
  activityScore: {
    title: 'Activity score',
    text: 'A 0–100 summary from your wearable of how active you were: movement through the day, training volume and how well you balanced activity with rest.',
  },
  scores: {
    title: 'Sleep, Readiness and Activity scores',
    text: 'Three 0–100 summaries calculated by your wearable. Sleep describes last night, Readiness how recovered you seem, Activity how active you were. Use the chips to show one, two or all three.',
  },
  hrv: {
    title: 'HRV (heart rate variability)',
    text: 'The small variation in time between heartbeats, measured overnight in milliseconds. It tends to be higher when you are rested and lower after stress, poor sleep or hard training. It is personal: compare it with your own usual, not with other people.',
  },
  restingHr: {
    title: 'Resting heart rate',
    text: 'Your lowest typical heart rate while at rest, usually measured during sleep, in beats per minute (bpm). It often drifts up with stress, illness, alcohol or too little rest, and down as fitness and recovery improve.',
  },
  sleepDuration: {
    title: 'Sleep duration',
    text: 'Total time asleep last night (not time in bed), shown in hours and minutes. Your protocol can set a target for it.',
  },
  steps: {
    title: 'Steps',
    text: 'Steps counted by your wearable or phone for the day. The number for today keeps growing until the day ends.',
  },
  activeCalories: {
    title: 'Active calories',
    text: 'Energy burned through movement and exercise, without the calories your body uses just to stay alive (that part is the BMR).',
  },
  workouts: {
    title: 'Workouts (last 7 days)',
    text: 'Distinct workout sessions in the last 7 days, including today. The same session recorded by two devices counts once.',
  },
  baseline: {
    title: 'Personal baseline',
    text: 'Your own usual values: the average of your previous 30 days. The summary compares your last 3 days with it, so it needs about a week of data before it can say anything.',
  },

  // Body (InBody)
  weightKg: {
    title: 'Weight',
    text: 'Total body weight at the time of the scan. It includes fat, muscle, bones and water, so day-to-day changes are mostly water.',
  },
  bodyFatPercentage: {
    title: 'Body fat',
    text: 'The share of your body weight that is fat, in percent. Some fat is needed and healthy; what is typical depends on age and sex. Watch the trend over weeks rather than single readings.',
  },
  skeletalMuscleMassKg: {
    title: 'Skeletal muscle mass',
    text: 'The weight of the muscles you control to move (arms, legs, trunk), in kilograms. It is the muscle that strength training builds.',
  },
  fatFreeMassKg: {
    title: 'Fat-free mass',
    text: 'Everything in your body that is not fat: muscle, bones, organs and water, in kilograms. Weight minus the fat mass.',
  },
  bmi: {
    title: 'BMI (body mass index)',
    text: 'Weight divided by height squared. A rough screening number that does not tell muscle from fat, so a muscular person can have a high BMI without carrying extra fat.',
  },
  inBodyScore: {
    title: 'InBody score',
    text: 'A 0–100 summary from the InBody device of your overall body composition, mainly the balance of muscle and fat. It is the device’s own score.',
  },
  visceralFatLevel: {
    title: 'Visceral fat level',
    text: 'An index of the fat stored deep in the abdomen around the organs. Lower is generally better; InBody’s own guide reads levels of about 1–9 as normal and 10 and above as high.',
  },
  basalMetabolicRateKcal: {
    title: 'BMR (basal metabolic rate)',
    text: 'The energy your body uses at complete rest just to keep going (breathing, circulation, temperature), in kilocalories per day. Everyday activity and exercise come on top of it.',
  },
  totalBodyWaterL: {
    title: 'Total body water',
    text: 'All the water in your body, in litres: inside the cells and around them. It is part of the fat-free mass and moves with hydration.',
  },
  ecwRatio: {
    title: 'ECW ratio',
    text: 'The share of your body water that sits outside the cells. InBody treats roughly 0.36–0.39 as the usual range. It shifts with fluid balance and after hard training; if it stays high, that is a question for a professional rather than something to judge from the app.',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export function isGlossaryKey(value: string): value is GlossaryKey {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, value);
}
