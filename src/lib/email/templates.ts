import type { Language } from '@/lib/i18n/languages';
import { st } from '@/lib/i18n/messages';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** "Confirm your email" — sent right after registration, in the language chosen there. */
export function verificationEmail(language: Language, url: string): EmailContent {
  return {
    subject: st(language, 'email.verify.subject'),
    html: st(language, 'email.verify.html', { url }),
    text: st(language, 'email.verify.text', { url }),
  };
}

/** "Reset your password" — in the language stored on the account. */
export function passwordResetEmail(language: Language, url: string): EmailContent {
  return {
    subject: st(language, 'email.reset.subject'),
    html: st(language, 'email.reset.html', { url }),
    text: st(language, 'email.reset.text', { url }),
  };
}
