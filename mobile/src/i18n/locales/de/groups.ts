import type { Catalog } from '@/src/i18n/translate';
import type { groups as en } from '../en/groups';

export const groups: Catalog<typeof en> = {
  // ---- Groups screen (member side)
  'groups.intro':
    'Gruppen, denen du über dein Unternehmen oder Team angehörst. Wenn du einer Gruppe beitrittst, können ihre Administratoren deine Gesundheitsdaten sehen; die Teilnahme an Challenges ist immer freiwillig.',
  'groups.empty':
    'Du bist noch in keiner Gruppe. Wenn dich ein Administrator per E-Mail einlädt, erscheint die Einladung hier.',

  'groups.invitation.validUntil': 'Einladung · gültig bis {date}',
  'groups.invitation.consent':
    'Ich bin damit einverstanden, dass die Administratoren von {name} meine Gesundheitsdaten (Schlaf, Aktivität und andere Messwerte) sehen können. Ich kann die Gruppe jederzeit verlassen.',
  'groups.invitation.accept': 'Annehmen und beitreten',
  'groups.invitation.acceptFailed': 'Die Einladung konnte nicht angenommen werden.',

  'groups.group.summary_one': '{count} Mitglied · beigetreten am {date}',
  'groups.group.summary_other': '{count} Mitglieder · beigetreten am {date}',
  'groups.group.challengesLoadFailed': 'Die Challenges konnten nicht geladen werden.',
  'groups.group.noChallenges': 'Noch keine Challenges. Sobald ein Administrator eine erstellt, wirst du benachrichtigt.',
  'groups.group.leave': 'Diese Gruppe verlassen',

  'groups.challenge.failed': 'Etwas ist schiefgelaufen.',
  'groups.challenge.yourShare': 'Dein Anteil',
  'groups.challenge.you': 'Du',
  'groups.challenge.contributors': '{participants} von {members} Mitgliedern tragen zur Gesamtsumme bei',
  'groups.challenge.team': 'Team: {status}',
  'groups.challenge.joinNote': 'Nur Daten ab dem Tag deines Beitritts zählen – frühere Tage werden nicht hinzugefügt.',
  'groups.challenge.join': 'Dieser Challenge beitreten',
  'groups.challenge.leave': 'Diese Challenge verlassen',
  'groups.challenge.notTakenPart': 'Du hast an dieser Challenge nicht teilgenommen.',

  // ---- Shared building blocks (parts, chart, formatting, create form)
  'wellbeing.logo.alt': 'Gruppenlogo',

  'wellbeing.status.UPCOMING': 'Bevorstehend',
  'wellbeing.status.ACTIVE': 'Aktiv',
  'wellbeing.status.ENDED': 'Beendet',

  'wellbeing.progress.goalReached': '{current} von {required} · Ziel erreicht',
  'wellbeing.progress.percent': '{current} von {required} · {percent} %',

  'wellbeing.daysLeft.last': 'Letzter Tag',
  'wellbeing.daysLeft_one': 'Noch {count} Tag',
  'wellbeing.daysLeft_other': 'Noch {count} Tage',

  'wellbeing.team.nobody': 'Noch niemand ist beigetreten.',
  'wellbeing.team.status_one': '{completed} von {count} Teilnehmenden hat das Ziel erreicht · durchschnittlicher Fortschritt {percent} %',
  'wellbeing.team.status_other':
    '{completed} von {count} Teilnehmenden haben das Ziel erreicht · durchschnittlicher Fortschritt {percent} %',

  'wellbeing.target.collective': 'Erreicht gemeinsam {amount}',
  'wellbeing.target.sleep_one': '{count} Nacht mit einem Schlafwert über {threshold}',
  'wellbeing.target.sleep_other': '{count} Nächte mit einem Schlafwert über {threshold}',
  'wellbeing.target.steps_one': '{count} Tag mit mehr als {threshold} Schritten',
  'wellbeing.target.steps_other': '{count} Tage mit mehr als {threshold} Schritten',
  'wellbeing.target.workouts_one': '{count} Woche mit mehr als {threshold} {workouts}',
  'wellbeing.target.workouts_other': '{count} Wochen mit mehr als {threshold} {workouts}',
  'wellbeing.target.video_one': 'An {count} Tag das Video bis zum Ende ansehen',
  'wellbeing.target.video_other': 'An {count} Tagen das Video bis zum Ende ansehen',

  'wellbeing.unit.steps': 'Schritte',
  'wellbeing.unit.workout_one': 'Workout',
  'wellbeing.unit.workout_other': 'Workouts',
  'wellbeing.unit.videoSession_one': 'Video-Einheit',
  'wellbeing.unit.videoSession_other': 'Video-Einheiten',
  'wellbeing.unit.session_one': 'Einheit',
  'wellbeing.unit.session_other': 'Einheiten',

  'wellbeing.collective.lineReached': '{total} von {target} {unit} · Ziel erreicht',
  'wellbeing.collective.linePercent': '{total} von {target} {unit} · {percent} %',
  'wellbeing.collective.contribution': '{amount} · {percent} % des Teamziels',

  'wellbeing.time.justNow': 'gerade eben',
  'wellbeing.time.minutesAgo': 'vor {count} Min.',
  'wellbeing.time.hoursAgo': 'vor {count} Std.',
  'wellbeing.time.daysAgo': 'vor {count} T.',
  'wellbeing.duration.hoursMinutes': '{hours} Std. {minutes} Min.',

  'wellbeing.chart.empty': 'Das Diagramm erscheint, sobald die Challenge begonnen hat.',
  'wellbeing.chart.title': 'Team-Gesamtwert pro Tag',
  'wellbeing.chart.showTable': 'Als Tabelle anzeigen',
  'wellbeing.chart.hideTable': 'Tabelle ausblenden',
  'wellbeing.chart.a11y': 'Bisheriger Team-Gesamtwert von {total} bei einem Ziel von {target}',
  'wellbeing.chart.target': 'Ziel',
  'wellbeing.chart.targetAmount': 'Ziel {amount}',
  'wellbeing.chart.teamTotal': 'Team gesamt',
  'wellbeing.chart.day': 'Tag',
  'wellbeing.chart.thatDay': 'An dem Tag',

  'wellbeing.form.steps.typeLabel': 'Schritte',
  'wellbeing.form.steps.label': 'Gesamtzahl der Schritte im Team',
  'wellbeing.form.steps.hint':
    'Alle Schritte aller Teilnehmenden werden vom ersten bis zum letzten Tag addiert – es gibt kein Tagesziel, nur die Gesamtsumme zählt.',
  'wellbeing.form.workouts.typeLabel': 'Workouts',
  'wellbeing.form.workouts.label': 'Gesamtzahl der Workouts im Team',
  'wellbeing.form.workouts.hint':
    'Alle Workouts aller Teilnehmenden werden vom ersten bis zum letzten Tag addiert – es gibt kein Wochenziel, nur die Gesamtsumme zählt.',
  'wellbeing.form.video.typeLabel': 'Video',
  'wellbeing.form.video.label': 'Gesamtzahl der Video-Einheiten im Team',
  'wellbeing.form.video.hint':
    'Alle Teilnehmenden schauen das Video bis zum Ende; jede Person kann pro Tag eine Einheit sammeln. Die Einheiten des ganzen Teams werden addiert.',
  'wellbeing.form.wholeNumber': 'Gib eine ganze Zahl ein, mindestens 1.',
  'wellbeing.form.videoUrlRequired': 'Füge den YouTube-Link des Videos ein.',
  'wellbeing.form.videoUrlInvalid': 'Das ist kein YouTube-Video-Link.',
  'wellbeing.form.videoDurationInvalid': 'Gib die Länge als m:ss ein, zum Beispiel 5:00 – oder lass das Feld leer.',

  'wellbeing.error.requestFailed': 'Anfrage fehlgeschlagen ({status}).',
  'wellbeing.error.ended': 'Diese Challenge ist bereits beendet.',
  'wellbeing.error.notFound': 'Nicht gefunden.',
  'wellbeing.error.notMember': 'Du bist kein Mitglied dieser Gruppe.',
  'wellbeing.error.invalidDates': 'Die Challenge darf nicht in der Vergangenheit enden.',

  // ---- Video challenge
  'video.joinToWatch': 'Tritt der Challenge bei, um das Video anzusehen und Einheiten zu sammeln.',
  'video.counted_one': 'Gezählt – du hast bisher {count} Einheit. Gut gemacht!',
  'video.counted_other': 'Gezählt – du hast bisher {count} Einheiten. Gut gemacht!',
  'video.alreadyCounted': 'Du hast das Video heute schon zu Ende geschaut, daher wird es nicht noch einmal gezählt.',
  'video.doneToday': 'Du hast das heutige Video geschafft. Komm morgen für die nächste Einheit wieder.',
  'video.watchAgain': 'Nochmal ansehen (zählt nicht)',
  'video.watchToday': 'Heutiges Video ansehen ({duration})',
  'video.disclaimer':
    'Das ist ein leichtes Bewegungsvideo für das allgemeine Wohlbefinden und kein medizinischer Rat. Mach nur, was sich gut anfühlt, und brich ab, wenn du Schmerzen oder Schwindel spürst. Die Teilnahme ist freiwillig. Das Video zählt, sobald es bis zum Ende gelaufen ist – Vorspulen zählt nicht.',
  'video.start': 'Video starten',
  'video.starting': 'Wird gestartet…',
  'video.watched': 'Angesehen',
  'video.watchedOf': '{watched} von {total}',
  'video.counting': 'Deine Einheit wird gezählt…',
  'video.watchHint': 'Schau bis zum Ende, um eine Einheit hinzuzufügen. Die Wiedergabegeschwindigkeit bleibt normal.',
  'video.stop': 'Stopp',
  'video.countFailed': 'Das Video konnte nicht gezählt werden.',
  'video.startFailed': 'Das Video konnte nicht gestartet werden.',
  'video.notEnough':
    'Nur {watched} von {total} wurden als angesehen gezählt. Es zählt nur durchgehendes Abspielen in normaler Geschwindigkeit – Vorspulen, Zurückspulen und Pausieren zählen nicht. Starte das Video erneut, um es noch einmal zu versuchen.',

  'video.player.embed':
    'Dieses Video kann nicht in der App abgespielt werden. Bitte den Administrator, ein Video zu verwenden, das Einbettung erlaubt.',
  'video.player.unavailable': 'Dieses Video ist nicht mehr verfügbar.',
  'video.player.generic': 'Das Video konnte nicht abgespielt werden. Prüfe deine Verbindung und versuche es erneut.',

  'video.refused.tooEarly': 'Das Video wurde noch nicht lange genug abgespielt.',
  'video.refused.notWatched': 'Das Video wurde nicht bis zum Ende angesehen.',
  'video.refused.expired': 'Diese Wiedergabe ist abgelaufen – starte das Video erneut.',
  'video.refused.watchNotFound': 'Diese Wiedergabe wurde nicht gestartet oder ist bereits verbraucht.',
  'video.refused.notActive': 'Diese Challenge läuft gerade nicht.',
  'video.refused.notParticipant': 'Tritt zuerst der Challenge bei.',
  'video.refused.notVideo': 'Diese Challenge hat kein Video.',
  'video.refused.unavailable': 'Dieses Video ist nicht verfügbar.',
};
