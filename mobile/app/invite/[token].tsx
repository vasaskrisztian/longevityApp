import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { acceptInvitationByToken, previewInvitation, type InvitationPreview } from '@/src/api/groups';
import { registerFromInvitation } from '@/src/api/auth';
import { useSession } from '@/src/auth/useSession';
import { AuthLayout } from '@/src/components/AuthLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Checkbox } from '@/src/components/ui/Checkbox';
import { TextField } from '@/src/components/ui/TextField';
import { GroupLogo } from '@/src/components/wellbeing/parts';
import { RegisterFormSchema } from '@/src/validation/schemas';
import { colors, fontFamily } from '@/src/theme/tokens';
import { inviteView } from '@/src/wellbeing/inviteFlow';

const CONSENT_TEXT =
  'I agree that the administrators of this group can see my health data (sleep, activity, workouts and device sync status) while I am a member. I can leave the group at any time, which ends their access immediately.';

type FieldErrors = Partial<Record<'fullName' | 'password' | 'passwordConfirmation' | 'termsAccepted' | 'privacyAccepted' | 'groupConsent', string>>;

/**
 * Public landing screen of an invitation e-mail link (/invite/<token>):
 * - signed in with the invited address: explicit health-data consent + accept
 * - signed in as somebody else: explains the mismatch, offers log out
 * - signed out, account exists: log in, then come back here
 * - signed out, no account: register right here (already e-mail verified by the invitation)
 */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { status, user, login, logout } = useSession();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewInvitation(String(token ?? '')).then((result) => {
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [accountExistsNow, setAccountExistsNow] = useState(false);

  const view = status === 'loading'
    ? ({ kind: 'loading' } as const)
    : inviteView(
        accountExistsNow && preview ? { ...preview, accountExists: true } : preview,
        loading,
        { signedIn: status === 'signedIn', email: user?.email ?? null },
      );

  async function accept() {
    if (!consent) {
      setError('Please confirm the consent to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationByToken(String(token));
      router.replace('/profile/wellbeing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    if (!preview?.email) return;
    setError(null);
    const parsed = RegisterFormSchema.safeParse({
      fullName,
      email: preview.email,
      password,
      passwordConfirmation,
      termsAccepted,
      privacyAccepted,
    });
    const errors: FieldErrors = {};
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      errors.fullName = flat.fullName?.[0];
      errors.password = flat.password?.[0];
      errors.passwordConfirmation = flat.passwordConfirmation?.[0];
      errors.termsAccepted = flat.termsAccepted?.[0];
      errors.privacyAccepted = flat.privacyAccepted?.[0];
    }
    if (!consent) errors.groupConsent = 'You must give this consent to join the group';
    setFieldErrors(errors);
    if (!parsed.success || !consent) return;

    setBusy(true);
    const result = await registerFromInvitation({
      fullName: parsed.data.fullName,
      email: preview.email,
      password: parsed.data.password,
      passwordConfirmation: parsed.data.passwordConfirmation,
      termsAccepted: true,
      privacyAccepted: true,
      inviteToken: String(token),
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
    try {
      await login(preview.email, parsed.data.password);
      router.replace('/profile/wellbeing');
    } catch {
      setError('Your account was created. Please log in to continue.');
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  const header = preview && preview.status === 'valid' ? (
    <View style={styles.header}>
      <GroupLogo logoUrl={preview.logoUrl} size={56} />
      <Text style={styles.groupName}>{preview.groupName}</Text>
      <Text style={styles.muted}>invited {preview.email} to join their wellbeing group.</Text>
    </View>
  ) : null;

  if (view.kind === 'loading') {
    return (
      <AuthLayout title="Invitation">
        <ActivityIndicator color={colors.primary.default} />
      </AuthLayout>
    );
  }

  if (view.kind === 'unavailable') {
    return (
      <AuthLayout title="Invitation">
        <Alert variant="destructive">{view.message}</Alert>
        {!preview ? <Button title="Try again" variant="outline" onPress={() => setRetry((n) => n + 1)} /> : null}
        <Button title={status === 'signedIn' ? 'Open the app' : 'Go to log in'} variant="outline" onPress={() => router.replace(status === 'signedIn' ? '/' : '/login')} />
      </AuthLayout>
    );
  }

  if (view.kind === 'wrong_account') {
    return (
      <AuthLayout title="Wrong account">
        {header}
        <Alert variant="destructive">
          {`This invitation is for ${view.invitedEmail}, but you are signed in as ${view.currentEmail}. Log out and sign in (or register) with the invited address.`}
        </Alert>
        <Button title="Log out" onPress={() => logout()} />
      </AuthLayout>
    );
  }

  if (view.kind === 'login') {
    return (
      <AuthLayout title="Join the group">
        {header}
        <Text style={styles.body}>There is already an account for this address. Log in to accept the invitation.</Text>
        <Button title="Log in" onPress={() => router.replace({ pathname: '/login', params: { next: `/invite/${String(token)}` } })} />
      </AuthLayout>
    );
  }

  if (view.kind === 'accept') {
    return (
      <AuthLayout title="Join the group">
        {header}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Checkbox label={CONSENT_TEXT} checked={consent} onChange={setConsent} />
        <Button title={busy ? 'Joining…' : 'Accept invitation'} onPress={accept} loading={busy} disabled={!consent} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      {header}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <TextField label="Email" value={preview?.email ?? ''} editable={false} autoCapitalize="none" />
      <TextField label="Full name" autoComplete="name" value={fullName} onChangeText={setFullName} error={fieldErrors.fullName} />
      <View style={styles.passwordBlock}>
        <TextField label="Password" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} error={fieldErrors.password} />
        <Text style={styles.hint}>At least 10 characters, with an uppercase letter, a lowercase letter and a digit.</Text>
      </View>
      <TextField
        label="Confirm password"
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={fieldErrors.passwordConfirmation}
      />
      <Checkbox label="I accept the Terms of Service" checked={termsAccepted} onChange={setTermsAccepted} error={fieldErrors.termsAccepted} />
      <Checkbox label="I accept the Privacy Policy" checked={privacyAccepted} onChange={setPrivacyAccepted} error={fieldErrors.privacyAccepted} />
      <Checkbox label={CONSENT_TEXT} checked={consent} onChange={setConsent} error={fieldErrors.groupConsent} />
      <Button title={busy ? 'Creating account…' : 'Create account and join'} onPress={register} loading={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6 },
  groupName: { fontFamily: fontFamily.sansSemibold, fontSize: 18, color: colors.foreground, textAlign: 'center' },
  muted: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground, textAlign: 'center' },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground },
  passwordBlock: { gap: 6 },
  hint: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
});
