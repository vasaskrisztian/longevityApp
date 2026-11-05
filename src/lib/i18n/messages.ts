import type { Language } from '@/lib/i18n/languages';
import { translate, type Messages, type Params } from '@/lib/i18n/translate';

/**
 * Texts the SERVER writes in a person's language: emails, notifications and
 * the sentences describing a challenge. Keys group by `email.*`, `notif.*`
 * and `challenge.*`. English is the source (and exactly what was sent before
 * languages existed); a test checks hu and de have the same keys and
 * placeholders.
 */
const en = {
  'email.verify.subject': 'Confirm your email — Longevity Klub',
  'email.verify.html':
    "<p>Welcome to Longevity Klub! Confirm your email address to finish creating your account:</p><p><a href=\"{url}\">{url}</a></p><p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>",
  'email.verify.text':
    "Welcome to Longevity Klub! Confirm your email address to finish creating your account:\n{url}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.",

  'email.reset.subject': 'Reset your password — Longevity Klub',
  'email.reset.html':
    "<p>We received a request to reset your Longevity Klub password. Click the link below to choose a new one:</p><p><a href=\"{url}\">{url}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't be changed.</p>",
  'email.reset.text':
    "We received a request to reset your Longevity Klub password. Open this link to choose a new one:\n{url}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't be changed.",

  'email.invite.subject': 'You are invited to {group} — Longevity Klub',
  'email.invite.by': ' by {inviter}',
  'email.invite.html.intro':
    'You have been invited{by} to join <strong>{group}</strong> on Longevity Klub, a wellbeing programme where you can take part in group challenges.',
  'email.invite.html.button': 'View the invitation',
  'email.invite.html.orLink': 'Or open this link:',
  'email.invite.outro':
    "When you accept, the group's administrators will be able to see your health data (sleep, activity and other measurements). You can leave the group at any time. The invitation is valid until {expires}. If you were not expecting it, you can ignore this email.",
  'email.invite.text.intro':
    'You have been invited{by} to join {group} on Longevity Klub, a wellbeing programme where you can take part in group challenges.',
  'email.invite.text.view': 'View the invitation:',

  'notif.invitation.title': 'Invitation to {group}',
  'notif.invitation.body':
    "You have been invited to join {group}. Accepting lets the group's administrators see your health data; you can leave at any time.",

  'challenge.unit.steps': '{amount} steps',
  'challenge.unit.videoSession_one': '{amount} video session',
  'challenge.unit.videoSession_other': '{amount} video sessions',
  'challenge.unit.workout_one': '{amount} workout',
  'challenge.unit.workout_other': '{amount} workouts',
  'challenge.word.workout_one': 'workout',
  'challenge.word.workout_other': 'workouts',
  'challenge.target.collective': 'Together reach {amount}',
  'challenge.target.sleep_one': '{count} night with a sleep score above {threshold}',
  'challenge.target.sleep_other': '{count} nights with a sleep score above {threshold}',
  'challenge.target.steps_one': '{count} day with more than {threshold} steps',
  'challenge.target.steps_other': '{count} days with more than {threshold} steps',
  'challenge.target.workouts_one': '{count} week with more than {threshold} {workouts}',
  'challenge.target.workouts_other': '{count} weeks with more than {threshold} {workouts}',
  'challenge.target.video_one': 'Watch the video to the end on {count} day',
  'challenge.target.video_other': 'Watch the video to the end on {count} days',
  'challenge.range': 'from {from} to {to}',

  'notif.new.teamVideo.title': 'New team video challenge: {name}',
  'notif.new.teamVideo.body':
    '{group} started a team video challenge — {target}, {range}. Watch the video to the end (once a day counts) to add to the shared total. Join it from the Wellbeing page if you want to take part.',
  'notif.new.team.title': 'New team challenge: {name}',
  'notif.new.team.body':
    '{group} started a team challenge — {target}, {range}. Everyone who joins adds to the shared total. Join it from the Wellbeing page if you want to take part.',
  'notif.new.video.title': 'New video challenge: {name}',
  'notif.new.video.body':
    '{group} started a video challenge — {target}, {range}. Join it from the Wellbeing page if you want to take part.',
  'notif.new.group.title': 'New group challenge: {name}',
  'notif.new.group.body':
    '{group} started a challenge — {target}, {range}. Join it from the Wellbeing page if you want to take part.',

  'notif.goal.title': 'Team goal reached: {name}',
  'notif.goal.lastDay': 'on the last day',
  'notif.goal.daysToGo': 'with {days} days still to go',
  'notif.goal.participant':
    '{group} — together you have added up {total} (target {target}) {left}. Thank you for taking part — keep going if you like, everything you add still counts towards the final result.',
  'notif.goal.creator': '{group} — the team has reached the target of "{name}": {total} of {target} {left}.',

  'notif.teamDone.title': 'Team challenge finished: {name}',
  'notif.teamDone.reached': 'Goal reached: the team added up {total} of {target}.',
  'notif.teamDone.notReached': 'The team added up {total} of {target} ({percent}%).',
  'notif.teamDone.participant': '{group} — {result} Your share: {share}. {people}',
  'notif.teamDone.people_one': '{count} person took part.',
  'notif.teamDone.people_other': '{count} people took part.',
  'notif.teamDone.stateReached': 'goal reached',
  'notif.teamDone.stateMissed': 'goal missed',
  'notif.teamDone.creator':
    '{group} — {state}: {total} of {target} ({percent}%), {participants} of {members} members took part.',

  'notif.done.title': 'Challenge finished: {name}',
  'notif.done.mineReached': 'You reached the goal ({current} of {required}).',
  'notif.done.mineNot': 'You got to {current} of {required} ({percent}%).',
  'notif.done.team_one':
    'Team: {completed} of {count} participant reached the goal, average progress {average}%.',
  'notif.done.team_other':
    'Team: {completed} of {count} participants reached the goal, average progress {average}%.',
  'notif.done.participant': '{group} — {mine} {teamLine}',
  'notif.done.creator':
    '{group} — {participants} of {members} members took part; {completed} reached the goal, average progress {average}%.',
} as const;

