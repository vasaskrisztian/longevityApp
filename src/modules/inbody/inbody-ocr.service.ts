import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { logger } from '@/lib/logging/logger';

/**
 * Runs OCR over a photographed/scanned InBody report and returns the raw
 * text — parsing that text into structured fields is inbody-parser.ts's
 * job, kept entirely separate so the parser can be unit-tested against
 * fixed text fixtures with no OCR engine involved at all.
 *
 * Two choices here were validated against real report photos, not assumed:
 *
 * 1. The English trained-data file is bundled in the repo
 *    (assets/tesseract-lang/eng.traineddata.gz) and loaded from that local
 *    path (`langPath`), rather than left at tesseract.js's default of
 *    fetching it from a CDN on first use. That default was tried first and
 *    failed outright in this project's own dev sandbox (a 403 from
 *    cdn.jsdelivr.net) — since this app's Docker build environment has
 *    already shown other CDN/registry restrictions (see
 *    docs/ci-cd-setup.md's Prisma engine-download notes), depending on an
 *    unbundled CDN fetch at first request in production is exactly the
 *    kind of thing that works in casual testing and then silently breaks
 *    for a reason that has nothing to do with this feature's own code.
 * 2. The image is split into a left ~65% / right ~35% column and each
 *    column is OCR'd separately, rather than running OCR once over the
 *    full page. This report template (and every InBody printout of this
 *    general family) lays its Hungarian bar-chart-heavy tables and English
 *    "Research Parameters" summary out side by side; OCR'd as one image,
 *    tesseract's line-reading order regularly interleaves the two columns
 *    mid-sentence, which is far more damaging to the text than anything
 *    the parser can recover from. Splitting first measurably improved
 *    which fields came through recognizably in every test run against a
 *    real sample report.
 */

const LANG_PATH = path.join(process.cwd(), 'assets', 'tesseract-lang');
// tesseract.js writes a decompressed copy of the trained-data file to
// `cachePath` the first time it loads it, to skip re-gunzipping on later
// calls in the same process. That must be a genuinely writable, ephemeral
// location -- never the repo's own asset directory, which a container
// filesystem may mount read-only and which shouldn't gain a 5MB generated
// file as a side effect of serving a request either way.
const CACHE_PATH = path.join(os.tmpdir(), 'inbody-tesseract-cache');

// The one real end-to-end run this pipeline was validated against (a real
// sample photo, in this project's dev sandbox) took ~15s. This bound is
// deliberately much higher than that -- a smaller/CPU-constrained
// production instance, or a larger/denser photo, can legitimately take
// longer -- but it exists so a genuine hang (a stuck native binary, a
// worker that never spawns) fails loudly with a clear error instead of
// leaving the request -- and the user's upload button -- stuck forever
// with nothing saved and nothing logged.
const OCR_TIMEOUT_MS = 90_000;

export interface InBodyOcrResult {
  rawText: string;
  confidence: number;
}

async function ocrBuffer(worker: Awaited<ReturnType<typeof createWorker>>, buffer: Buffer) {
  const { data } = await worker.recognize(buffer);
  return data;
}

async function runInBodyOcrInner(imageBuffer: Buffer): Promise<InBodyOcrResult> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Falls back to OCR-ing the whole image once if it's too small to split
  // sensibly (e.g. a tiny thumbnail) -- splitting only helps once a column
  // has enough resolution to still be legible on its own.
  const canSplit = width >= 400 && height >= 400;

  logger.info('inbody_ocr_stage', { stage: 'creating_worker', width, height, canSplit });
  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    cachePath: CACHE_PATH,
    gzip: true,
  });
  logger.info('inbody_ocr_stage', { stage: 'worker_created' });

  try {
    if (!canSplit) {
      const whole = await sharp(imageBuffer).grayscale().normalize().toBuffer();
      logger.info('inbody_ocr_stage', { stage: 'recognizing_whole_image' });
      const data = await ocrBuffer(worker, whole);
      logger.info('inbody_ocr_stage', { stage: 'done', confidence: data.confidence });
      return { rawText: data.text, confidence: data.confidence };
    }

    const splitX = Math.round(width * 0.65);
    const [left, right] = await Promise.all([
      sharp(imageBuffer).extract({ left: 0, top: 0, width: splitX, height }).grayscale().normalize().toBuffer(),
      sharp(imageBuffer)
        .extract({ left: splitX, top: 0, width: width - splitX, height })
        .grayscale()
        .normalize()
        .toBuffer(),
    ]);
    logger.info('inbody_ocr_stage', { stage: 'images_split' });

    // Sequential, not parallel: both calls share the one `worker`, and
    // tesseract.js workers process one recognize() call at a time anyway —
    // running them "in parallel" here would just queue silently behind the
    // scenes while holding both buffers in memory for no benefit.
    logger.info('inbody_ocr_stage', { stage: 'recognizing_left_column' });
    const leftResult = await ocrBuffer(worker, left);
    logger.info('inbody_ocr_stage', { stage: 'recognizing_right_column' });
    const rightResult = await ocrBuffer(worker, right);
    logger.info('inbody_ocr_stage', {
      stage: 'done',
      confidence: (leftResult.confidence + rightResult.confidence) / 2,
    });

    return {
      rawText: `${leftResult.text}\n${rightResult.text}`,
      confidence: (leftResult.confidence + rightResult.confidence) / 2,
    };
  } finally {
    // Best-effort: if the hang that triggered the timeout below is inside
    // the native binary itself, terminate() can hang too -- it must never
    // be allowed to mask the real timeout error or block the process from
    // eventually responding.
    await worker.terminate().catch((error) =>
      logger.warn('inbody_ocr_worker_terminate_failed', { message: (error as Error).message }),
    );
  }
}

export async function runInBodyOcr(imageBuffer: Buffer): Promise<InBodyOcrResult> {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      logger.error('inbody_ocr_timeout', { timeoutMs: OCR_TIMEOUT_MS });
      reject(new Error(`InBody OCR timed out after ${OCR_TIMEOUT_MS}ms`));
    }, OCR_TIMEOUT_MS);
  });

  try {
    return await Promise.race([runInBodyOcrInner(imageBuffer), timeout]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
