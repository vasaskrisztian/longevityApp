import type { Catalog } from '@/src/i18n/translate';
import type { auth as en } from '../en/auth';

export const auth: Catalog<typeof en> = {
  'auth.login.title': 'Anmelden',
  'auth.login.verified': 'Deine E-Mail-Adresse ist bestätigt — du kannst dich jetzt anmelden.',
  'auth.login.enterBoth': 'Gib deine E-Mail-Adresse und dein Passwort ein.',
  'auth.login.invalid': 'Ungültige E-Mail-Adresse oder ungültiges Passwort, oder dein Konto ist noch nicht bestätigt.',
  'auth.login.failed': 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.',
  'auth.login.submit': 'Anmelden',
  'auth.login.submitting': 'Anmeldung läuft…',
  'auth.login.createAccount': 'Konto erstellen',
  'auth.login.forgot': 'Passwort vergessen?',

  'auth.field.email': 'E-Mail',
  'auth.field.password': 'Passwort',
  'auth.field.fullName': 'Vollständiger Name',
  'auth.field.confirmPassword': 'Passwort bestätigen',

  'auth.register.title': 'Konto erstellen',
  'auth.register.passwordHint': 'Mindestens 10 Zeichen, mit Großbuchstabe, Kleinbuchstabe und Ziffer.',
  'auth.register.terms': 'Ich akzeptiere die Nutzungsbedingungen',
  'auth.register.privacy': 'Ich akzeptiere die Datenschutzerklärung',
  'auth.register.submit': 'Konto erstellen',
  'auth.register.submitting': 'Konto wird erstellt…',
  'auth.register.haveAccount': 'Du hast bereits ein Konto?',
  'auth.register.logIn': 'Anmelden',
  'auth.register.checkEmailTitle': 'Prüfe dein Postfach',
  'auth.register.checkEmailBody':
    'Wenn deine E-Mail-Adresse gültig ist, haben wir dir einen Bestätigungslink geschickt. Du musst deine E-Mail-Adresse bestätigen, bevor du dich anmelden kannst.',
  'auth.register.backToLogin': 'Zurück zur Anmeldung',

  'auth.reset.requestTitle': 'Passwort zurücksetzen',
  'auth.reset.send': 'Link zum Zurücksetzen senden',
  'auth.reset.sending': 'Wird gesendet…',
  'auth.reset.sent': 'Wenn diese E-Mail-Adresse registriert ist, haben wir ihr einen Link zum Zurücksetzen geschickt.',
  'auth.reset.backToLogin': 'Zurück zur Anmeldung',
  'auth.reset.confirmTitle': 'Neues Passwort wählen',
  'auth.reset.newPassword': 'Neues Passwort',
  'auth.reset.confirmNewPassword': 'Neues Passwort bestätigen',
  'auth.reset.update': 'Passwort ändern',
  'auth.reset.updating': 'Wird geändert…',
  'auth.reset.linkInvalid': 'Dieser Link zum Zurücksetzen ist ungültig oder abgelaufen.',
  'auth.reset.done': 'Passwort geändert. Du kannst dich jetzt anmelden.',
  'auth.reset.logIn': 'Anmelden',
};
