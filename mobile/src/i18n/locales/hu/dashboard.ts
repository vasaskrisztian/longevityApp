import type { Catalog } from '@/src/i18n/translate';
import type { dashboard as en } from '../en/dashboard';

export const dashboard: Catalog<typeof en> = {
  // Today screen
  'dashboard.title': 'Áttekintés',
  'dashboard.greeting': 'Szia, {name}!',
  'dashboard.noWearable': 'Még nincs csatlakoztatott viselhető eszköz.',
  'dashboard.syncing': 'Az eszközeid szinkronizálása…',
  'dashboard.loadFailed': 'Nem sikerült betölteni az áttekintést. Húzd lefelé a képernyőt az újrapróbáláshoz.',
  'dashboard.staleBanner': 'Ma még nem érkezett új adat — a legutóbbi elérhető nap adatai láthatók ({date}).',
  'dashboard.device.connected': '{name}: csatlakoztatva',
  'dashboard.device.connectedSynced': '{name}: csatlakoztatva · utolsó szinkronizálás: {time}',
  'dashboard.duration': '{hours} ó {minutes} p',
  'dashboard.target': 'Cél: {target}',
  'dashboard.noDataYet': 'Még nincs adat',

  'dashboard.protocol.following': 'Követett protokoll: {name}',
  'dashboard.protocol.defaultDescription': 'A fenti mai értékeket ennek a protokollnak a céljaihoz hasonlítjuk.',
  'dashboard.protocol.supplements': 'A protokoll étrend-kiegészítői',

  'dashboard.card.sleep': 'Alvás',
  'dashboard.card.readiness': 'Felkészültség',
  'dashboard.card.activity': 'Aktivitás',
  'dashboard.card.hrv': 'HRV',
  'dashboard.card.restingHr': 'Nyugalmi pulzus',
  'dashboard.card.sleepDuration': 'Alvásidő',
  'dashboard.card.steps': 'Lépés',
  'dashboard.card.activeCalories': 'Aktív kalória (ma)',
  'dashboard.card.workouts': 'Edzések (elmúlt 7 nap)',

  'dashboard.empty.title': 'Még nincs wellness-adat',
  'dashboard.empty.connected': 'Az Oura Ringed csatlakoztatva van — az első szinkronizálás után itt jelennek meg az adataid.',
  'dashboard.empty.notConnected':
    'Csatlakoztasd az Oura Ringedet, az Apple Healthet vagy a Health Connectet, hogy itt láthasd az alvási, felkészültségi és aktivitási pontszámaidat.',
  'dashboard.empty.connect': 'Eszköz csatlakoztatása',

  'dashboard.disclaimer':
    'Ez a platform wellness-információkat nyújt, orvosi diagnózist vagy orvosi tanácsot nem ad.',

  // Daily summary card
  'insights.title': 'A mai napod dióhéjban',
  'insights.severity.attention': 'Figyelj rá',
  'insights.severity.good': 'Jó',
  'insights.severity.info': 'Megjegyzés',

  // Trends screen
  'trends.subtitle':
    'Alvási, felkészültségi és aktivitási pontszámok, HRV, nyugalmi pulzus, alvásidő és lépésszám az elmúlt 7 vagy 30 napban.',
  'trends.range': '{days} napos',
  'trends.table.show': 'Megjelenítés táblázatként',
  'trends.table.hide': 'Táblázat elrejtése',
  'trends.loadFailed': 'Nem sikerült betölteni ezt az időszakot. Kérjük, próbáld újra.',
  'trends.noData': 'Ebben az időszakban még nincs adat.',

  'trends.series.sleep': 'Alvás',
  'trends.series.readiness': 'Felkészültség',
  'trends.series.activity': 'Aktivitás',
  'trends.series.hrv': 'HRV',
  'trends.series.restingHr': 'Nyugalmi pulzus',
  'trends.series.sleepDuration': 'Alvásidő',
  'trends.series.steps': 'Lépés',
  'trends.a11y.sleepScore': 'Alvási pontszám',
  'trends.a11y.readinessScore': 'Felkészültségi pontszám',
  'trends.a11y.activityScore': 'Aktivitási pontszám',

  'trends.scores.title': 'Pontszámok',
  'trends.scores.description':
    'Alvás, felkészültség és aktivitás — minél magasabb, annál jobb, 0–100 között. Koppints egy névre a megjelenítéséhez vagy elrejtéséhez.',
  'trends.hrv.title': 'HRV',
  'trends.hrv.description': 'Átlagos szívritmus-variabilitás (ms).',
  'trends.restingHr.title': 'Nyugalmi pulzus',
  'trends.restingHr.description': 'Ütés percenként.',
  'trends.sleepDuration.title': 'Alvásidő',
  'trends.sleepDuration.description': 'Teljes alvásidő órában és percben.',
  'trends.steps.title': 'Lépés',
  'trends.steps.description': 'Napi lépésszám.',

  'trends.table.title': 'Adattáblázat',
  'trends.table.description': 'Ugyanazok az értékek, mint a fenti diagramokon — a könnyebb hozzáférhetőségért vagy exportáláshoz.',
  'trends.table.date': 'Dátum',
  'trends.table.sleepTime': 'Alvásidő',

  // Chart helpers: a duration such as "7 ó 30 p", "8 ó", "45 p"
  'chart.duration.hoursMinutes': '{hours} ó {minutes} p',
  'chart.duration.hours': '{hours} ó',
  'chart.duration.minutes': '{minutes} p',
};
