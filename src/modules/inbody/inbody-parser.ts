/**
 * Turns the raw OCR text of a photographed/scanned InBody report into the
 * ten core fields this app tracks. Pure, no I/O — testable against fixed
 * OCR-text fixtures without ever touching Tesseract or a real image.
 *
 * Why this is deliberately conservative: a phone photo of a printed InBody
 * report is a genuinely hard OCR target — dense, bar-chart-heavy tables
 * with a decimal *comma* (Hungarian convention) sitting right next to
 * hairline chart graphics confuse a general-purpose OCR engine's reading
 * order and frequently drop or corrupt the comma itself. Two concrete
 * failure modes turned up repeatedly against real sample reports:
 *   1. The decimal comma gets read as a plain space, so "11,8" becomes the
 *      two tokens "11 8" (findDecimalNear below re-joins exactly this shape,
 *      and only this shape — a 1-2 digit whole part immediately followed by
 *      whitespace and a single digit — since anything looser risks pairing
 *      up two unrelated numbers).
 *   2. A table's value column and its reference-range column end up
 *      concatenated with no separator at all — e.g. Intracellular/
 *      Extracellular Water's "37,0" and "22,2" surfacing as bare "370" and
 *      "222". PARSE_RANGES below exists for exactly this: whenever a
 *      field's plausible range spans one order of magnitude (e.g. body
 *      water in liters is always 10-60), an integer that only becomes
 *      plausible after dividing by 10 is accepted; one that's already
 *      plausible as-is is left alone. This never fires for fields with no
 *      configured range (bmi, weightKg, ecwRatio derive differently).
 * Every accepted value is range-checked before being kept (see
 * PLAUSIBLE_RANGES) — a value the regex found but which falls outside a
 * sane physiological range is treated as a misread and dropped (left
 * `null`) rather than stored, on the theory that a wrong number silently
 * saved into a health record is worse than a blank field the user notices
 * and fills in themselves. `rawOcrText` is always kept on the record
 * precisely so a blank or wrong field can be manually corrected without
 * re-uploading the photo.
 */

export interface ParsedInBodyFields {
  measuredAt: Date | null;
  weightKg: number | null;
  bodyFatPercentage: number | null;
  skeletalMuscleMassKg: number | null;
  fatFreeMassKg: number | null;
  bmi: number | null;
  inBodyScore: number | null;
  visceralFatLevel: number | null;
  basalMetabolicRateKcal: number | null;
  totalBodyWaterL: number | null;
  ecwRatio: number | null;
}

// [min, max] a parsed value must fall within to be accepted at all — set
// generously wide (adult humans across the full range InBody is used for),
// not to the "normal" clinical band, since the point is only to reject an
// OCR misread, never to second-guess a real measurement.
const PLAUSIBLE_RANGES = {
  weightKg: [25, 300],
  bodyFatPercentage: [2, 70],
  skeletalMuscleMassKg: [10, 90],
  fatFreeMassKg: [15, 150],
  bmi: [10, 70],
  inBodyScore: [0, 100],
  visceralFatLevel: [1, 30],
  basalMetabolicRateKcal: [500, 5000],
  totalBodyWaterL: [10, 80],
  ecwRatio: [0.3, 0.45],
} as const satisfies Record<string, readonly [number, number]>;

function inRange(value: number, key: keyof typeof PLAUSIBLE_RANGES): boolean {
  const [min, max] = PLAUSIBLE_RANGES[key];
  return value >= min && value <= max;
}

/**
 * Finds the first number near `label` in `text`, tolerant of the two OCR
 * failure modes described above, and returns it only if it (or, for a field
 * with a configured `magnitudeRangeKey`, a /10-corrected version of it)
 * falls inside that field's plausible range. `windowChars` bounds how far
 * past the label to search — wide enough to skip past a run of bar-chart
 * tick labels (e.g. "55 70 85 100 115 130 145 160 175 190 205 %"), not so
 * wide it wanders into an unrelated row.
 */