const hu: Record<keyof typeof en, string> = {
  'email.verify.subject': 'Erősítsd meg az e-mail-címedet — Longevity Klub',
  'email.verify.html':
    '<p>Üdvözlünk a Longevity Klubban! Erősítsd meg az e-mail-címedet a fiókod létrehozásának befejezéséhez:</p><p><a href="{url}">{url}</a></p><p>A link 24 óráig érvényes. Ha nem te hoztad létre ezt a fiókot, nyugodtan figyelmen kívül hagyhatod ezt a levelet.</p>',
  'email.verify.text':
    'Üdvözlünk a Longevity Klubban! Erősítsd meg az e-mail-címedet a fiókod létrehozásának befejezéséhez:\n{url}\n\nA link 24 óráig érvényes. Ha nem te hoztad létre ezt a fiókot, nyugodtan figyelmen kívül hagyhatod ezt a levelet.',

  'email.reset.subject': 'Jelszó visszaállítása — Longevity Klub',
  'email.reset.html':
    '<p>Kérést kaptunk a Longevity Klub jelszavad visszaállítására. Az alábbi linkre kattintva választhatsz új jelszót:</p><p><a href="{url}">{url}</a></p><p>A link 1 óráig érvényes. Ha nem te kérted, nyugodtan figyelmen kívül hagyhatod ezt a levelet — a jelszavad nem változik.</p>',
  'email.reset.text':
    'Kérést kaptunk a Longevity Klub jelszavad visszaállítására. Ezen a linken választhatsz új jelszót:\n{url}\n\nA link 1 óráig érvényes. Ha nem te kérted, nyugodtan figyelmen kívül hagyhatod ezt a levelet — a jelszavad nem változik.',

  'email.invite.subject': 'Meghívást kaptál ide: {group} — Longevity Klub',
  'email.invite.by': ' ({inviter} által)',
  'email.invite.html.intro':
    'Meghívást kaptál{by}, hogy csatlakozz a(z) <strong>{group}</strong> csoporthoz a Longevity Klubban — ez egy jóllétprogram, amelyben csoportos kihívásokban vehetsz részt.',
  'email.invite.html.button': 'Meghívás megtekintése',
  'email.invite.html.orLink': 'Vagy nyisd meg ezt a linket:',
  'email.invite.outro':
    'Az elfogadással a csoport vezetői láthatják az egészségügyi adataidat (alvás, aktivitás és egyéb mérések). A csoportot bármikor elhagyhatod. A meghívás eddig érvényes: {expires}. Ha nem számítottál rá, nyugodtan figyelmen kívül hagyhatod ezt a levelet.',
  'email.invite.text.intro':
    'Meghívást kaptál{by}, hogy csatlakozz a(z) {group} csoporthoz a Longevity Klubban — ez egy jóllétprogram, amelyben csoportos kihívásokban vehetsz részt.',
  'email.invite.text.view': 'Meghívás megtekintése:',

  'notif.invitation.title': 'Meghívás: {group}',
  'notif.invitation.body':
    'Meghívást kaptál a(z) {group} csoportba. Az elfogadással a csoport vezetői láthatják az egészségügyi adataidat; bármikor kiléphetsz.',

  'challenge.unit.steps': '{amount} lépés',
  'challenge.unit.videoSession_one': '{amount} videós alkalom',
  'challenge.unit.videoSession_other': '{amount} videós alkalom',
  'challenge.unit.workout_one': '{amount} edzés',
  'challenge.unit.workout_other': '{amount} edzés',
  'challenge.word.workout_one': 'edzés',
  'challenge.word.workout_other': 'edzés',
  'challenge.target.collective': 'Együtt érjetek el {amount}',
  'challenge.target.sleep_one': '{count} éjszaka {threshold} feletti alvási pontszámmal',
  'challenge.target.sleep_other': '{count} éjszaka {threshold} feletti alvási pontszámmal',
  'challenge.target.steps_one': '{count} nap, amelyen több mint {threshold} lépést teszel',
  'challenge.target.steps_other': '{count} nap, amelyen több mint {threshold} lépést teszel',
  'challenge.target.workouts_one': '{count} hét, amelyben több mint {threshold} {workouts} van',
  'challenge.target.workouts_other': '{count} hét, amelyben több mint {threshold} {workouts} van',
  'challenge.target.video_one': 'Nézd végig a videót {count} napon',
  'challenge.target.video_other': 'Nézd végig a videót {count} napon',
  'challenge.range': '{from} és {to} között',

  'notif.new.teamVideo.title': 'Új csapat-videókihívás: {name}',
  'notif.new.teamVideo.body':
    'A(z) {group} csapat-videókihívást indított — {target}, {range}. Nézd végig a videót (naponta egyszer számít), hogy hozzájárulj a közös összeghez. Ha részt szeretnél venni, csatlakozz a Jóllét oldalon.',
  'notif.new.team.title': 'Új csapatkihívás: {name}',
  'notif.new.team.body':
    'A(z) {group} csapatkihívást indított — {target}, {range}. Mindenki, aki csatlakozik, hozzáad a közös összeghez. Ha részt szeretnél venni, csatlakozz a Jóllét oldalon.',
  'notif.new.video.title': 'Új videókihívás: {name}',
  'notif.new.video.body':
    'A(z) {group} videókihívást indított — {target}, {range}. Ha részt szeretnél venni, csatlakozz a Jóllét oldalon.',
  'notif.new.group.title': 'Új csoportos kihívás: {name}',
  'notif.new.group.body':
    'A(z) {group} kihívást indított — {target}, {range}. Ha részt szeretnél venni, csatlakozz a Jóllét oldalon.',

  'notif.goal.title': 'Csapatcél elérve: {name}',
  'notif.goal.lastDay': 'az utolsó napon',
  'notif.goal.daysToGo': 'még {days} nappal a vége előtt',
  'notif.goal.participant':
    '{group} — együtt {total} gyűlt össze (cél: {target}) {left}. Köszönjük, hogy részt vettél — folytathatod, minden, amit hozzáadsz, továbbra is beleszámít a végeredménybe.',
  'notif.goal.creator': '{group} — a csapat elérte a(z) „{name}” célját: {total} (cél: {target}) {left}.',

  'notif.teamDone.title': 'Csapatkihívás lezárult: {name}',
  'notif.teamDone.reached': 'Cél elérve: a csapat eredménye {total} (cél: {target}).',
  'notif.teamDone.notReached': 'A csapat eredménye {total} (cél: {target}, {percent}%).',
  'notif.teamDone.participant': '{group} — {result} A te részed: {share}. {people}',
  'notif.teamDone.people_one': '{count} ember vett részt.',
  'notif.teamDone.people_other': '{count} ember vett részt.',
  'notif.teamDone.stateReached': 'cél elérve',
  'notif.teamDone.stateMissed': 'cél nem teljesült',
  'notif.teamDone.creator':
    '{group} — {state}: {total} (cél: {target}, {percent}%), a {members} tagból {participants} vett részt.',

  'notif.done.title': 'Kihívás lezárult: {name}',
  'notif.done.mineReached': 'Elérted a célt ({current} / {required}).',
  'notif.done.mineNot': '{current} / {required} lett ({percent}%).',
  'notif.done.team_one': 'Csapat: {count} résztvevőből {completed} érte el a célt, az átlagos teljesítés {average}%.',
  'notif.done.team_other': 'Csapat: {count} résztvevőből {completed} érte el a célt, az átlagos teljesítés {average}%.',
  'notif.done.participant': '{group} — {mine} {teamLine}',
  'notif.done.creator':
    '{group} — a {members} tagból {participants} vett részt; {completed} érte el a célt, az átlagos teljesítés {average}%.',
};

