import type { Catalog } from '@/src/i18n/translate';
import type { content as en } from '../en/content';

export const content: Catalog<typeof en> = {
  // Used by InfoLabel / InfoTipHost
  'glossary.whatIsThis': '{title}: Was ist das?',
  'glossary.closeExplanation': 'Erklärung schließen',

  // Today / Trends
  'glossary.sleepScore.title': 'Schlafwert',
  'glossary.sleepScore.text':
    'Eine Zusammenfassung deines Schlafs der letzten Nacht von 0 bis 100, berechnet von deinem Wearable. Sie berücksichtigt, wie lange, wie tief und wie ungestört du geschlafen hast. Höher ist besser; die genaue Formel stammt vom Gerätehersteller.',
  'glossary.readinessScore.title': 'Bereitschaftswert',
  'glossary.readinessScore.text':
    'Eine Schätzung deines Wearables von 0 bis 100, wie bereit dein Körper für den Tag ist – basierend auf deinem Schlaf, deinem Ruhepuls, deiner HRV und deiner jüngsten Aktivität. Höher bedeutet bessere Erholung.',
  'glossary.activityScore.title': 'Aktivitätswert',
  'glossary.activityScore.text':
    'Eine Zusammenfassung deines Wearables von 0 bis 100, wie aktiv du warst: Bewegung über den Tag, Trainingsumfang und wie gut du Aktivität und Erholung ausbalanciert hast.',
  'glossary.scores.title': 'Schlaf-, Bereitschafts- und Aktivitätswert',
  'glossary.scores.text':
    'Drei Zusammenfassungen von 0 bis 100, die dein Wearable berechnet. Schlaf beschreibt die letzte Nacht, Bereitschaft, wie erholt du wirkst, und Aktivität, wie aktiv du warst. Mit den Chips blendest du einen, zwei oder alle drei ein.',
  'glossary.hrv.title': 'HRV (Herzfrequenzvariabilität)',
  'glossary.hrv.text':
    'Die kleinen Schwankungen der Zeit zwischen zwei Herzschlägen, nachts in Millisekunden gemessen. Sie ist meist höher, wenn du ausgeruht bist, und niedriger nach Stress, schlechtem Schlaf oder hartem Training. Sie ist individuell: Vergleiche sie mit deinen eigenen üblichen Werten, nicht mit denen anderer.',
  'glossary.restingHr.title': 'Ruhepuls',
  'glossary.restingHr.text':
    'Dein typischer niedrigster Puls in Ruhe, meist im Schlaf gemessen, in Schlägen pro Minute (bpm). Er steigt oft bei Stress, Krankheit, Alkohol oder zu wenig Erholung und sinkt mit besserer Fitness und Regeneration.',
  'glossary.sleepDuration.title': 'Schlafdauer',
  'glossary.sleepDuration.text':
    'Die gesamte Zeit, die du letzte Nacht geschlafen hast (nicht die Zeit im Bett), in Stunden und Minuten. Dein Protokoll kann dafür ein Ziel festlegen.',
  'glossary.steps.title': 'Schritte',
  'glossary.steps.text':
    'Die Schritte, die dein Wearable oder Smartphone für den Tag zählt. Die heutige Zahl wächst bis zum Ende des Tages weiter.',
  'glossary.activeCalories.title': 'Aktive Kalorien',
  'glossary.activeCalories.text':
    'Die durch Bewegung und Sport verbrannte Energie, ohne die Kalorien, die dein Körper allein zum Leben braucht (das ist der Grundumsatz, BMR).',
  'glossary.workouts.title': 'Workouts (letzte 7 Tage)',
  'glossary.workouts.text':
    'Einzelne Workouts der letzten 7 Tage, den heutigen Tag eingeschlossen. Wird dasselbe Workout von zwei Geräten aufgezeichnet, zählt es nur einmal.',
  'glossary.baseline.title': 'Persönlicher Basiswert',
  'glossary.baseline.text':
    'Deine eigenen üblichen Werte: der Durchschnitt deiner letzten 30 Tage. Die Zusammenfassung vergleicht deine letzten 3 Tage damit, deshalb braucht sie etwa eine Woche an Daten, bevor sie etwas aussagen kann.',

  // Body (InBody)
  'glossary.weightKg.title': 'Gewicht',
  'glossary.weightKg.text':
    'Dein gesamtes Körpergewicht zum Zeitpunkt der Messung. Es umfasst Fett, Muskeln, Knochen und Wasser, deshalb sind Schwankungen von Tag zu Tag meist Wasser.',
  'glossary.bodyFatPercentage.title': 'Körperfett',
  'glossary.bodyFatPercentage.text':
    'Der Anteil deines Körpergewichts, der aus Fett besteht, in Prozent. Etwas Fett ist notwendig und gesund; was typisch ist, hängt von Alter und Geschlecht ab. Achte eher auf den Verlauf über Wochen als auf einzelne Messungen.',
  'glossary.skeletalMuscleMassKg.title': 'Skelettmuskelmasse',
  'glossary.skeletalMuscleMassKg.text':
    'Das Gewicht der Muskeln, die du zur Bewegung willentlich steuerst (Arme, Beine, Rumpf), in Kilogramm. Das ist die Muskulatur, die Krafttraining aufbaut.',
  'glossary.fatFreeMassKg.title': 'Fettfreie Masse',
  'glossary.fatFreeMassKg.text':
    'Alles in deinem Körper, was kein Fett ist: Muskeln, Knochen, Organe und Wasser, in Kilogramm. Gewicht minus Fettmasse.',
  'glossary.bmi.title': 'BMI (Body-Mass-Index)',
  'glossary.bmi.text':
    'Gewicht geteilt durch die Körpergröße zum Quadrat. Eine grobe Orientierungszahl, die Muskeln nicht von Fett unterscheidet – ein muskulöser Mensch kann daher einen hohen BMI haben, ohne zusätzliches Fett zu tragen.',
  'glossary.inBodyScore.title': 'InBody-Wert',
  'glossary.inBodyScore.text':
    'Eine Zusammenfassung deiner gesamten Körperzusammensetzung von 0 bis 100 durch das InBody-Gerät, vor allem das Verhältnis von Muskeln und Fett. Es ist der geräteigene Wert.',
  'glossary.visceralFatLevel.title': 'Viszeralfett-Level',
  'glossary.visceralFatLevel.text':
    'Ein Index für das Fett, das tief im Bauchraum um die Organe gespeichert ist. Niedriger ist im Allgemeinen besser; nach dem InBody-eigenen Leitfaden gelten etwa 1–9 als normal und 10 und höher als hoch.',
  'glossary.basalMetabolicRateKcal.title': 'BMR (Grundumsatz)',
  'glossary.basalMetabolicRateKcal.text':
    'Die Energie, die dein Körper in völliger Ruhe nur für seine Grundfunktionen braucht (Atmung, Kreislauf, Temperatur), in Kilokalorien pro Tag. Alltagsbewegung und Sport kommen noch hinzu.',
  'glossary.totalBodyWaterL.title': 'Gesamtkörperwasser',
  'glossary.totalBodyWaterL.text':
    'Das gesamte Wasser in deinem Körper, in Litern: in den Zellen und um sie herum. Es gehört zur fettfreien Masse und verändert sich mit deinem Flüssigkeitshaushalt.',
  'glossary.ecwRatio.title': 'ECW-Verhältnis',
  'glossary.ecwRatio.text':
    'Der Anteil deines Körperwassers, der außerhalb der Zellen liegt. InBody betrachtet etwa 0,36–0,39 als üblichen Bereich. Er verschiebt sich mit dem Flüssigkeitshaushalt und nach hartem Training; bleibt er dauerhaft hoch, ist das eine Frage für eine Fachperson und nichts, was du anhand der App beurteilen solltest.',
};