function findDecimalNear(
  text: string,
  labelPattern: RegExp,
  key: keyof typeof PLAUSIBLE_RANGES,
  windowChars = 80,
): number | null {
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;

  const searchStart = labelMatch.index + labelMatch[0].length;
  // A label is very often immediately followed by its own unit/percent
  // marker OCR'd as a stray parenthetical (e.g. "PBF (%)" misread as
  // "PBF (70)") -- stripping one leading "(...)" group before searching
  // keeps that fragment's digits from being mistaken for the real value.
  const window = text.slice(searchStart, searchStart + windowChars).replace(/^\s*\([^)]{0,12}\)/, '');

  // The "comma read as a lone space" shape ("11,8" -> "11 8") is checked
  // FIRST and must win over the plain-integer alternative below at the same
  // position — tried in the other order, "11" alone would satisfy the
  // plain-integer branch before the more specific two-token shape ever gets
  // a chance, silently truncating "11,8" down to "11". Only a 1-2 digit
  // whole part then a SINGLE trailing digit qualifies, never two
  // multi-digit numbers, so this can't accidentally splice together two
  // unrelated values.
  const numberPattern = /(\d{1,2})\s(\d)(?!\d)|(\d{1,3})(?:[.,](\d))?/;
  const match = numberPattern.exec(window);
  if (!match) return null;

  let raw: number;
  if (match[1] !== undefined) {
    raw = Number(`${match[1]}.${match[2]}`);
  } else {
    raw = match[4] !== undefined ? Number(`${match[3]}.${match[4]}`) : Number(match[3]);
  }
  if (Number.isNaN(raw)) return null;

  if (inRange(raw, key)) return raw;
  // Second failure mode: the decimal separator vanished entirely and the
  // value landed one order of magnitude too high (e.g. "37,0" -> "370").
  const corrected = raw / 10;
  if (inRange(corrected, key)) return corrected;

  return null;
}

function findIntegerNear(text: string, labelPattern: RegExp, key: keyof typeof PLAUSIBLE_RANGES, windowChars = 120): number | null {
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;
  const searchStart = labelMatch.index + labelMatch[0].length;
  const window = text.slice(searchStart, searchStart + windowChars);
  const match = /(\d{1,5})/.exec(window);
  if (!match) return null;
  const value = Number(match[1]);
  return inRange(value, key) ? value : null;
}

/**
 * The report's own test-date line, e.g. "2026.03.12. 09:14" (InBody's
 * standard yyyy.mm.dd. hh:mm stamp — present regardless of which language
 * the rest of the template is localized into). Falls back to `null` (the
 * caller stamps upload time instead) when it isn't recognizable.
 */