const de: Record<keyof typeof en, string> = {
  'email.verify.subject': 'Bestätige deine E-Mail-Adresse — Longevity Klub',
  'email.verify.html':
    '<p>Willkommen beim Longevity Klub! Bestätige deine E-Mail-Adresse, um die Erstellung deines Kontos abzuschließen:</p><p><a href="{url}">{url}</a></p><p>Dieser Link ist 24 Stunden gültig. Wenn du dieses Konto nicht erstellt hast, kannst du diese E-Mail ignorieren.</p>',
  'email.verify.text':
    'Willkommen beim Longevity Klub! Bestätige deine E-Mail-Adresse, um die Erstellung deines Kontos abzuschließen:\n{url}\n\nDieser Link ist 24 Stunden gültig. Wenn du dieses Konto nicht erstellt hast, kannst du diese E-Mail ignorieren.',

  'email.reset.subject': 'Passwort zurücksetzen — Longevity Klub',
  'email.reset.html':
    '<p>Wir haben eine Anfrage erhalten, dein Longevity-Klub-Passwort zurückzusetzen. Über den folgenden Link kannst du ein neues wählen:</p><p><a href="{url}">{url}</a></p><p>Dieser Link ist 1 Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.</p>',
  'email.reset.text':
    'Wir haben eine Anfrage erhalten, dein Longevity-Klub-Passwort zurückzusetzen. Über diesen Link kannst du ein neues wählen:\n{url}\n\nDieser Link ist 1 Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.',

  'email.invite.subject': 'Du bist eingeladen: {group} — Longevity Klub',
  'email.invite.by': ' von {inviter}',
  'email.invite.html.intro':
    'Du wurdest{by} eingeladen, der Gruppe <strong>{group}</strong> beim Longevity Klub beizutreten — einem Wellbeing-Programm, in dem du an Gruppen-Challenges teilnehmen kannst.',
  'email.invite.html.button': 'Einladung ansehen',
  'email.invite.html.orLink': 'Oder öffne diesen Link:',
  'email.invite.outro':
    'Wenn du annimmst, können die Administratoren der Gruppe deine Gesundheitsdaten sehen (Schlaf, Aktivität und weitere Messwerte). Du kannst die Gruppe jederzeit verlassen. Die Einladung ist bis {expires} gültig. Wenn du sie nicht erwartet hast, kannst du diese E-Mail ignorieren.',
  'email.invite.text.intro':
    'Du wurdest{by} eingeladen, der Gruppe {group} beim Longevity Klub beizutreten — einem Wellbeing-Programm, in dem du an Gruppen-Challenges teilnehmen kannst.',
  'email.invite.text.view': 'Einladung ansehen:',

  'notif.invitation.title': 'Einladung zu {group}',
  'notif.invitation.body':
    'Du wurdest eingeladen, der Gruppe {group} beizutreten. Wenn du annimmst, können die Administratoren der Gruppe deine Gesundheitsdaten sehen; du kannst jederzeit austreten.',

  'challenge.unit.steps': '{amount} Schritte',
  'challenge.unit.videoSession_one': '{amount} Video-Einheit',
  'challenge.unit.videoSession_other': '{amount} Video-Einheiten',
  'challenge.unit.workout_one': '{amount} Workout',
  'challenge.unit.workout_other': '{amount} Workouts',
  'challenge.word.workout_one': 'Workout',
  'challenge.word.workout_other': 'Workouts',
  'challenge.target.collective': 'Erreicht gemeinsam {amount}',
  'challenge.target.sleep_one': '{count} Nacht mit einem Schlafwert über {threshold}',
  'challenge.target.sleep_other': '{count} Nächte mit einem Schlafwert über {threshold}',
  'challenge.target.steps_one': '{count} Tag mit mehr als {threshold} Schritten',
  'challenge.target.steps_other': '{count} Tage mit mehr als {threshold} Schritten',
  'challenge.target.workouts_one': '{count} Woche mit mehr als {threshold} {workouts}',
  'challenge.target.workouts_other': '{count} Wochen mit mehr als {threshold} {workouts}',
  'challenge.target.video_one': 'An {count} Tag das Video bis zum Ende ansehen',
  'challenge.target.video_other': 'An {count} Tagen das Video bis zum Ende ansehen',
  'challenge.range': 'vom {from} bis {to}',

  'notif.new.teamVideo.title': 'Neue Team-Video-Challenge: {name}',
  'notif.new.teamVideo.body':
    '{group} hat eine Team-Video-Challenge gestartet — {target}, {range}. Sieh dir das Video bis zum Ende an (einmal pro Tag zählt), um zur gemeinsamen Summe beizutragen. Tritt ihr auf der Wellbeing-Seite bei, wenn du mitmachen möchtest.',
  'notif.new.team.title': 'Neue Team-Challenge: {name}',
  'notif.new.team.body':
    '{group} hat eine Team-Challenge gestartet — {target}, {range}. Alle, die beitreten, tragen zur gemeinsamen Summe bei. Tritt ihr auf der Wellbeing-Seite bei, wenn du mitmachen möchtest.',
  'notif.new.video.title': 'Neue Video-Challenge: {name}',
  'notif.new.video.body':
    '{group} hat eine Video-Challenge gestartet — {target}, {range}. Tritt ihr auf der Wellbeing-Seite bei, wenn du mitmachen möchtest.',
  'notif.new.group.title': 'Neue Gruppen-Challenge: {name}',
  'notif.new.group.body':
    '{group} hat eine Challenge gestartet — {target}, {range}. Tritt ihr auf der Wellbeing-Seite bei, wenn du mitmachen möchtest.',

  'notif.goal.title': 'Teamziel erreicht: {name}',
  'notif.goal.lastDay': 'am letzten Tag',
  'notif.goal.daysToGo': 'mit noch {days} Tagen Zeit',
  'notif.goal.participant':
    '{group} — zusammen habt ihr {total} erreicht (Ziel {target}) {left}. Danke fürs Mitmachen — macht gern weiter, alles, was ihr hinzufügt, zählt weiterhin zum Endergebnis.',
  'notif.goal.creator': '{group} — das Team hat das Ziel von „{name}“ erreicht: {total} von {target} {left}.',

  'notif.teamDone.title': 'Team-Challenge beendet: {name}',
  'notif.teamDone.reached': 'Ziel erreicht: Das Team hat {total} von {target} erreicht.',
  'notif.teamDone.notReached': 'Das Team hat {total} von {target} erreicht ({percent} %).',
  'notif.teamDone.participant': '{group} — {result} Dein Anteil: {share}. {people}',
  'notif.teamDone.people_one': '{count} Person hat teilgenommen.',
  'notif.teamDone.people_other': '{count} Personen haben teilgenommen.',
  'notif.teamDone.stateReached': 'Ziel erreicht',
  'notif.teamDone.stateMissed': 'Ziel verfehlt',
  'notif.teamDone.creator':
    '{group} — {state}: {total} von {target} ({percent} %), {participants} von {members} Mitgliedern haben teilgenommen.',

  'notif.done.title': 'Challenge beendet: {name}',
  'notif.done.mineReached': 'Du hast das Ziel erreicht ({current} von {required}).',
  'notif.done.mineNot': 'Du hast {current} von {required} geschafft ({percent} %).',
  'notif.done.team_one': 'Team: {completed} von {count} Teilnehmer hat das Ziel erreicht, durchschnittlicher Fortschritt {average} %.',
  'notif.done.team_other':
    'Team: {completed} von {count} Teilnehmern haben das Ziel erreicht, durchschnittlicher Fortschritt {average} %.',
  'notif.done.participant': '{group} — {mine} {teamLine}',
  'notif.done.creator':
    '{group} — {participants} von {members} Mitgliedern haben teilgenommen; {completed} haben das Ziel erreicht, durchschnittlicher Fortschritt {average} %.',
};

export type ServerMessageKey = keyof typeof en;
/** Plural pairs are called by their base name. */
export type ServerTextKey = ServerMessageKey extends infer K ? (K extends `${infer B}_${'one' | 'other'}` ? B : K) : never;

export const serverCatalogs: Record<Language, Messages> = { en, hu, de };

export function st(language: Language, key: ServerTextKey, params?: Params): string {
  return translate(serverCatalogs, language, key, params);
}

/** Lower-cases only the first letter ("Together reach …" → "together reach …"; German nouns stay capitalised). */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
