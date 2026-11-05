import type { Catalog } from '@/src/i18n/translate';
import type { groups as en } from '../en/groups';

export const groups: Catalog<typeof en> = {
  // ---- Groups screen (member side)
  'groups.intro':
    'A cégeden vagy csapatodon keresztül tartozol ezekhez a csoportokhoz. A csatlakozással a csoport vezetői láthatják az egészségügyi adataidat; a kihívásokban való részvétel mindig önkéntes.',
  'groups.empty': 'Még nem vagy tagja egyetlen csoportnak sem. Ha egy vezető e-mailben meghív, a meghívó itt jelenik meg.',

  'groups.invitation.validUntil': 'Meghívó · érvényes eddig: {date}',
  'groups.invitation.consent':
    'Hozzájárulok, hogy a(z) {name} csoport vezetői lássák az egészségügyi adataimat (alvás, aktivitás és egyéb mérések). A csoportból bármikor kiléphetek.',
  'groups.invitation.accept': 'Elfogadom és csatlakozom',
  'groups.invitation.acceptFailed': 'A meghívó elfogadása nem sikerült.',

  'groups.group.summary_one': '{count} tag · csatlakozás: {date}',
  'groups.group.summary_other': '{count} tag · csatlakozás: {date}',
  'groups.group.challengesLoadFailed': 'A kihívások betöltése nem sikerült.',
  'groups.group.noChallenges': 'Még nincs kihívás. Amint egy vezető létrehoz egyet, értesítést kapsz.',
  'groups.group.leave': 'Kilépés a csoportból',

  'groups.challenge.failed': 'Valami hiba történt.',
  'groups.challenge.yourShare': 'A te részed',
  'groups.challenge.you': 'Te',
  'groups.challenge.contributors': '{members} tagból {participants} járul hozzá az összesítéshez',
  'groups.challenge.team': 'Csapat: {status}',
  'groups.challenge.joinNote': 'Csak a csatlakozásod napjától gyűjtött adatok számítanak – a korábbi napok nem adódnak hozzá.',
  'groups.challenge.join': 'Csatlakozás a kihíváshoz',
  'groups.challenge.leave': 'Kilépés a kihívásból',
  'groups.challenge.notTakenPart': 'Nem vettél részt ebben a kihívásban.',

  // ---- Shared building blocks (parts, chart, formatting, create form)
  'wellbeing.logo.alt': 'Csoport logója',

  'wellbeing.status.UPCOMING': 'Közelgő',
  'wellbeing.status.ACTIVE': 'Aktív',
  'wellbeing.status.ENDED': 'Lezárult',

  'wellbeing.progress.goalReached': '{current} / {required} · cél elérve',
  'wellbeing.progress.percent': '{current} / {required} · {percent}%',

  'wellbeing.daysLeft.last': 'Utolsó nap',
  'wellbeing.daysLeft_one': '{count} nap van hátra',
  'wellbeing.daysLeft_other': '{count} nap van hátra',

  'wellbeing.team.nobody': 'Még senki nem csatlakozott.',
  'wellbeing.team.status_one': '{count} résztvevőből {completed} elérte a célt · átlagos haladás: {percent}%',
  'wellbeing.team.status_other': '{count} résztvevőből {completed} elérte a célt · átlagos haladás: {percent}%',

  'wellbeing.target.collective': 'Együtt érjetek el {amount}',
  'wellbeing.target.sleep_one': '{count} éjszaka {threshold} feletti alvási pontszámmal',
  'wellbeing.target.sleep_other': '{count} éjszaka {threshold} feletti alvási pontszámmal',
  'wellbeing.target.steps_one': '{count} nap, amelyen több mint {threshold} lépést teszel',
  'wellbeing.target.steps_other': '{count} nap, amelyen több mint {threshold} lépést teszel',
  'wellbeing.target.workouts_one': '{count} hét, amelyben több mint {threshold} {workouts} van',
  'wellbeing.target.workouts_other': '{count} hét, amelyben több mint {threshold} {workouts} van',
  'wellbeing.target.video_one': 'Nézd végig a videót {count} napon',
  'wellbeing.target.video_other': 'Nézd végig a videót {count} napon',

  'wellbeing.unit.steps': 'lépés',
  'wellbeing.unit.workout_one': 'edzés',
  'wellbeing.unit.workout_other': 'edzés',
  'wellbeing.unit.videoSession_one': 'videós alkalom',
  'wellbeing.unit.videoSession_other': 'videós alkalom',
  'wellbeing.unit.session_one': 'alkalom',
  'wellbeing.unit.session_other': 'alkalom',

  'wellbeing.collective.lineReached': '{total} / {target} {unit} · cél elérve',
  'wellbeing.collective.linePercent': '{total} / {target} {unit} · {percent}%',
  'wellbeing.collective.contribution': '{amount} · a csapatcél {percent}%-a',

  'wellbeing.time.justNow': 'épp most',
  'wellbeing.time.minutesAgo': '{count} perccel ezelőtt',
  'wellbeing.time.hoursAgo': '{count} órával ezelőtt',
  'wellbeing.time.daysAgo': '{count} napja',
  'wellbeing.duration.hoursMinutes': '{hours} ó {minutes} p',

  'wellbeing.chart.empty': 'A grafikon a kihívás indulása után jelenik meg.',
  'wellbeing.chart.title': 'Csapat összesen naponta',
  'wellbeing.chart.showTable': 'Megjelenítés táblázatként',
  'wellbeing.chart.hideTable': 'Táblázat elrejtése',
  'wellbeing.chart.a11y': 'A csapat eddigi összesítése: {total}, a cél: {target}',
  'wellbeing.chart.target': 'Cél',
  'wellbeing.chart.targetAmount': 'Cél: {amount}',
  'wellbeing.chart.teamTotal': 'Csapat összesen',
  'wellbeing.chart.day': 'Nap',
  'wellbeing.chart.thatDay': 'Aznap',

  'wellbeing.form.steps.typeLabel': 'Lépések',
  'wellbeing.form.steps.label': 'A csapat lépéseinek összesen',
  'wellbeing.form.steps.hint':
    'A csatlakozók összes lépése összeadódik az első és az utolsó nap között – napi cél nincs, csak az összesített szám számít.',
  'wellbeing.form.workouts.typeLabel': 'Edzések',
  'wellbeing.form.workouts.label': 'A csapat edzéseinek összesen',
  'wellbeing.form.workouts.hint':
    'A csatlakozók összes edzése összeadódik az első és az utolsó nap között – heti cél nincs, csak az összesített szám számít.',
  'wellbeing.form.video.typeLabel': 'Videó',
  'wellbeing.form.video.label': 'A csapat videós alkalmainak összesen',
  'wellbeing.form.video.hint':
    'Minden csatlakozó végignézi a videót; mindenki naponta egy alkalmat gyűjthet. A teljes csapat alkalmai összeadódnak.',
  'wellbeing.form.wholeNumber': 'Egész számot adj meg, legalább 1-et.',
  'wellbeing.form.videoUrlRequired': 'Illeszd be a videó YouTube-linkjét.',
  'wellbeing.form.videoUrlInvalid': 'Ez nem YouTube-videó linkje.',
  'wellbeing.form.videoDurationInvalid': 'A hosszt p:mm formában add meg, például 5:00 – vagy hagyd üresen.',

  'wellbeing.error.requestFailed': 'A kérés sikertelen ({status}).',
  'wellbeing.error.ended': 'Ez a kihívás már lezárult.',
  'wellbeing.error.notFound': 'Nem található.',
  'wellbeing.error.notMember': 'Nem vagy tagja ennek a csoportnak.',
  'wellbeing.error.invalidDates': 'A kihívás nem végződhet a múltban.',

  // ---- Video challenge
  'video.joinToWatch': 'Csatlakozz a kihíváshoz, hogy megnézhesd a videót és alkalmakat gyűjthess.',
  'video.counted_one': 'Beszámítva – eddig {count} alkalmad van. Szép munka!',
  'video.counted_other': 'Beszámítva – eddig {count} alkalmad van. Szép munka!',
  'video.alreadyCounted': 'A videót ma már végignézted, ezért ez nem számít be újra.',
  'video.doneToday': 'A mai videót végignézted. Holnap gyere vissza a következő alkalomért.',
  'video.watchAgain': 'Megnézem újra (nem számít bele)',
  'video.watchToday': 'A mai videó megnézése ({duration})',
  'video.disclaimer':
    'Ez egy könnyű mozgásvideó az általános jóllétért, nem orvosi tanács. Csak annyit végezz, amennyi kényelmes, és hagyd abba, ha fájdalmat vagy szédülést érzel. A megnézés önkéntes. A videó akkor számít be, ha a végéig lejátszódott – az előreugrás nem számít.',
  'video.start': 'Videó indítása',
  'video.starting': 'Indítás…',
  'video.watched': 'Megnézve',
  'video.watchedOf': '{watched} / {total}',
  'video.counting': 'Az alkalmad beszámítása…',
  'video.watchHint': 'Nézd végig, hogy hozzáadódjon egy alkalom. A lejátszási sebesség normál marad.',
  'video.stop': 'Leállítás',
  'video.countFailed': 'A videó beszámítása nem sikerült.',
  'video.startFailed': 'A videó indítása nem sikerült.',
  'video.notEnough':
    'A videó {total} hosszából csak {watched} számított megnézettnek. Csak a folyamatos, normál sebességű lejátszás számít – az előreugrás, a visszatekerés és a szüneteltetés nem. Indítsd újra a videót, és próbáld meg még egyszer.',

  'video.player.embed':
    'Ez a videó nem játszható le az alkalmazáson belül. Kérd a csoport vezetőjét, hogy olyan videót válasszon, amely engedélyezi a beágyazást.',
  'video.player.unavailable': 'Ez a videó már nem érhető el.',
  'video.player.generic': 'A videót nem sikerült lejátszani. Ellenőrizd a kapcsolatot, és próbáld újra.',

  'video.refused.tooEarly': 'A videó még nem játszódott le elég hosszan.',
  'video.refused.notWatched': 'A videót nem nézted végig.',
  'video.refused.expired': 'Ez a megtekintés lejárt – indítsd újra a videót.',
  'video.refused.watchNotFound': 'Ez a megtekintés nem lett elindítva, vagy már felhasználtad.',
  'video.refused.notActive': 'Ez a kihívás jelenleg nem fut.',
  'video.refused.notParticipant': 'Előbb csatlakozz a kihíváshoz.',
  'video.refused.notVideo': 'Ehhez a kihíváshoz nem tartozik videó.',
  'video.refused.unavailable': 'Ez a videó nem érhető el.',
};
