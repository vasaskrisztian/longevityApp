import { describe, it, expect } from 'vitest';
import {
  PasswordSchema,
  RegisterSchema,
  LoginSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
} from '@/lib/validation/auth.schemas';

const VALID_PASSWORD = 'CorrectHorse123';

describe('PasswordSchema', () => {
  it('accepts a password meeting all rules', () => {
    expect(PasswordSchema.safeParse(VALID_PASSWORD).success).toBe(true);
  });

  it.each([
    ['short1A', 'too short'],
    ['alllowercase1', 'no uppercase'],
    ['ALLUPPERCASE1', 'no lowercase'],
    ['NoDigitsHere', 'no digit'],
  ])('rejects "%s" (%s)', (value) => {
    expect(PasswordSchema.safeParse(value).success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  const base = {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    password: VALID_PASSWORD,
    passwordConfirmation: VALID_PASSWORD,
    termsAccepted: true as const,
    privacyAccepted: true as const,
  };

  it('accepts a fully valid registration', () => {
    expect(RegisterSchema.safeParse(base).success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = RegisterSchema.safeParse({ ...base, email: 'Jane@Example.COM' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com');
    }
  });

  it('rejects mismatched password confirmation', () => {
    const result = RegisterSchema.safeParse({ ...base, passwordConfirmation: 'Different123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.passwordConfirmation).toBeTruthy();
    }
  });

  it('rejects when Terms of Service is not accepted', () => {
    expect(RegisterSchema.safeParse({ ...base, termsAccepted: false }).success).toBe(false);
  });

  it('rejects when Privacy Policy is not accepted', () => {
    expect(RegisterSchema.safeParse({ ...base, privacyAccepted: false }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(RegisterSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an empty full name', () => {
    expect(RegisterSchema.safeParse({ ...base, fullName: '' }).success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('accepts a valid email + non-empty password', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: 'anything' }).success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(LoginSchema.safeParse({ email: 'nope', password: 'anything' }).success).toBe(false);
  });
});

describe('RequestPasswordResetSchema', () => {
  it('accepts a valid email', () => {
    expect(RequestPasswordResetSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(RequestPasswordResetSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts matching, policy-compliant passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      token: 'abc123',
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      token: 'abc123',
      password: VALID_PASSWORD,
      passwordConfirmation: 'SomethingElse123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing token', () => {
    const result = ResetPasswordSchema.safeParse({
      token: '',
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    });
    expect(result.success).toBe(false);
  });
});
