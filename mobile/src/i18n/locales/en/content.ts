/** The info-popover glossary: plain-language explanations of the values and terms the app shows. */
export const content = {
  // Used by InfoLabel / InfoTipHost
  'glossary.whatIsThis': '{title}: what is this?',
  'glossary.closeExplanation': 'Close explanation',

  // Today / Trends
  'glossary.sleepScore.title': 'Sleep score',
  'glossary.sleepScore.text':
    'A 0–100 summary of last night’s sleep from your wearable, combining how long, how deep and how undisturbed it was. Higher is better; the exact formula is the device maker’s.',
  'glossary.readinessScore.title': 'Readiness score',
  'glossary.readinessScore.text':
    'A 0–100 estimate from your wearable of how ready your body is for the day, based on recent sleep, resting heart rate, HRV and recent activity. Higher means better recovered.',
  'glossary.activityScore.title': 'Activity score',
  'glossary.activityScore.text':
    'A 0–100 summary from your wearable of how active you were: movement through the day, training volume and how well you balanced activity with rest.',
  'glossary.scores.title': 'Sleep, Readiness and Activity scores',
  'glossary.scores.text':
    'Three 0–100 summaries calculated by your wearable. Sleep describes last night, Readiness how recovered you seem, Activity how active you were. Use the chips to show one, two or all three.',
  'glossary.hrv.title': 'HRV (heart rate variability)',
  'glossary.hrv.text':
    'The small variation in time between heartbeats, measured overnight in milliseconds. It tends to be higher when you are rested and lower after stress, poor sleep or hard training. It is personal: compare it with your own usual, not with other people.',
  'glossary.restingHr.title': 'Resting heart rate',
  'glossary.restingHr.text':
    'Your lowest typical heart rate while at rest, usually measured during sleep, in beats per minute (bpm). It often drifts up with stress, illness, alcohol or too little rest, and down as fitness and recovery improve.',
  'glossary.sleepDuration.title': 'Sleep duration',
  'glossary.sleepDuration.text':
    'Total time asleep last night (not time in bed), shown in hours and minutes. Your protocol can set a target for it.',
  'glossary.steps.title': 'Steps',
  'glossary.steps.text':
    'Steps counted by your wearable or phone for the day. The number for today keeps growing until the day ends.',
  'glossary.activeCalories.title': 'Active calories',
  'glossary.activeCalories.text':
    'Energy burned through movement and exercise, without the calories your body uses just to stay alive (that part is the BMR).',
  'glossary.workouts.title': 'Workouts (last 7 days)',
  'glossary.workouts.text':
    'Distinct workout sessions in the last 7 days, including today. The same session recorded by two devices counts once.',
  'glossary.baseline.title': 'Personal baseline',
  'glossary.baseline.text':
    'Your own usual values: the average of your previous 30 days. The summary compares your last 3 days with it, so it needs about a week of data before it can say anything.',

  // Body (InBody)
  'glossary.weightKg.title': 'Weight',
  'glossary.weightKg.text':
    'Total body weight at the time of the scan. It includes fat, muscle, bones and water, so day-to-day changes are mostly water.',
  'glossary.bodyFatPercentage.title': 'Body fat',
  'glossary.bodyFatPercentage.text':
    'The share of your body weight that is fat, in percent. Some fat is needed and healthy; what is typical depends on age and sex. Watch the trend over weeks rather than single readings.',
  'glossary.skeletalMuscleMassKg.title': 'Skeletal muscle mass',
  'glossary.skeletalMuscleMassKg.text':
    'The weight of the muscles you control to move (arms, legs, trunk), in kilograms. It is the muscle that strength training builds.',
  'glossary.fatFreeMassKg.title': 'Fat-free mass',
  'glossary.fatFreeMassKg.text':
    'Everything in your body that is not fat: muscle, bones, organs and water, in kilograms. Weight minus the fat mass.',
  'glossary.bmi.title': 'BMI (body mass index)',
  'glossary.bmi.text':
    'Weight divided by height squared. A rough screening number that does not tell muscle from fat, so a muscular person can have a high BMI without carrying extra fat.',
  'glossary.inBodyScore.title': 'InBody score',
  'glossary.inBodyScore.text':
    'A 0–100 summary from the InBody device of your overall body composition, mainly the balance of muscle and fat. It is the device’s own score.',
  'glossary.visceralFatLevel.title': 'Visceral fat level',
  'glossary.visceralFatLevel.text':
    'An index of the fat stored deep in the abdomen around the organs. Lower is generally better; InBody’s own guide reads levels of about 1–9 as normal and 10 and above as high.',
  'glossary.basalMetabolicRateKcal.title': 'BMR (basal metabolic rate)',
  'glossary.basalMetabolicRateKcal.text':
    'The energy your body uses at complete rest just to keep going (breathing, circulation, temperature), in kilocalories per day. Everyday activity and exercise come on top of it.',
  'glossary.totalBodyWaterL.title': 'Total body water',
  'glossary.totalBodyWaterL.text':
    'All the water in your body, in litres: inside the cells and around them. It is part of the fat-free mass and moves with hydration.',
  'glossary.ecwRatio.title': 'ECW ratio',
  'glossary.ecwRatio.text':
    'The share of your body water that sits outside the cells. InBody treats roughly 0.36–0.39 as the usual range. It shifts with fluid balance and after hard training; if it stays high, that is a question for a professional rather than something to judge from the app.',
} as const;
