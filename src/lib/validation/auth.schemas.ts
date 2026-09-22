import { z } from 'zod';

// Password policy per ARCHITECTURE.md §4.1 / spec item 3: min 10 chars, at
// least one lowercase, one uppercase, one digit. Enforced here (server-side
// source of truth) and reused for the client-side form for a matching UX.
export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const RegisterSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(200),
    email: z.string().trim().email().toLowerCase(),
    password: PasswordSchema,
    passwordConfirmation: z.string(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms of Service' }),
    }),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Privacy Policy' }),
    }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: PasswordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
