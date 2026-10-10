'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInvitationByToken, previewInvitation, type InvitationPreview } from '@/lib/wellbeing/groups-api';
import { inviteView } from '@/lib/wellbeing/invite-flow';
import { registerFromInvitation } from '@/lib/wellbeing/register-invite';
import { PasswordSchema } from '@/lib/validation/auth.schemas';
import { GroupLogo } from './parts';
import { ConsentCheckbox } from './member-wellbeing';

const CONSENT_TEXT =
  'I agree that the administrators of this group can see my health data (sleep, activity, workouts and device sync status) while I am a member. I can leave the group at any time, which ends their access immediately.';

const PASSWORD_RULE_MESSAGE = 'At least 10 characters, with an uppercase letter, a lowercase letter and a digit.';

type FieldErrors = Partial<Record<'fullName' | 'password' | 'passwordConfirmation' | 'terms' | 'privacy' | 'consent', string>>;

/**
 * Public landing page of an invitation e-mail link (/invite/<token>):
 * signed in with the invited address -> consent + accept; signed in as
 * somebody else -> explanation + log out; signed out with an account ->
 * log in and come back; signed out without one -> register right here.
 */
export function InviteView({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [accountExistsNow, setAccountExistsNow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewInvitation(token).then((result) => {
      if (cancelled) return;
      setPreview(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const view =
    status === 'loading'
      ? ({ kind: 'loading' } as const)
      : inviteView(accountExistsNow && preview ? { ...preview, accountExists: true } : preview, loading, {
          signedIn: status === 'authenticated',
          email: session?.user?.email ?? null,
        });

  async function accept() {
    if (!consent) return setError('Please confirm the consent to continue.');
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationByToken(token);
      router.push('/profile/wellbeing');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
      setBusy(false);
    }
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (!preview?.email) return;
    setError(null);
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required';
    const passwordCheck = PasswordSchema.safeParse(password);
    if (!passwordCheck.success) errors.password = passwordCheck.error.issues[0]?.message ?? PASSWORD_RULE_MESSAGE;
    if (password !== passwordConfirmation) errors.passwordConfirmation = 'Passwords do not match';
    if (!terms) errors.terms = 'You must accept the Terms of Service';
    if (!privacy) errors.privacy = 'You must accept the Privacy Policy';
    if (!consent) errors.consent = 'You must give this consent to join the group';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    const result = await registerFromInvitation({
      fullName: fullName.trim(),
      email: preview.email,
      password,
      passwordConfirmation,
      termsAccepted: true,
      privacyAccepted: true,
      inviteToken: token,
      groupConsent: true,
    });
    if (!result.ok) {
      setBusy(false);
      if (result.reason === 'account_exists') setAccountExistsNow(true);
      else if (result.reason === 'rate_limited') setError('Too many requests. Try again later.');
      else if (result.reason === 'invalid') setError(result.message ?? 'The invitation could not be used.');
      else setError('Something went wrong. Please try again.');
      return;
    }
    const signedIn = await signIn('credentials', { email: preview.email, password, redirect: false });
    if (signedIn?.error) {
      setError('Your account was created. Please log in to continue.');
      router.push('/login');
      return;
    }
    router.push('/profile/wellbeing');
    router.refresh();
  }

  const header =
    preview && preview.status === 'valid' ? (
      <div className="flex flex-col items-center gap-2 text-center">
        <GroupLogo logoUrl={preview.logoUrl} size={56} />
        <p className="font-display text-lg font-semibold text-primary">{preview.groupName}</p>
        <p className="text-sm text-muted-foreground">invited {preview.email} to join their wellbeing group.</p>
      </div>
    ) : null;

  const shell = (title: string, children: React.ReactNode) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );

  if (view.kind === 'loading') return shell('Invitation', <p className="text-sm text-muted-foreground">Loading…</p>);

  if (view.kind === 'unavailable') {
    return shell(
      'Invitation',
      <>
        <Alert variant="destructive">{view.message}</Alert>
        {!preview && (
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </Button>
        )}
        <Button variant="outline" onClick={() => router.push(status === 'authenticated' ? '/dashboard' : '/login')}>
          {status === 'authenticated' ? 'Open the app' : 'Go to log in'}
        </Button>
      </>,
    );
  }

  if (view.kind === 'wrong_account') {
    return shell(
      'Wrong account',
      <>
        {header}
        <Alert variant="destructive">
          {`This invitation is for ${view.invitedEmail}, but you are signed in as ${view.currentEmail}. Log out and sign in (or register) with the invited address.`}
        </Alert>
        <Button onClick={() => signOut({ callbackUrl: `/invite/${token}` })}>Log out</Button>
      </>,
    );
  }

  if (view.kind === 'login') {
    return shell(
      'Join the group',
      <>
        {header}
        <p className="text-sm text-muted-foreground">There is already an account for this address. Log in to accept the invitation.</p>
        <Button onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)}>Log in</Button>
      </>,
    );
  }

  if (view.kind === 'accept') {
    return shell(
      'Join the group',
      <>
        {header}
        {error && <Alert variant="destructive">{error}</Alert>}
        <ConsentCheckbox id="invite-consent" checked={consent} onChange={setConsent}>
          {CONSENT_TEXT}
        </ConsentCheckbox>
        <Button onClick={accept} disabled={!consent || busy}>
          {busy ? 'Joining…' : 'Accept invitation'}
        </Button>
      </>,
    );
  }

  const fieldError = (key: keyof FieldErrors) => (fieldErrors[key] ? <p className="text-sm text-danger">{fieldErrors[key]}</p> : null);
  return shell(
    'Create your account',
    <>
      {header}
      {error && <Alert variant="destructive">{error}</Alert>}
      <form onSubmit={register} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" value={preview?.email ?? ''} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Full name</Label>
          <Input id="invite-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          {fieldError('fullName')}
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password">Password</Label>
          <Input id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">{PASSWORD_RULE_MESSAGE}</p>
          {fieldError('password')}
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password2">Confirm password</Label>
          <Input
            id="invite-password2"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />
          {fieldError('passwordConfirmation')}
        </div>
        <ConsentCheckbox id="invite-terms" checked={terms} onChange={setTerms}>
          I accept the Terms of Service
        </ConsentCheckbox>
        {fieldError('terms')}
        <ConsentCheckbox id="invite-privacy" checked={privacy} onChange={setPrivacy}>
          I accept the Privacy Policy
        </ConsentCheckbox>
        {fieldError('privacy')}
        <ConsentCheckbox id="invite-group-consent" checked={consent} onChange={setConsent}>
          {CONSENT_TEXT}
        </ConsentCheckbox>
        {fieldError('consent')}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account and join'}
        </Button>
      </form>
    </>,
  );
}
