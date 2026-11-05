import type { Catalog } from '@/src/i18n/translate';
import type { auth as en } from '../en/auth';

export const auth: Catalog<typeof en> = {
  'auth.login.title': 'Bejelentkezés',
  'auth.login.verified': 'Az e-mail-címed megerősítve — most már bejelentkezhetsz.',
  'auth.login.enterBoth': 'Add meg az e-mail-címedet és a jelszavadat.',
  'auth.login.invalid': 'Hibás e-mail-cím vagy jelszó, vagy a fiókod még nincs megerősítve.',
  'auth.login.failed': 'A bejelentkezés nem sikerült. Kérjük, próbáld újra.',
  'auth.login.submit': 'Bejelentkezés',
  'auth.login.submitting': 'Bejelentkezés…',
  'auth.login.createAccount': 'Fiók létrehozása',
  'auth.login.forgot': 'Elfelejtetted a jelszavad?',

  'auth.field.email': 'E-mail-cím',
  'auth.field.password': 'Jelszó',
  'auth.field.fullName': 'Teljes név',
  'auth.field.confirmPassword': 'Jelszó megerősítése',

  'auth.register.title': 'Fiók létrehozása',
  'auth.register.passwordHint': 'Legalább 10 karakter, nagybetűvel, kisbetűvel és számjeggyel.',
  'auth.register.terms': 'Elfogadom a Felhasználási feltételeket',
  'auth.register.privacy': 'Elfogadom az Adatvédelmi tájékoztatót',
  'auth.register.submit': 'Fiók létrehozása',
  'auth.register.submitting': 'Fiók létrehozása…',
  'auth.register.haveAccount': 'Már van fiókod?',
  'auth.register.logIn': 'Bejelentkezés',
  'auth.register.checkEmailTitle': 'Nézd meg az e-mailjeidet',
  'auth.register.checkEmailBody':
    'Ha az e-mail-cím érvényes, küldtünk egy megerősítő linket. A bejelentkezés előtt meg kell erősítened az e-mail-címedet.',
  'auth.register.backToLogin': 'Vissza a bejelentkezéshez',

  'auth.reset.requestTitle': 'Jelszó visszaállítása',
  'auth.reset.send': 'Visszaállító link küldése',
  'auth.reset.sending': 'Küldés…',
  'auth.reset.sent': 'Ha ez az e-mail-cím regisztrálva van, elküldtük rá a visszaállító linket.',
  'auth.reset.backToLogin': 'Vissza a bejelentkezéshez',
  'auth.reset.confirmTitle': 'Új jelszó választása',
  'auth.reset.newPassword': 'Új jelszó',
  'auth.reset.confirmNewPassword': 'Új jelszó megerősítése',
  'auth.reset.update': 'Jelszó módosítása',
  'auth.reset.updating': 'Módosítás…',
  'auth.reset.linkInvalid': 'Ez a visszaállító link érvénytelen vagy lejárt.',
  'auth.reset.done': 'A jelszó módosítva. Most már bejelentkezhetsz.',
  'auth.reset.logIn': 'Bejelentkezés',
};
