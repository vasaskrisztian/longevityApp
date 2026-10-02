import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();
// `Resend` is a class; the mock constructor hands back an object exposing
// the one method this module calls, mirroring queue-connection.test.ts's
// IORedis mock shape.
const ResendMock = vi.fn().mockImplementation(() => ({
  emails: { send: sendMock },
}));
vi.mock('resend', () => ({ Resend: ResendMock }));

const loggerInfoMock = vi.fn();
const loggerErrorMock = vi.fn();
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: loggerInfoMock, warn: vi.fn(), error: loggerErrorMock },
}));

const { sendEmail, _resetMailerClientForTests } = await import('@/lib/email/mailer');

const EMAIL_INPUT = {
  to: 'jane@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ResendMock.mockClear();
  sendMock.mockReset().mockResolvedValue({ data: { id: 'email_1' }, error: null });
  loggerInfoMock.mockClear();
  loggerErrorMock.mockClear();
  _resetMailerClientForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('sendEmail', () => {
  it('falls back to logging the email when RESEND_API_KEY is unset, without constructing a client', async () => {
    await sendEmail(EMAIL_INPUT);

    expect(ResendMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('jane@example.com'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Hi'));
  });

  it('sends via Resend when RESEND_API_KEY is set, defaulting the from address', async () => {
    process.env.RESEND_API_KEY = 're_test_key';

    await sendEmail(EMAIL_INPUT);

    expect(ResendMock).toHaveBeenCalledWith('re_test_key');
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Longevity Klub <onboarding@resend.dev>',
      to: 'jane@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'email_sent',
      expect.objectContaining({ emailDomain: 'example.com' }),
    );
  });

  it('uses EMAIL_FROM when set, instead of the Resend test-mode sender', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Longevity Klub <no-reply@kardi-soft.hu>';

    await sendEmail(EMAIL_INPUT);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Longevity Klub <no-reply@kardi-soft.hu>' }),
    );
  });

  it('is a singleton — a second send never constructs a second client', async () => {
    process.env.RESEND_API_KEY = 're_test_key';

    await sendEmail(EMAIL_INPUT);
    await sendEmail({ ...EMAIL_INPUT, to: 'other@example.com' });

    expect(ResendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('logs and does not throw when Resend returns an API error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'invalid_from_address', statusCode: 422, message: 'bad from' },
    });

    await expect(sendEmail(EMAIL_INPUT)).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'email_send_failed',
      expect.objectContaining({ emailDomain: 'example.com', errorName: 'invalid_from_address' }),
    );
  });

  it('logs and does not throw when the Resend call itself rejects (network error)', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    sendMock.mockRejectedValue(new Error('fetch failed'));

    await expect(sendEmail(EMAIL_INPUT)).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'email_send_failed',
      expect.objectContaining({ emailDomain: 'example.com', message: 'fetch failed' }),
    );
  });
});
