import type { Catalog } from '@/src/i18n/translate';
import type { account as en } from '../en/account';

export const account: Catalog<typeof en> = {
  'account.signedInAs': 'Bejelentkezve mint',

  'account.creator.title': 'Alkotói nyilvános profil',
  'account.creator.publicDescription':
    'A nyilvános protokolljaid, kihívásaid és legutóbbi adataid bárki számára láthatók az Alkotók jegyzékében.',
  'account.creator.privateDescription':
    'Kapcsold be, hogy a követőid lássák a nyilvános protokolljaidat, kihívásaidat és legutóbbi adataidat az Alkotók jegyzékében.',
  'account.creator.updating': 'Frissítés…',
  'account.creator.makePrivate': 'Profil privátra állítása',
  'account.creator.publish': 'Profil nyilvánossá tétele',

  'account.language.saveFailed': 'A nyelv mentése nem sikerült. Kérjük, próbáld újra.',

  'account.password.title': 'Jelszó módosítása',
  'account.password.description':
    'A módosítás után minden eszközödön kijelentkeztetünk, és az új jelszóval jelentkezhetsz be újra.',
  'account.password.success': 'A jelszó módosítva. Kijelentkeztetünk…',
  'account.password.current': 'Jelenlegi jelszó',
  'account.password.new': 'Új jelszó',
  'account.password.repeat': 'Új jelszó még egyszer',
  'account.password.submit': 'Jelszó módosítása',
  'account.password.failed': 'A jelszó módosítása nem sikerült. Kérjük, próbáld újra.',

  'account.sharing.title': 'Ki láthatja az adataimat',
  'account.sharing.loadFailed': 'A csoportjaid betöltése nem sikerült.',
  'account.sharing.none': 'Egyetlen csoport sem látja az egészségügyi adataidat. Csak te láthatod őket.',
  'account.sharing.description':
    'Ezeknek a csoportoknak a vezetői látják az egészségügyi adataidat. A megosztást bármikor megszüntetheted a csoportból való kilépéssel.',
  'account.sharing.leaveTitle': 'Kilépsz a(z) {name} csoportból?',
  'account.sharing.leaveMessage':
    'A csoport vezetői többé nem láthatják az egészségügyi adataidat, és kikerülsz a csoport kihívásaiból.',
  'account.sharing.leaveConfirm': 'Kilépés a csoportból',
  'account.sharing.leaveFailed': 'A kilépés nem sikerült. Kérjük, próbáld újra.',

  'account.data.title': 'Az adataid',
  'account.data.description':
    'Az alkalmazás tárolja a profilodat és céljaidat, a viselhető eszközök és az Apple Health adatait, az InBody-mérésedet, a protokolljaidat, étrend-kiegészítőidet és a kihívások állását. Az adataidat csak te láthatod, valamint azon csoportok vezetői, amelyekhez csatlakoztál, és az általad nyilvánossá tett alkotói profil követői.',
  'account.data.deleteNote': 'A fiókod törlése (lent) mindezt véglegesen eltávolítja.',

  'account.delete.title': 'Fiók törlése',
  'account.delete.description':
    'Véglegesen törli a fiókodat és az összes adatodat, és leválasztja a viselhető eszközödet. Ez nem vonható vissza.',
  'account.delete.passwordLabel': 'A jelszavad',
  'account.delete.enterPassword': 'A megerősítéshez add meg a jelszavadat.',
  'account.delete.confirmTitle': 'Törlöd a fiókodat?',
  'account.delete.confirmMessage': 'A fiókod és az összes adatod véglegesen törlődik. Ez nem vonható vissza.',
  'account.delete.confirmButton': 'Fiók törlése',
  'account.delete.failed': 'A fiók törlése nem sikerült. Kérjük, próbáld újra.',
  'account.delete.submit': 'Fiókom törlése',
  'account.delete.open': 'Fiók törlése…',
};
