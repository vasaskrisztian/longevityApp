'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import {
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  type ResetPasswordInput,
} from '@/lib/validation/auth.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function RequestResetForm() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = RequestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid email');
      return;
    }
    setError(null);
    setSubmitting(true);
    await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Alert variant="success">
        If that email is registered, a reset link has been sent to it.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}

function ConfirmResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    setSubmitting(true);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSubmitting(false);
    if (!response.ok) {
      setServerError('This reset link is invalid or has expired.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Alert variant="success">
        Password updated. <a href="/login" className="underline">Log in</a>.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      <input type="hidden" {...register('token')} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirmation">Confirm new password</Label>
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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

// `useSearchParams()` opts this page out of static rendering, and Next.js
// requires a Suspense boundary around any component that calls it (build
// fails otherwise: "useSearchParams() should be wrapped in a suspense
// boundary"). The card itself renders instantly client-side, so the
// fallback is never visible in practice — it only matters during the
// initial static shell Next.js generates at build time.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{token ? 'Choose a new password' : 'Reset your password'}</CardTitle>
      </CardHeader>
      <CardContent>{token ? <ConfirmResetForm token={token} /> : <RequestResetForm />}</CardContent>
    </Card>
  );
}
