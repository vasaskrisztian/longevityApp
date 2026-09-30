import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// A minimal fluent stub matching exactly the sharp() call chain
// inbody-ocr.service.ts uses (metadata / grayscale / normalize / extract /
// toBuffer) -- not sharp's real API surface, just enough of it.
function makeSharpStub() {
  const chain = {
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
    grayscale: vi.fn(() => chain),
    normalize: vi.fn(() => chain),
    extract: vi.fn(() => chain),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-bytes')),
  };
  return chain;
}

const sharpStub = makeSharpStub();
vi.mock('sharp', () => ({ default: vi.fn(() => sharpStub) }));

const recognizeMock = vi.fn();
const terminateMock = vi.fn().mockResolvedValue(undefined);
const createWorkerMock = vi.fn();
vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => createWorkerMock(...args),
}));

const { runInBodyOcr } = await import('@/modules/inbody/inbody-ocr.service');

beforeEach(() => {
  recognizeMock.mockReset();
  terminateMock.mockClear();
  createWorkerMock.mockReset();
  createWorkerMock.mockResolvedValue({ recognize: recognizeMock, terminate: terminateMock });
  sharpStub.metadata.mockResolvedValue({ width: 1000, height: 1000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runInBodyOcr', () => {
  it('OCRs the left and right columns separately and averages their confidence', async () => {
    recognizeMock
      .mockResolvedValueOnce({ data: { text: 'left column text', confidence: 60 } })
      .mockResolvedValueOnce({ data: { text: 'right column text', confidence: 80 } });

    const result = await runInBodyOcr(Buffer.from('input'));

    expect(result.rawText).toBe('left column text\nright column text');
    expect(result.confidence).toBe(70);
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it('OCRs the whole image once when it is too small to split', async () => {
    sharpStub.metadata.mockResolvedValue({ width: 100, height: 100 });
    recognizeMock.mockResolvedValueOnce({ data: { text: 'whole image text', confidence: 55 } });

    const result = await runInBodyOcr(Buffer.from('input'));

    expect(result.rawText).toBe('whole image text');
    expect(result.confidence).toBe(55);
    expect(recognizeMock).toHaveBeenCalledTimes(1);
  });

  it('always terminates the worker, even when OCR throws', async () => {
    recognizeMock.mockRejectedValue(new Error('ocr engine crashed'));

    await expect(runInBodyOcr(Buffer.from('input'))).rejects.toThrow('ocr engine crashed');
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with a clear timeout error instead of hanging forever when OCR never resolves', async () => {
    vi.useFakeTimers();
    // Simulate a genuinely stuck native call: recognize() never
    // settles -- this is the exact failure mode a broken sharp/tesseract
    // native binary in a container can produce.
    recognizeMock.mockReturnValue(new Promise(() => {}));

    const resultPromise = runInBodyOcr(Buffer.from('input'));
    // Attach a rejection handler immediately so the timer-driven rejection
    // below is never briefly "unhandled" from Node's perspective.
    const assertion = expect(resultPromise).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(90_000);

    await assertion;
  });
});
