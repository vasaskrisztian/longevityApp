import type { Catalog } from '@/src/i18n/translate';
import type { body as en } from '../en/body';

export const body: Catalog<typeof en> = {
  // InBody — measurement fields
  'body.field.weightKg': 'Testsúly',
  'body.field.bodyFatPercentage': 'Testzsír',
  'body.field.skeletalMuscleMassKg': 'Vázizomtömeg',
  'body.field.fatFreeMassKg': 'Zsírmentes tömeg',
  'body.field.bmi': 'BMI',
  'body.field.inBodyScore': 'InBody-pontszám',
  'body.field.visceralFatLevel': 'Zsigeri zsír szintje',
  'body.field.basalMetabolicRateKcal': 'Alapanyagcsere',
  'body.field.totalBodyWaterL': 'Teljes testvíz',
  'body.field.ecwRatio': 'ECW-arány',

  // InBody — screen
  'body.loadFailed': 'Nem sikerült betölteni az InBody-méréseidet.',
  'body.currentValues': 'Aktuális értékek',
  'body.fromScan': 'A mérés időpontja: {date}.',
  'body.noScansUploaded': 'Még nem töltöttél fel mérést.',
  'body.notRecorded': 'Nincs rögzítve',
  'body.trends': 'Trendek',
  'body.trend.weight': 'Testsúly',
  'body.trend.bodyFat': 'Testzsír %',
  'body.trend.skeletalMuscle': 'Vázizomtömeg',
  'body.trend.score': 'InBody-pontszám',
  'body.notEnoughData': 'Még nincs elég adat.',
  'body.history': 'Előzmények',
  'body.noScans': 'Még nincs mérés.',

  'body.upload.title': 'Mérés feltöltése',
  'body.upload.description':
    'Egy nyomtatott InBody-eredménylap fényképe. A szöveget és az értékeket automatikusan beolvassuk és azonnal mentjük — amit nem sikerült megbízhatóan kiolvasni, azt üresen hagyjuk, hogy te töltsd ki.',
  'body.upload.takePhoto': 'Fénykép készítése',
  'body.upload.chooseLibrary': 'Választás a galériából',
  'body.upload.reading': 'Az eredménylap beolvasása… ez általában 15–20 másodpercet vesz igénybe, de akár egy percig is eltarthat.',
  'body.upload.successAll': 'A mérés feltöltve — minden mezőt sikerült beolvasni.',
  'body.upload.successPartial':
    'A mérés feltöltve. Nem sikerült megbízhatóan beolvasni: {fields}. Az új bejegyzésnél a Szerkesztés gombbal pótolhatod ezeket.',
  'body.upload.timeout':
    'A feldolgozás a vártnál jóval tovább tartott, ezért leállítottuk. Próbáld újra — ha továbbra sem sikerül, használj kisebb méretű vagy élesebb fényképet.',
  'body.upload.failed': 'Nem sikerült feldolgozni a képet. Próbálj meg egy élesebb fényképet készíteni az eredménylapról.',
  'body.upload.cameraNeeded': 'Az eredménylap lefényképezéséhez hozzáférés kell a kamerához.',
  'body.upload.libraryNeeded': 'Az eredménylap fényképének kiválasztásához hozzáférés kell a fotótárhoz.',

  'body.row.notRecorded': 'Nincs rögzítve: {fields}',
  'body.row.showRawText': 'Beolvasott nyers szöveg megjelenítése (a hiányzó mezők kézi kitöltéséhez)',
  'body.row.hideRawText': 'Beolvasott nyers szöveg elrejtése',
  'body.row.photoLoadFailed': 'Nem sikerült betölteni a fényképet.',
  'body.row.photoAlt': 'Az InBody-eredménylap fényképe',
  'body.row.viewPhoto': 'Fénykép megtekintése',
  'body.row.hidePhoto': 'Fénykép elrejtése',
  'body.row.deleting': 'Törlés…',

  'body.edit.measuredAt': 'Mérés időpontja (éééé-hh-nnOO:PP)',
  'body.edit.saveFailed': 'Nem sikerült menteni. Ellenőrizd az értékeket, és próbáld újra.',

  'body.delete.title': 'Törlöd ezt az InBody-mérést?',
  'body.delete.message': 'A mérés és a hozzá tartozó fénykép véglegesen törlődik. Ez a művelet nem vonható vissza.',

  // Me > Devices and data
  'devices.loadFailed': 'Nem sikerült betölteni az eszközeidet. Húzd lefelé a képernyőt az újrapróbáláshoz.',
  'devices.status.connected': 'Csatlakoztatva',
  'devices.status.disconnected': 'Nincs csatlakoztatva',
  'devices.status.authRequired': 'Újracsatlakozás szükséges',
  'devices.status.error': 'Kapcsolódási hiba',
  'devices.syncNow': 'Szinkronizálás most',
  'devices.syncing': 'Szinkronizálás…',
  'devices.disclaimer':
    'Ez a platform wellness-információkat nyújt, orvosi diagnózist vagy orvosi tanácsot nem ad.',

  'devices.oura.connected': 'Az Oura-fiókod csatlakoztatva van.',
  'devices.oura.needsAttention': 'Az Oura-kapcsolatod figyelmet igényel — csatlakozz újra a szinkronizálás folytatásához.',
  'devices.oura.connectPrompt':
    'Csatlakoztasd az Oura-fiókodat, hogy az alvási, regenerációs és aktivitási adataid automatikusan szinkronizálódjanak.',
  'devices.oura.lastSyncAttempt': 'Legutóbbi szinkronizálási kísérlet: {date}',
  'devices.oura.lastSyncAttemptWithStatus': 'Legutóbbi szinkronizálási kísérlet: {date} ({status})',
  'devices.oura.disconnect': 'Leválasztás',
  'devices.oura.disconnecting': 'Leválasztás…',
  'devices.oura.opening': 'Az Oura megnyitása…',
  'devices.oura.reconnect': 'Oura újracsatlakoztatása',
  'devices.oura.connect': 'Oura csatlakoztatása',
  'devices.oura.dailySyncHint':
    'A napi szinkronizálás automatikusan fut a háttérben; a Szinkronizálás most gombbal igény szerint lekérheted a legfrissebb adatokat (5 percenként egyszer).',
  'devices.oura.connectFailed': 'Nem sikerült elindítani az Oura csatlakoztatását. Próbáld újra.',
  'devices.oura.disconnectFailed': 'Nem sikerült leválasztani az Ourát. Próbáld újra.',
  'devices.oura.sync.queued': 'A szinkronizálás sorba került — a legfrissebb Oura-adataid néhány percen belül megjelennek itt.',
  'devices.oura.sync.rateLimited': 'Az elmúlt 5 percben már elindítottál egy szinkronizálást. Várj egy kicsit az újrapróbálással.',
  'devices.oura.sync.notConnected': 'Az Oura-fiókod nincs csatlakoztatva, ezért nincs mit szinkronizálni.',
  'devices.oura.sync.error': 'Nem sikerült elindítani a szinkronizálást. Próbáld újra.',

  'devices.apple.iphoneOnly': 'Csak iPhone',
  'devices.apple.notOnThisDevice':
    'Az Apple Health adatai az iPhone-odon találhatók. A csatlakoztatáshoz nyisd meg a Longevity Klub alkalmazást az iPhone-odon — a lépések, a kalóriák, az alvás, a nyugalmi pulzus és a HRV ezután automatikusan szinkronizálódnak ide.',
  'devices.apple.connectedDescription': 'Az Apple Health adataid automatikusan szinkronizálódnak, valahányszor megnyitod az alkalmazást.',
  'devices.apple.connectDescription':
    'Oszd meg az Apple Health lépés-, kalória-, alvás-, nyugalmi pulzus- és HRV-adataidat. Csak olvasási hozzáférés — a Longevity Klub soha nem ír az Apple Health-be.',
  'devices.apple.lastSync': 'Legutóbbi szinkronizálás: {date}',
  'devices.apple.connect': 'Apple Health csatlakoztatása',
  'devices.apple.stopHint':
    'A megosztás leállításához kapcsold ki a hozzáférést itt: Beállítások > Egészség > Adathozzáférés és eszközök > Longevity Klub.',

  // Apple Health sync outcomes
  'health.apple.synced_one': 'Az Apple Health adataiból {count} nap szinkronizálva.',
  'health.apple.synced_other': 'Az Apple Health adataiból {count} nap szinkronizálva.',
  'health.apple.noData':
    'Nem található Apple Health-adat. Ellenőrizd, hogy a Longevity Klub olvashatja-e az adataidat itt: Beállítások > Egészség > Adathozzáférés és eszközök.',
  'health.apple.unavailable': 'Az Apple Health nem érhető el ezen az eszközön.',
  'health.apple.syncFailed': 'Nem sikerült szinkronizálni az Apple Health-et. Próbáld újra.',
  'health.apple.rateLimited': 'Túl sok Apple Health-szinkronizálási kérés. Próbáld újra egy perc múlva.',

  // Health Connect (Android)
  'devices.hc.androidOnly': 'Csak Android',
  'devices.hc.notOnThisDevice':
    'A Health Connect adatai az Android-telefonodon találhatók. A csatlakoztatáshoz nyisd meg a Longevity Klub alkalmazást az Android-telefonodon — a lépések, a kalóriák, az alvás, a nyugalmi pulzus és a HRV (például egy Samsung órából a Samsung Health-en át) ezután automatikusan szinkronizálódnak ide.',
  'devices.hc.connectedElsewhere':
    'Az Android-telefonodról csatlakoztatva. Az adataid onnan szinkronizálódnak, a legfrissebb napok megjelennek az irányítópulton.',
  'devices.hc.connectedDescription':
    'A Health Connect adataid automatikusan szinkronizálódnak, valahányszor megnyitod az alkalmazást, és háttérben is, ha engedélyezted.',
  'devices.hc.connectDescription':
    'Oszd meg a Health Connect lépés-, kalória-, alvás-, nyugalmi pulzus- és HRV-adataidat. Csak olvasási hozzáférés — a Longevity Klub soha nem ír a Health Connectbe. Samsung órád van? Engedd, hogy a Samsung Health megossza az adatait a Health Connecttel.',
  'devices.hc.connectedAt': 'Csatlakoztatva: {date}',
  'devices.hc.lastSync': 'Legutóbbi szinkronizálás: {date}',
  'devices.hc.neverSynced': 'Még nem érkezett szinkronizált adat.',
  'devices.hc.connect': 'Health Connect csatlakoztatása',
  'devices.hc.manage': 'Hozzáférés kezelése a Health Connectben',
  'devices.hc.unavailable':
    'A Health Connect nem érhető el ezen a telefonon. Android 13 vagy régebbi rendszeren előbb telepítsd a „Health Connect” alkalmazást a Google Play-ből.',
  'devices.hc.updateRequired':
    'A Health Connect frissítésre szorul. Frissítsd a „Health Connect” alkalmazást a Google Play-ben, aztán próbáld újra.',
  'devices.hc.backgroundOn': 'A háttérszinkron be van kapcsolva: az adataid időnként akkor is feltöltődnek, amikor az alkalmazás zárva van.',
  'devices.hc.backgroundOff':
    'A háttérszinkron ki van kapcsolva, ezért az adatok az alkalmazás megnyitásakor szinkronizálódnak. A bekapcsolásához engedélyezd a Health Connectben, hogy a Longevity Klub a háttérben is olvashasson.',
  'devices.hc.stopHint': 'A megosztás leállításához vond vissza a Longevity Klub hozzáférését a Health Connectben (a fenti gomb).',

  // Health Connect sync outcomes
  'health.hc.synced_one': 'A Health Connect adataiból {count} nap szinkronizálva.',
  'health.hc.synced_other': 'A Health Connect adataiból {count} nap szinkronizálva.',
  'health.hc.noData':
    'Nem található Health Connect-adat. Ellenőrizd, hogy az órád vagy az alkalmazásod (például a Samsung Health) ír-e a Health Connectbe, és hogy a Longevity Klub olvashatja-e.',
  'health.hc.noPermission': 'A Longevity Klub még nem olvashatja a Health Connectet. Koppints a Csatlakoztatásra, és engedélyezd a hozzáférést.',
  'health.hc.unavailable': 'A Health Connect nem érhető el ezen az eszközön.',
  'health.hc.syncFailed': 'Nem sikerült szinkronizálni a Health Connectet. Próbáld újra.',
  'health.hc.rateLimited': 'Túl sok Health Connect-szinkronizálási kérés. Próbáld újra egy perc múlva.',
};
