import { describe, it, expect } from 'vitest';
import { parseInBodyReport } from '@/modules/inbody/inbody-parser';

// A trimmed, representative sample of what tesseract.js actually returns for
// a real InBody 570 report photo (English "Research Parameters" panel comes
// through clean; the Hungarian bar-chart-heavy tables are noisier) — see
// inbody-parser.ts's top comment for the two OCR failure modes this is
// modeled on. Kept as a fixture rather than a synthetic clean string so the
// test exercises the actual noise the parser has to tolerate.
const SAMPLE_OCR_TEXT = `
Sb gon id 198cm A4 Male 2026.03.12. 09:14
_Testosszetétel analizis SR RET a
Teljes testviz
(48,5~59, 3) : 76,2
Fehérje (ka) 16,0 (62,3~76,1) 80,7
(13,0~15,8) (66,0~80,6) 91,5
Asvanyi kos od GE (73,3~99,1)
anyagok (4,49~5,49)
: 10,8
Testzsir *9) (10,4~20.7)
tomeg Hos He Re
Izom-Zsir analizis SRR i
RR ER or 70 goede SRG 145 160 175 190. 205 %
ET gq 5
Suly !
( | 70° 80 BGT 100° 410.5 1120 5180. F440 © 1508 Sed 70 Ea
SMM LL] 46.3
(Vazizom tomeg)
kg) | 40 60 80 100 160 220 280 340 400 460 520 %
Testzsir ENE 10 8
tomeg SE LT AUR RR ae AR abe
Elhizottsag analizis =o
100 150 185 220 250 300 350 400 450 500 550
BMI (ign) FE FS BE 3 3
(Testtomeg index)
1 S00 50° 100-150 200. 250 30,0, 350." 400 450 500
PBF (70) 11 8
(Testzsir szazalék) SheaE eT SE esa a Se a
InBody Score——————————
87 /100 points
WeightControl————+— 5
Target Weight 91,5 kg
Weight Control 0,0 kg
Fat Control 0,0 kg
Muscle Control 0,0 kg
Research Parameters ————————————
Intracellular Water 37011 ( 304367 )
Extracellular Water 222L ( 18,5~225 )
Basal Metabolic Rate 2113 kcal ( 1882~2218 )
Waist-Hip Ratio 0,89 ( 0,80~0,90 )
Visceral Fat Level 4 (1-9)
Obesity Degree 106% ( 90~110 )
`;

describe('parseInBodyReport', () => {
  it('extracts every field a real report photo actually OCRs cleanly enough to read', () => {
    const result = parseInBodyReport(SAMPLE_OCR_TEXT);

    expect(result.measuredAt).toEqual(new Date(Date.UTC(2026, 2, 12, 9, 14)));
    expect(result.inBodyScore).toBe(87);
    expect(result.basalMetabolicRateKcal).toBe(2113);
    expect(result.visceralFatLevel).toBe(4);
    expect(result.bodyFatPercentage).toBe(11.8);
    expect(result.skeletalMuscleMassKg).toBe(46.3);
    expect(result.totalBodyWaterL).toBe(59.2);
    expect(result.ecwRatio).toBe(0.375);
  });

  it('recovers weight from Target Weight only when Weight Control is 0 (already at goal)', () => {
    const result = parseInBodyReport(SAMPLE_OCR_TEXT);
    expect(result.weightKg).toBe(91.5);
  });

  it('leaves weight null when Weight Control is non-zero, rather than substituting the target', () => {
    const stillLosingWeight = SAMPLE_OCR_TEXT.replace('Weight Control 0,0 kg', 'Weight Control -2,3 kg');
    const result = parseInBodyReport(stillLosingWeight);
    expect(result.weightKg).toBeNull();
  });

  it('leaves a field null (never a fabricated value) when OCR drops a digit entirely, e.g. BMI here ("23,3" read as "3 3")', () => {
    const result = parseInBodyReport(SAMPLE_OCR_TEXT);
    expect(result.bmi).toBeNull();
  });

  it('leaves fat-free mass null on this report -- the Body Composition waterfall table is the least reliable section for OCR', () => {
    const result = parseInBodyReport(SAMPLE_OCR_TEXT);
    expect(result.fatFreeMassKg).toBeNull();
  });

  it('returns every field null (never throws) on text with no recognizable labels at all', () => {
    const result = parseInBodyReport('the quick brown fox jumps over the lazy dog');
    expect(result).toEqual({
      measuredAt: null,
      weightKg: null,
      bodyFatPercentage: null,
      skeletalMuscleMassKg: null,
      fatFreeMassKg: null,
      bmi: null,
      inBodyScore: null,
      visceralFatLevel: null,
      basalMetabolicRateKcal: null,
      totalBodyWaterL: null,
      ecwRatio: null,
    });
  });

  it('rejects an out-of-range InBody Score instead of trusting a stray nearby number', () => {
    const result = parseInBodyReport('InBody Score noise 999 more noise /100 points');
    expect(result.inBodyScore).toBeNull();
  });

  it('does not mistake a label\'s own "(%)" unit marker (misread as a parenthesized number) for the value', () => {
    // "PBF (%)" OCR'd with the percent sign misread as digits, immediately
    // followed by the real, space-decimal-corrupted value.
    const result = parseInBodyReport('PBF (70) 11 8');
    expect(result.bodyFatPercentage).toBe(11.8);
  });

  it('parses the report test-date stamp into a UTC date', () => {
    const result = parseInBodyReport('some header text 2025.11.03. 14:07 more text');
    expect(result.measuredAt).toEqual(new Date(Date.UTC(2025, 10, 3, 14, 7)));
  });

  it('returns a null measuredAt when no date stamp is recognizable', () => {
    const result = parseInBodyReport('no date anywhere in this text');
    expect(result.measuredAt).toBeNull();
  });
});
