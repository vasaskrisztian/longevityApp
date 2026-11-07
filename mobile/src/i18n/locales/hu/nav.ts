import type { Catalog } from '@/src/i18n/translate';
import type { nav as en } from '../en/nav';

export const nav: Catalog<typeof en> = {
  'nav.tab.today': 'Ma',
  'nav.tab.plan': 'Terv',
  'nav.tab.community': 'Közösség',
  'nav.tab.me': 'Én',
  'nav.tab.notifications': 'Értesítések',
  'nav.tab.admin': 'Admin',

  'nav.segment.today': 'Ma',
  'nav.segment.trends': 'Trendek',
  'nav.segment.body': 'Test',
  'nav.segment.personal': 'Személyes',
  'nav.segment.exercise': 'Mozgás',
  'nav.segment.nutrition': 'Táplálkozás',
  'nav.segment.groups': 'Csoportok',
  'nav.segment.creators': 'Alkotók',
  'nav.segment.users': 'Felhasználók',

  'nav.me.about': 'Rólam',
  'nav.me.aboutDescription': 'Személyes adatok, mozgás, táplálkozás',
  'nav.me.devices': 'Eszközök',
  'nav.me.devicesAndData': 'Eszközök és adatok',
  'nav.me.devicesDescription': 'Oura, Apple Health, Health Connect és szinkronizálás',
  'nav.me.account': 'Fiók',
  'nav.me.accountDescription': 'Bejelentkezés, nyilvános profil',

  'nav.plan.intro': 'Amit követsz, és amit el szeretnél érni.',
  'nav.plan.protocols': 'Protokollok és célok',
  'nav.plan.protocolsDescription': 'A követett rutinod, a napi célértékei és a mögötte álló célok',
  'nav.plan.supplements': 'Étrend-kiegészítők',
  'nav.plan.supplementsDescription': 'Minden, amit szedsz; a protokollok ebből a listából választanak',
  'nav.plan.goals': 'Célok',
  'nav.plan.challenges': 'Saját kihívásaim',
  'nav.plan.challengesDescription': 'A magadnak kitűzött kihívások',
  'nav.plan.following': 'Jelenleg követett',
  'nav.plan.noActiveProtocol': 'Még nincs aktív protokollod. Nyisd meg a Protokollokat, és válassz vagy hozz létre egyet.',

  'nav.community.creators': 'Alkotók',
  'nav.community.creator': 'Alkotó',

  'nav.admin.person': 'Személy',
  'nav.admin.group': 'Csoport',
  'nav.admin.challenge': 'Kihívás',

  'nav.notFound.title': 'Nem található',
  'nav.notFound.heading': 'Ez az oldal nem létezik',
  'nav.notFound.body': 'A link talán régi vagy elírták. Az adataid biztonságban vannak — térj vissza a kezdőlapra.',
  'nav.notFound.goHome': 'Ugrás az irányítópultra',

  'nav.public.createAccount': 'Ingyenes fiók létrehozása',
  'nav.public.haveAccount': 'Már van fiókom',

  'nav.badge.unread': '{count} olvasatlan',
  'nav.badge.pendingInvitations_one': '{count} függőben lévő meghívás',
  'nav.badge.pendingInvitations_other': '{count} függőben lévő meghívás',

  'notif.title': 'Értesítések',
  'notif.bellUnread': 'Értesítések, {count} olvasatlan',
  'notif.markAllRead': 'Összes megjelölése olvasottként',
  'notif.loadFailed': 'Az értesítések betöltése nem sikerült.',
  'notif.markFailed': 'Az értesítések olvasottnak jelölése nem sikerült.',
  'notif.empty':
    'Itt még nincs semmi. A csoportmeghívások, az új csoportos kihívások és a kihívások eredményei ebben a listában jelennek meg.',
  'notif.unread': 'Olvasatlan',

  'ui.info.whatIsThis': '{title}: mi ez?',
  'ui.info.close': 'Magyarázat bezárása',
  'ui.error.requestFailed': 'A kérés sikertelen ({status}).',
};
