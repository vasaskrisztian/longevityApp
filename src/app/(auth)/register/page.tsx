'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterInput } from '@/lib/validation/auth.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    setSubmitting(true);
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSubmitting(false);

    if (!response.ok && response.status !== 201) {
      setServerError('Something went wrong. Please try again.');
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If your email is valid, we&rsquo;ve sent a verification link. You need to verify
            your email before you can log in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverError && <Alert variant="destructive">{serverError}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" autoComplete="name" {...register('fullName')} />
            {errors.fullName && <p className="text-sm text-danger">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters, with an uppercase letter, a lowercase letter and a digit.
            </p>
            {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordConfirmation">Confirm password</Label>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              {...register('passwordConfirmation')}
            />
            {errors.passwordConfirmation && (
              <p className="text-sm text-danger">{errors.passwordConfirmation.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('termsAccepted')} />
              I accept the Terms of Service
            </label>
            {errors.termsAccepted && (
              <p className="text-sm text-danger">{errors.termsAccepted.message}</p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('privacyAccepted')} />
              I accept the Privacy Policy
            </label>
            {errors.privacyAccepted && (
              <p className="text-sm text-danger">{errors.privacyAccepted.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <a href="/login" className="hover:text-foreground">Log in</a>
        </p>
      </CardContent>
    </Card>
  );
}
