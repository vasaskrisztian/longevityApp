import type { Catalog } from '@/src/i18n/translate';
import type { body as en } from '../en/body';

export const body: Catalog<typeof en> = {
  // InBody — measurement fields
  'body.field.weightKg': 'Gewicht',
  'body.field.bodyFatPercentage': 'Körperfett',
  'body.field.skeletalMuscleMassKg': 'Skelettmuskelmasse',
  'body.field.fatFreeMassKg': 'Fettfreie Masse',
  'body.field.bmi': 'BMI',
  'body.field.inBodyScore': 'InBody-Score',
  'body.field.visceralFatLevel': 'Viszeraler Fettlevel',
  'body.field.basalMetabolicRateKcal': 'Grundumsatz',
  'body.field.totalBodyWaterL': 'Gesamtkörperwasser',
  'body.field.ecwRatio': 'ECW-Verhältnis',

  // InBody — screen
  'body.loadFailed': 'Deine InBody-Messungen konnten nicht geladen werden.',
  'body.currentValues': 'Aktuelle Werte',
  'body.fromScan': 'Aus der Messung vom {date}.',
  'body.noScansUploaded': 'Noch keine Messung hochgeladen.',
  'body.notRecorded': 'Nicht erfasst',
  'body.trends': 'Trends',
  'body.trend.weight': 'Gewicht',
  'body.trend.bodyFat': 'Körperfett %',
  'body.trend.skeletalMuscle': 'Skelettmuskelmasse',
  'body.trend.score': 'InBody-Score',
  'body.notEnoughData': 'Noch nicht genug Daten.',
  'body.history': 'Verlauf',
  'body.noScans': 'Noch keine Messungen.',

  'body.upload.title': 'Messung hochladen',
  'body.upload.description':
    'Ein Foto eines ausgedruckten InBody-Berichts. Text und Werte werden automatisch ausgelesen und sofort gespeichert — was nicht zuverlässig gelesen werden konnte, bleibt leer, damit du es selbst ergänzen kannst.',
  'body.upload.takePhoto': 'Foto aufnehmen',
  'body.upload.chooseLibrary': 'Aus der Mediathek wählen',
  'body.upload.reading': 'Der Bericht wird gelesen… das dauert meist 15–20 Sekunden, kann aber bis zu einer Minute dauern.',
  'body.upload.successAll': 'Messung hochgeladen — alle Felder wurden erfolgreich gelesen.',
  'body.upload.successPartial':
    'Messung hochgeladen. Nicht zuverlässig gelesen werden konnten: {fields}. Ergänze sie über „Bearbeiten“ beim neuen Eintrag.',
  'body.upload.timeout':
    'Das dauert deutlich länger als erwartet und wurde abgebrochen. Bitte versuche es erneut — falls es wieder passiert, nimm ein kleineres oder schärferes Foto.',
  'body.upload.failed': 'Das Bild konnte nicht verarbeitet werden. Bitte versuche es mit einem schärferen Foto des Berichts.',
  'body.upload.cameraNeeded': 'Für ein Foto des Berichts wird Zugriff auf die Kamera benötigt.',
  'body.upload.libraryNeeded': 'Um ein Foto des Berichts auszuwählen, wird Zugriff auf die Fotomediathek benötigt.',

  'body.row.notRecorded': 'Nicht erfasst: {fields}',
  'body.row.showRawText': 'Gescannten Rohtext anzeigen (um fehlende Felder von Hand auszufüllen)',
  'body.row.hideRawText': 'Gescannten Rohtext ausblenden',
  'body.row.photoLoadFailed': 'Das Foto konnte nicht geladen werden.',
  'body.row.photoAlt': 'Foto der InBody-Messung',
  'body.row.viewPhoto': 'Foto ansehen',
  'body.row.hidePhoto': 'Foto ausblenden',
  'body.row.deleting': 'Wird gelöscht…',

  'body.edit.measuredAt': 'Gemessen am (jjjj-mm-ttThh:mm)',
  'body.edit.saveFailed': 'Speichern fehlgeschlagen. Bitte prüfe die Werte und versuche es erneut.',

  'body.delete.title': 'Diese InBody-Messung löschen?',
  'body.delete.message': 'Die Messung und ihr Foto werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.',

  // Me > Devices and data
  'devices.loadFailed': 'Deine Geräte konnten nicht geladen werden. Zieh den Bildschirm nach unten, um es erneut zu versuchen.',
  'devices.status.connected': 'Verbunden',
  'devices.status.disconnected': 'Nicht verbunden',
  'devices.status.authRequired': 'Erneute Verbindung nötig',
  'devices.status.error': 'Verbindungsfehler',
  'devices.syncNow': 'Jetzt synchronisieren',
  'devices.syncing': 'Wird synchronisiert…',
  'devices.disclaimer':
    'Diese Plattform liefert Wellness-Informationen und stellt keine medizinischen Diagnosen und gibt keine medizinische Beratung.',

  'devices.oura.connected': 'Dein Oura-Konto ist verbunden.',
  'devices.oura.needsAttention': 'Deine Oura-Verbindung braucht Aufmerksamkeit — verbinde dich erneut, um die Synchronisierung fortzusetzen.',
  'devices.oura.connectPrompt':
    'Verbinde dein Oura-Konto, um Schlaf-, Erholungs- und Aktivitätsdaten automatisch zu synchronisieren.',
  'devices.oura.lastSyncAttempt': 'Letzter Synchronisierungsversuch: {date}',
  'devices.oura.lastSyncAttemptWithStatus': 'Letzter Synchronisierungsversuch: {date} ({status})',
  'devices.oura.disconnect': 'Trennen',
  'devices.oura.disconnecting': 'Wird getrennt…',
  'devices.oura.opening': 'Oura wird geöffnet…',
  'devices.oura.reconnect': 'Oura erneut verbinden',
  'devices.oura.connect': 'Oura verbinden',
  'devices.oura.dailySyncHint':
    'Die tägliche Synchronisierung läuft automatisch im Hintergrund; mit „Jetzt synchronisieren“ holst du die neuesten Daten bei Bedarf ab (höchstens einmal alle 5 Minuten).',
  'devices.oura.connectFailed': 'Die Oura-Verbindung konnte nicht gestartet werden. Bitte versuche es erneut.',
  'devices.oura.disconnectFailed': 'Oura konnte nicht getrennt werden. Bitte versuche es erneut.',
  'devices.oura.sync.queued': 'Synchronisierung eingeplant — deine neuesten Oura-Daten erscheinen in wenigen Minuten hier.',
  'devices.oura.sync.rateLimited': 'Du hast in den letzten 5 Minuten bereits eine Synchronisierung gestartet. Bitte warte kurz, bevor du es erneut versuchst.',
  'devices.oura.sync.notConnected': 'Dein Oura-Konto ist nicht verbunden, daher gibt es nichts zu synchronisieren.',
  'devices.oura.sync.error': 'Die Synchronisierung konnte nicht gestartet werden. Bitte versuche es erneut.',

  'devices.apple.iphoneOnly': 'Nur iPhone',
  'devices.apple.notOnThisDevice':
    'Apple-Health-Daten liegen auf deinem iPhone. Öffne die Longevity Klub App auf deinem iPhone, um sie zu verbinden — Schritte, Kalorien, Schlaf, Ruhepuls und HRV werden dann automatisch hierher synchronisiert.',
  'devices.apple.connectedDescription': 'Deine Apple-Health-Daten werden automatisch synchronisiert, sobald du die App öffnest.',
  'devices.apple.connectDescription':
    'Teile Schritte, Kalorien, Schlaf, Ruhepuls und HRV aus Apple Health. Nur lesend — Longevity Klub schreibt niemals in Apple Health.',
  'devices.apple.lastSync': 'Letzte Synchronisierung: {date}',
  'devices.apple.connect': 'Apple Health verbinden',
  'devices.apple.stopHint':
    'Um die Freigabe zu beenden, schalte den Zugriff unter Einstellungen > Health > Datenzugriff & Geräte > Longevity Klub aus.',

  // Apple Health sync outcomes
  'health.apple.synced_one': '{count} Tag an Apple-Health-Daten synchronisiert.',
  'health.apple.synced_other': '{count} Tage an Apple-Health-Daten synchronisiert.',
  'health.apple.noData':
    'Es wurden keine Apple-Health-Daten gefunden. Prüfe unter Einstellungen > Health > Datenzugriff & Geräte, ob Longevity Klub deine Daten lesen darf.',
  'health.apple.unavailable': 'Apple Health ist auf diesem Gerät nicht verfügbar.',
  'health.apple.syncFailed': 'Apple Health konnte nicht synchronisiert werden. Bitte versuche es erneut.',
  'health.apple.rateLimited': 'Zu viele Apple-Health-Synchronisierungsanfragen. Bitte versuche es in einer Minute erneut.',
};