function parseMeasuredAt(text: string): Date | null {
  const match = /(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?\s+(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseInBodyReport(rawOcrText: string): ParsedInBodyFields {
  const text = rawOcrText;

  return {
    measuredAt: parseMeasuredAt(text),

    // InBody Score: "InBody Score ... 87 /100 points" — anchored on the
    // "/100" that always follows it, since the score itself is otherwise
    // indistinguishable from any other 2-3 digit number on the page.
    inBodyScore: (() => {
      const match = /InBody\s*Score[\s\S]{0,80}?(\d{1,3})\s*\/\s*100/i.exec(text);
      if (!match) return null;
      const value = Number(match[1]);
      return inRange(value, 'inBodyScore') ? value : null;
    })(),

    // Most reliable fields: plain English labels in the report's own
    // "Research Parameters" panel, printed as ordinary text with no
    // overlapping chart graphics.
    basalMetabolicRateKcal: findIntegerNear(text, /Basal\s*Metabolic\s*Rate/i, 'basalMetabolicRateKcal'),
    visceralFatLevel: findIntegerNear(text, /Visceral\s*Fat\s*Level/i, 'visceralFatLevel'),

    // Body Mass Index / Percent Body Fat: printed under both a Hungarian
    // and an English label depending on report language — matching either.
    bmi: findDecimalNear(text, /\bBMI\b/i, 'bmi'),
    bodyFatPercentage: findDecimalNear(text, /\bPBF\b|Testzs[íi]r sz[áa]zal[ée]k/i, 'bodyFatPercentage'),

    // Skeletal Muscle Mass ("SMM" / "Vázizom tömeg") and weight ("Súly" /
    // "Weight") both sit in the Muscle-Fat Analysis section, each its own
    // label + bar chart + value row (as opposed to the Body Composition
    // table above it, where every row shares column values with its
    // neighbors and reading order is far less reliable — see this file's
    // top comment).
    skeletalMuscleMassKg: findDecimalNear(text, /\bSMM\b|V[áa]zizom\s*t[öo]meg/i, 'skeletalMuscleMassKg'),

    // Weight deliberately has NO direct "find the number after the Súly/
    // Weight label" search: in every sample report tested, that label sits
    // immediately before the Muscle-Fat Analysis bar chart's own tick-mark
    // axis (e.g. "70 80 90 100 110...", starting just a few characters
    // after the label), and the real value is often further away than the
    // first tick or missing from the OCR text's reading order entirely —
    // so a nearby-number search here doesn't fail safely, it confidently
    // returns the WRONG number (an axis tick). "Weight Control" gives a
    // second, mathematically sound way to the same value instead: it's
    // InBody's own (Target Weight − current weight), so a Weight Control
    // of 0.0 kg means Target Weight (printed cleanly, no chart graphics
    // nearby) legitimately *is* the current weight — a real equality, not
    // a guess — and this only fires in that one case; anyone still working
    // toward a goal (Weight Control != 0) gets null here rather than their
    // target substituted for their actual weight.
    weightKg: (() => {
      const controlMatch = /Weight\s*Control\D{0,15}([-+]?\d+)[.,](\d)/i.exec(text);
      if (!controlMatch) return null;
      const weightControl = Number(`${controlMatch[1]}.${controlMatch[2]}`);
      if (Math.abs(weightControl) < 0.05) {
        return findDecimalNear(text, /Target\s*Weight/i, 'weightKg', 30);
      }
      return null;
    })(),

    // Fat-Free Mass ("Zsírmentes tömeg") lives in the Body Composition
    // waterfall table, whose shared-column layout is the least reliable
    // part of the whole report for OCR (see top comment) — kept as a
    // best-effort field precisely because of that; most likely of the ten
    // to come back null or need a manual correction.
    fatFreeMassKg: findDecimalNear(text, /Zs[íi]rmentes\s*t[öo]meg|Fat[- ]?Free\s*Mass/i, 'fatFreeMassKg', 60),

    // Total Body Water and the ECW ratio aren't printed anywhere as a
    // single already-computed number in this report's English panel — but
    // Intracellular + Extracellular Water are, and both are algebraically
    // derived from them (totalBodyWaterL = ICW + ECW; ecwRatio = ECW /
    // (ICW + ECW)), so both are computed here rather than pattern-matched
    // as their own separate label.
    ...(() => {
      const icw = findDecimalNear(text, /Intracellular\s*Water/i, 'totalBodyWaterL', 60);
      const ecw = findDecimalNear(text, /Extracellular\s*Water/i, 'totalBodyWaterL', 60);
      if (icw === null || ecw === null) {
        return { totalBodyWaterL: null, ecwRatio: null };
      }
      const total = icw + ecw;
      const ratio = Math.round((ecw / total) * 1000) / 1000;
      return {
        totalBodyWaterL: inRange(total, 'totalBodyWaterL') ? Math.round(total * 10) / 10 : null,
        ecwRatio: inRange(ratio, 'ecwRatio') ? ratio : null,
      };
    })(),
  };
}
