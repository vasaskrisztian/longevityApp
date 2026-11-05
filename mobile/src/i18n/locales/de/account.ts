import type { Catalog } from '@/src/i18n/translate';
import type { account as en } from '../en/account';

export const account: Catalog<typeof en> = {
  'account.signedInAs': 'Angemeldet als',

  'account.creator.title': 'Öffentliches Creator-Profil',
  'account.creator.publicDescription':
    'Deine öffentlichen Protokolle, Challenges und aktuellen Daten sind für alle im Creator-Verzeichnis sichtbar.',
  'account.creator.privateDescription':
    'Schalte dies ein, damit Follower deine öffentlichen Protokolle, Challenges und aktuellen Daten im Creator-Verzeichnis sehen können.',
  'account.creator.updating': 'Wird aktualisiert…',
  'account.creator.makePrivate': 'Profil auf privat stellen',
  'account.creator.publish': 'Profil öffentlich machen',

  'account.language.saveFailed': 'Die Sprache konnte nicht gespeichert werden. Bitte versuche es erneut.',

  'account.password.title': 'Passwort ändern',
  'account.password.description':
    'Nach der Änderung wirst du auf allen deinen Geräten abgemeldet und meldest dich mit dem neuen Passwort wieder an.',
  'account.password.success': 'Passwort geändert. Du wirst abgemeldet…',
  'account.password.current': 'Aktuelles Passwort',
  'account.password.new': 'Neues Passwort',
  'account.password.repeat': 'Neues Passwort wiederholen',
  'account.password.submit': 'Passwort ändern',
  'account.password.failed': 'Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.',

  'account.sharing.title': 'Wer meine Daten sehen kann',
  'account.sharing.loadFailed': 'Deine Gruppen konnten nicht geladen werden.',
  'account.sharing.none': 'Keine Gruppe kann deine Gesundheitsdaten sehen. Sie sind nur für dich sichtbar.',
  'account.sharing.description':
    'Die Administratoren dieser Gruppen können deine Gesundheitsdaten sehen. Du kannst die Freigabe jederzeit beenden, indem du eine Gruppe verlässt.',
  'account.sharing.leaveTitle': '{name} verlassen?',
  'account.sharing.leaveMessage':
    'Die Administratoren der Gruppe können deine Gesundheitsdaten nicht mehr sehen, und du wirst aus den Challenges der Gruppe entfernt.',
  'account.sharing.leaveConfirm': 'Gruppe verlassen',
  'account.sharing.leaveFailed': 'Die Gruppe konnte nicht verlassen werden. Bitte versuche es erneut.',

  'account.data.title': 'Deine Daten',
  'account.data.description':
    'Die App speichert dein Profil und deine Ziele, Daten von Wearables und Apple Health, InBody-Messungen, Protokolle, Nahrungsergänzungsmittel und den Fortschritt bei Challenges. Deine Daten sind nur für dich sichtbar, dazu für die Administratoren der Gruppen, denen du beigetreten bist, und für die Follower eines öffentlichen Creator-Profils, das du selbst veröffentlicht hast.',
  'account.data.deleteNote': 'Wenn du dein Konto löschst (unten), wird all das dauerhaft entfernt.',

  'account.delete.title': 'Konto löschen',
  'account.delete.description':
    'Löscht dein Konto und alle deine Daten dauerhaft und trennt dein Wearable. Das kann nicht rückgängig gemacht werden.',
  'account.delete.passwordLabel': 'Dein Passwort',
  'account.delete.enterPassword': 'Gib zur Bestätigung dein Passwort ein.',
  'account.delete.confirmTitle': 'Dein Konto löschen?',
  'account.delete.confirmMessage':
    'Dein Konto und alle deine Daten werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.',
  'account.delete.confirmButton': 'Konto löschen',
  'account.delete.failed': 'Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut.',
  'account.delete.submit': 'Mein Konto löschen',
  'account.delete.open': 'Konto löschen…',
};
