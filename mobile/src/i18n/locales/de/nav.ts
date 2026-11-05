import type { Catalog } from '@/src/i18n/translate';
import type { nav as en } from '../en/nav';

export const nav: Catalog<typeof en> = {
  'nav.tab.today': 'Heute',
  'nav.tab.plan': 'Plan',
  'nav.tab.community': 'Community',
  'nav.tab.me': 'Ich',
  'nav.tab.notifications': 'Benachrichtigungen',
  'nav.tab.admin': 'Admin',

  'nav.segment.today': 'Heute',
  'nav.segment.trends': 'Trends',
  'nav.segment.body': 'Körper',
  'nav.segment.personal': 'Persönlich',
  'nav.segment.exercise': 'Training',
  'nav.segment.nutrition': 'Ernährung',
  'nav.segment.groups': 'Gruppen',
  'nav.segment.creators': 'Creators',
  'nav.segment.users': 'Nutzer',

  'nav.me.about': 'Über mich',
  'nav.me.aboutDescription': 'Persönliche Angaben, Training, Ernährung',
  'nav.me.devices': 'Geräte',
  'nav.me.devicesAndData': 'Geräte und Daten',
  'nav.me.devicesDescription': 'Oura, Apple Health und Synchronisierung',
  'nav.me.account': 'Konto',
  'nav.me.accountDescription': 'Anmeldung, öffentliches Profil',

  'nav.plan.intro': 'Was du befolgst und was du erreichen willst.',
  'nav.plan.protocols': 'Protokolle und Ziele',
  'nav.plan.protocolsDescription': 'Die Routine, der du folgst, ihre Tagesziele und die Ziele dahinter',
  'nav.plan.supplements': 'Nahrungsergänzungsmittel',
  'nav.plan.supplementsDescription': 'Alles, was du einnimmst; Protokolle wählen aus dieser Liste',
  'nav.plan.goals': 'Ziele',
  'nav.plan.challenges': 'Meine Challenges',
  'nav.plan.challengesDescription': 'Challenges, die du dir selbst setzt',
  'nav.plan.following': 'Du folgst aktuell',
  'nav.plan.noActiveProtocol': 'Noch kein aktives Protokoll. Öffne die Protokolle, um eines auszuwählen oder zu erstellen.',

  'nav.community.creators': 'Creators',
  'nav.community.creator': 'Creator',

  'nav.admin.person': 'Person',
  'nav.admin.group': 'Gruppe',
  'nav.admin.challenge': 'Challenge',

  'nav.notFound.title': 'Nicht gefunden',
  'nav.notFound.heading': 'Diese Seite gibt es nicht',
  'nav.notFound.body': 'Der Link ist vielleicht veraltet oder falsch geschrieben. Deine Daten sind sicher – geh zurück zum Start.',
  'nav.notFound.goHome': 'Zur Übersicht',

  'nav.public.createAccount': 'Kostenloses Konto erstellen',
  'nav.public.haveAccount': 'Ich habe schon ein Konto',

  'nav.badge.unread': '{count} ungelesen',
  'nav.badge.pendingInvitations_one': '{count} ausstehende Einladung',
  'nav.badge.pendingInvitations_other': '{count} ausstehende Einladungen',

  'notif.title': 'Benachrichtigungen',
  'notif.bellUnread': 'Benachrichtigungen, {count} ungelesen',
  'notif.markAllRead': 'Alle als gelesen markieren',
  'notif.loadFailed': 'Deine Benachrichtigungen konnten nicht geladen werden.',
  'notif.markFailed': 'Die Benachrichtigungen konnten nicht als gelesen markiert werden.',
  'notif.empty':
    'Noch nichts da. Gruppeneinladungen, neue Gruppen-Challenges und Challenge-Ergebnisse erscheinen in dieser Liste.',
  'notif.unread': 'Ungelesen',

  'ui.info.whatIsThis': '{title}: Was ist das?',
  'ui.info.close': 'Erklärung schließen',
  'ui.error.requestFailed': 'Anfrage fehlgeschlagen ({status}).',
};
