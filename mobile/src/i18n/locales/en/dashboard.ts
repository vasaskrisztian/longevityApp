/** Today (dashboard), Trends, the daily-summary card and the chart helpers. */
export const dashboard = {
  // Today screen
  'dashboard.title': 'Dashboard',
  'dashboard.greeting': 'Hi, {name}',
  'dashboard.noWearable': 'No wearable connected yet.',
  'dashboard.syncing': 'Syncing your devices…',
  'dashboard.loadFailed': 'Could not load your dashboard. Pull down to try again.',
  'dashboard.staleBanner': 'No data has synced for today yet — showing the most recent day available ({date}).',
  'dashboard.device.connected': '{name}: connected',
  'dashboard.device.connectedSynced': '{name}: connected · last synced {time}',
  'dashboard.duration': '{hours}h {minutes}m',
  'dashboard.target': 'Target: {target}',
  'dashboard.noDataYet': 'No data yet',

  'dashboard.protocol.following': 'Following: {name}',
  'dashboard.protocol.defaultDescription': "Today's actuals above are compared against this protocol's targets.",
  'dashboard.protocol.supplements': 'Supplements on this protocol',

  'dashboard.card.sleep': 'Sleep',
  'dashboard.card.readiness': 'Readiness',
  'dashboard.card.activity': 'Activity',
  'dashboard.card.hrv': 'HRV',
  'dashboard.card.restingHr': 'Resting HR',
  'dashboard.card.sleepDuration': 'Sleep duration',
  'dashboard.card.steps': 'Steps',
  'dashboard.card.activeCalories': 'Active calories (today)',
  'dashboard.card.workouts': 'Workouts (last 7 days)',

  'dashboard.empty.title': 'No wellness data yet',
  'dashboard.empty.connected': 'Your Oura Ring is connected — the first sync populates this dashboard once it runs.',
  'dashboard.empty.notConnected':
    'Connect your Oura Ring, Apple Health or Health Connect to start seeing Sleep, Readiness and Activity scores here.',
  'dashboard.empty.connect': 'Connect a device',

  'dashboard.disclaimer':
    'This platform provides wellness information and does not provide medical diagnoses or medical advice.',

  // Daily summary card
  'insights.title': 'Your day at a glance',
  'insights.severity.attention': 'Watch',
  'insights.severity.good': 'Good',
  'insights.severity.info': 'Note',

  // Trends screen
  'trends.subtitle':
    'Sleep, readiness and activity scores, HRV, resting heart rate, sleep duration and steps over the last 7 or 30 days.',
  'trends.range': '{days}-day',
  'trends.table.show': 'Show as table',
  'trends.table.hide': 'Hide table',
  'trends.loadFailed': 'Could not load this range. Please try again.',
  'trends.noData': 'No data for this range yet.',

  'trends.series.sleep': 'Sleep',
  'trends.series.readiness': 'Readiness',
  'trends.series.activity': 'Activity',
  'trends.series.hrv': 'HRV',
  'trends.series.restingHr': 'Resting HR',
  'trends.series.sleepDuration': 'Sleep duration',
  'trends.series.steps': 'Steps',
  'trends.a11y.sleepScore': 'Sleep score',
  'trends.a11y.readinessScore': 'Readiness score',
  'trends.a11y.activityScore': 'Activity score',

  'trends.scores.title': 'Scores',
  'trends.scores.description': 'Sleep, readiness and activity — higher is better, 0-100. Tap a name to show or hide it.',
  'trends.hrv.title': 'HRV',
  'trends.hrv.description': 'Average heart rate variability (ms).',
  'trends.restingHr.title': 'Resting heart rate',
  'trends.restingHr.description': 'Beats per minute.',
  'trends.sleepDuration.title': 'Sleep duration',
  'trends.sleepDuration.description': 'Total sleep, in hours and minutes.',
  'trends.steps.title': 'Steps',
  'trends.steps.description': 'Daily step count.',

  'trends.table.title': 'Data table',
  'trends.table.description': 'The same values shown in the charts above, for accessibility or export.',
  'trends.table.date': 'Date',
  'trends.table.sleepTime': 'Sleep time',

  // Chart helpers: a duration such as "7h 30m", "8h", "45m"
  'chart.duration.hoursMinutes': '{hours}h {minutes}m',
  'chart.duration.hours': '{hours}h',
  'chart.duration.minutes': '{minutes}m',
} as const;
