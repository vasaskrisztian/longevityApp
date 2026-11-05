import type { Catalog } from '@/src/i18n/translate';
import type { dashboard as en } from '../en/dashboard';

export const dashboard: Catalog<typeof en> = {
  // Today screen
  'dashboard.title': 'Übersicht',
  'dashboard.greeting': 'Hallo, {name}',
  'dashboard.noWearable': 'Noch kein Wearable verbunden.',
  'dashboard.syncing': 'Deine Geräte werden synchronisiert…',
  'dashboard.loadFailed': 'Deine Übersicht konnte nicht geladen werden. Zieh nach unten, um es erneut zu versuchen.',
  'dashboard.staleBanner': 'Für heute wurden noch keine Daten synchronisiert — angezeigt wird der letzte verfügbare Tag ({date}).',
  'dashboard.device.connected': '{name}: verbunden',
  'dashboard.device.connectedSynced': '{name}: verbunden · zuletzt synchronisiert: {time}',
  'dashboard.duration': '{hours} h {minutes} min',
  'dashboard.target': 'Ziel: {target}',
  'dashboard.noDataYet': 'Noch keine Daten',

  'dashboard.protocol.following': 'Aktuelles Protokoll: {name}',
  'dashboard.protocol.defaultDescription': 'Die heutigen Werte oben werden mit den Zielen dieses Protokolls verglichen.',
  'dashboard.protocol.supplements': 'Nahrungsergänzungsmittel in diesem Protokoll',

  'dashboard.card.sleep': 'Schlaf',
  'dashboard.card.readiness': 'Bereitschaft',
  'dashboard.card.activity': 'Aktivität',
  'dashboard.card.hrv': 'HRV',
  'dashboard.card.restingHr': 'Ruhepuls',
  'dashboard.card.sleepDuration': 'Schlafdauer',
  'dashboard.card.steps': 'Schritte',
  'dashboard.card.activeCalories': 'Aktive Kalorien (heute)',
  'dashboard.card.workouts': 'Workouts (letzte 7 Tage)',

  'dashboard.empty.title': 'Noch keine Wellness-Daten',
  'dashboard.empty.connected': 'Dein Oura Ring ist verbunden — nach der ersten Synchronisierung erscheinen hier deine Daten.',
  'dashboard.empty.notConnected':
    'Verbinde deinen Oura Ring oder Apple Health, um hier deine Schlaf-, Bereitschafts- und Aktivitätswerte zu sehen.',
  'dashboard.empty.connect': 'Gerät verbinden',

  'dashboard.disclaimer':
    'Diese Plattform liefert Wellness-Informationen und stellt keine medizinischen Diagnosen und gibt keine medizinischen Ratschläge.',

  // Daily summary card
  'insights.title': 'Dein Tag auf einen Blick',
  'insights.severity.attention': 'Beachten',
  'insights.severity.good': 'Gut',
  'insights.severity.info': 'Hinweis',

  // Trends screen
  'trends.subtitle':
    'Schlaf-, Bereitschafts- und Aktivitätswerte, HRV, Ruhepuls, Schlafdauer und Schritte der letzten 7 oder 30 Tage.',
  'trends.range': '{days} Tage',
  'trends.table.show': 'Als Tabelle anzeigen',
  'trends.table.hide': 'Tabelle ausblenden',
  'trends.loadFailed': 'Dieser Zeitraum konnte nicht geladen werden. Bitte versuche es erneut.',
  'trends.noData': 'Für diesen Zeitraum gibt es noch keine Daten.',

  'trends.series.sleep': 'Schlaf',
  'trends.series.readiness': 'Bereitschaft',
  'trends.series.activity': 'Aktivität',
  'trends.series.hrv': 'HRV',
  'trends.series.restingHr': 'Ruhepuls',
  'trends.series.sleepDuration': 'Schlafdauer',
  'trends.series.steps': 'Schritte',
  'trends.a11y.sleepScore': 'Schlafwert',
  'trends.a11y.readinessScore': 'Bereitschaftswert',
  'trends.a11y.activityScore': 'Aktivitätswert',

  'trends.scores.title': 'Werte',
  'trends.scores.description':
    'Schlaf, Bereitschaft und Aktivität — je höher, desto besser, von 0 bis 100. Tippe auf einen Namen, um ihn ein- oder auszublenden.',
  'trends.hrv.title': 'HRV',
  'trends.hrv.description': 'Durchschnittliche Herzfrequenzvariabilität (ms).',
  'trends.restingHr.title': 'Ruhepuls',
  'trends.restingHr.description': 'Schläge pro Minute.',
  'trends.sleepDuration.title': 'Schlafdauer',
  'trends.sleepDuration.description': 'Gesamte Schlafzeit in Stunden und Minuten.',
  'trends.steps.title': 'Schritte',
  'trends.steps.description': 'Tägliche Schrittzahl.',

  'trends.table.title': 'Datentabelle',
  'trends.table.description': 'Dieselben Werte wie in den Diagrammen oben — für Barrierefreiheit oder zum Export.',
  'trends.table.date': 'Datum',
  'trends.table.sleepTime': 'Schlafzeit',

  // Chart helpers: a duration such as "7 h 30 min", "8 h", "45 min"
  'chart.duration.hoursMinutes': '{hours} h {minutes} min',
  'chart.duration.hours': '{hours} h',
  'chart.duration.minutes': '{minutes} min',
};
