import type { Catalog } from '@/src/i18n/translate';
import type { content as en } from '../en/content';

export const content: Catalog<typeof en> = {
  // Used by InfoLabel / InfoTipHost
  'glossary.whatIsThis': '{title}: mi ez?',
  'glossary.closeExplanation': 'Magyarázat bezárása',

  // Today / Trends
  'glossary.sleepScore.title': 'Alvási pontszám',
  'glossary.sleepScore.text':
    'A viselhető eszközöd 0–100 közötti összegzése a múlt éjszakai alvásodról: azt veszi figyelembe, mennyi ideig, milyen mélyen és mennyire zavartalanul aludtál. Minél magasabb, annál jobb; a pontos képletet az eszköz gyártója határozza meg.',
  'glossary.readinessScore.title': 'Felkészültségi pontszám',
  'glossary.readinessScore.text':
    'A viselhető eszközöd 0–100 közötti becslése arról, mennyire vagy felkészült a napra. A közelmúlt alvására, a nyugalmi pulzusodra, a HRV-dre és a legutóbbi aktivitásodra épül. Minél magasabb, annál jobban regenerálódtál.',
  'glossary.activityScore.title': 'Aktivitási pontszám',
  'glossary.activityScore.text':
    'A viselhető eszközöd 0–100 közötti összegzése arról, mennyire voltál aktív: a napközbeni mozgásról, az edzésmennyiségről és arról, mennyire tartottad egyensúlyban az aktivitást és a pihenést.',
  'glossary.scores.title': 'Alvási, felkészültségi és aktivitási pontszám',
  'glossary.scores.text':
    'Három, a viselhető eszközöd által számított 0–100 közötti összegzés. Az alvás a múlt éjszakát írja le, a felkészültség azt, mennyire tűnsz regenerálódottnak, az aktivitás pedig azt, mennyire voltál aktív. A gombokkal egyet, kettőt vagy mindhármat megjelenítheted.',
  'glossary.hrv.title': 'HRV (szívritmus-variabilitás)',
  'glossary.hrv.text':
    'A szívverések közötti idő apró ingadozása, éjszaka mérve, ezredmásodpercben. Kipihenten általában magasabb, stressz, rossz alvás vagy kemény edzés után alacsonyabb. Személyes érték: a saját szokásos értékeddel hasonlítsd össze, ne másokéval.',
  'glossary.restingHr.title': 'Nyugalmi pulzus',
  'glossary.restingHr.text':
    'A nyugalmi állapotban jellemző legalacsonyabb pulzusod, általában alvás közben mérve, percenkénti ütésben (bpm). Stressz, betegség, alkohol vagy kevés pihenés hatására gyakran emelkedik, az erőnlét és a regeneráció javulásával pedig csökken.',
  'glossary.sleepDuration.title': 'Alvásidő',
  'glossary.sleepDuration.text':
    'A múlt éjszaka alvással töltött teljes idő (nem az ágyban töltött idő), órában és percben megadva. A protokollod célt is kitűzhet hozzá.',
  'glossary.steps.title': 'Lépés',
  'glossary.steps.text':
    'A viselhető eszközöd vagy a telefonod által az adott napra számolt lépések. A mai szám a nap végéig folyamatosan nő.',
  'glossary.activeCalories.title': 'Aktív kalória',
  'glossary.activeCalories.text':
    'A mozgással és edzéssel elégetett energia, a puszta életben maradáshoz szükséges kalóriák nélkül (azt az alapanyagcsere, azaz a BMR adja).',
  'glossary.workouts.title': 'Edzések (elmúlt 7 nap)',
  'glossary.workouts.text':
    'Az elmúlt 7 nap különálló edzései a mai nappal együtt. Ha ugyanazt az edzést két eszköz is rögzítette, csak egyszer számít.',
  'glossary.baseline.title': 'Személyes alapérték',
  'glossary.baseline.text':
    'A saját szokásos értékeid: az előző 30 napod átlaga. Az összegzés az utolsó 3 napodat hasonlítja ehhez, ezért nagyjából egy hétnyi adat kell, mielőtt bármit mondhatna.',

  // Body (InBody)
  'glossary.weightKg.title': 'Testsúly',
  'glossary.weightKg.text':
    'A teljes testsúlyod a mérés pillanatában. Zsírt, izmot, csontot és vizet is tartalmaz, ezért a napi ingadozás nagyrészt a víz változása.',
  'glossary.bodyFatPercentage.title': 'Testzsír',
  'glossary.bodyFatPercentage.text':
    'A testsúlyod zsír alkotta hányada, százalékban. Egy bizonyos mennyiségű zsírra szükség van, és ez egészséges is; a jellemző érték az életkortól és a nemtől függ. Inkább a heteken átívelő trendet figyeld, mint az egyes mérési eredményeket.',
  'glossary.skeletalMuscleMassKg.title': 'Vázizomtömeg',
  'glossary.skeletalMuscleMassKg.text':
    'Az akaratlagosan mozgatott izmaid (kar, láb, törzs) tömege kilogrammban. Ezt az izmot építi az erőedzés.',
  'glossary.fatFreeMassKg.title': 'Zsírmentes testtömeg',
  'glossary.fatFreeMassKg.text':
    'Minden, ami a testedben nem zsír: izom, csont, szervek és víz, kilogrammban. A testsúly és a zsírtömeg különbsége.',
  'glossary.bmi.title': 'BMI (testtömegindex)',
  'glossary.bmi.text':
    'A testsúly osztva a testmagasság négyzetével. Durva szűrőszám, amely nem tesz különbséget izom és zsír között, így egy izmos embernek is lehet magas a BMI-je anélkül, hogy felesleges zsírt hordozna.',
  'glossary.inBodyScore.title': 'InBody pontszám',
  'glossary.inBodyScore.text':
    'Az InBody készülék 0–100 közötti összegzése a teljes testösszetételedről, főként az izom és a zsír arányáról. A készülék saját pontszáma.',
  'glossary.visceralFatLevel.title': 'Zsigeri zsír szintje',
  'glossary.visceralFatLevel.text':
    'A hasüregben, a szervek körül mélyen tárolt zsír mutatószáma. Általában az alacsonyabb érték a kedvezőbb; az InBody saját útmutatója szerint nagyjából 1–9 között normális, 10 vagy afölött magas a szint.',
  'glossary.basalMetabolicRateKcal.title': 'BMR (alapanyagcsere)',
  'glossary.basalMetabolicRateKcal.text':
    'Az az energia, amelyet a tested teljes nyugalomban használ el a működéséhez (légzés, keringés, testhőmérséklet), kilokalóriában naponta. A mindennapi mozgás és az edzés ezen felül jön.',
  'glossary.totalBodyWaterL.title': 'Teljes testvíz',
  'glossary.totalBodyWaterL.text':
    'A tested összes vize literben: a sejteken belül és azok körül. A zsírmentes testtömeg része, és a hidratáltsággal együtt változik.',
  'glossary.ecwRatio.title': 'ECW-arány',
  'glossary.ecwRatio.text':
    'A testvized sejteken kívüli hányada. Az InBody nagyjából 0,36–0,39 közötti értéket tekint szokásosnak. A folyadékháztartással és kemény edzés után változik; ha tartósan magas marad, azt szakemberrel érdemes megbeszélni, nem az alkalmazásból megítélni.',
};
