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
import { tDynamic, useT } from '@/src/i18n';
import { RegisterFormSchema } from '@/src/validation/schemas';
import { colors, fontFamily } from '@/src/theme/tokens';
import { inviteView } from '@/src/wellbeing/inviteFlow';

type FieldErrors = Partial<Record<'fullName' | 'password' | 'passwordConfirmation' | 'termsAccepted' | 'privacyAccepted' | 'groupConsent', string>>;

/**
 * Public landing screen of an invitation e-mail link (/invite/<token>):
 * - signed in with the invited address: explicit health-data consent + accept
 * - signed in as somebody else: explains the mismatch, offers log out
 * - signed out, account exists: log in, then come back here
 * - signed out, no account: register right here (already e-mail verified by the invitation)
 */
export default function InviteScreen() {
  const { t } = useT();
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
      setError(t('invite.consentRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationByToken(String(token));
      router.replace('/community');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.accept.failed'));
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
      const text = (message?: string) => (message ? tDynamic(message) : undefined);
      errors.fullName = text(flat.fullName?.[0]);
      errors.password = text(flat.password?.[0]);
      errors.passwordConfirmation = text(flat.passwordConfirmation?.[0]);
      errors.termsAccepted = text(flat.termsAccepted?.[0]);
      errors.privacyAccepted = text(flat.privacyAccepted?.[0]);
    }
    if (!consent) errors.groupConsent = t('validation.groupConsentRequired');
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
      else if (result.reason === 'rate_limited') setError(t('common.error.rateLimited'));
      else if (result.reason === 'invalid') setError(result.message ?? t('invite.register.invalid'));
      else setError(t('common.error.generic'));
      return;
    }
    try {
      await login(preview.email, parsed.data.password);
      router.replace('/community');
    } catch {
      setError(t('invite.register.accountCreatedLogin'));
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  const header = preview && preview.status === 'valid' ? (
    <View style={styles.header}>
      <GroupLogo logoUrl={preview.logoUrl} size={56} />
      <Text style={styles.groupName}>{preview.groupName}</Text>
      <Text style={styles.muted}>{t('invite.header.invited', { email: preview.email ?? '' })}</Text>
    </View>
  ) : null;

  if (view.kind === 'loading') {
    return (
      <AuthLayout title={t('invite.title')}>
        <ActivityIndicator color={colors.primary.default} />
      </AuthLayout>
    );
  }

  if (view.kind === 'unavailable') {
    return (
      <AuthLayout title={t('invite.title')}>
        <Alert variant="destructive">{view.message}</Alert>
        {!preview ? <Button title={t('common.retry')} variant="outline" onPress={() => setRetry((n) => n + 1)} /> : null}
        <Button title={status === 'signedIn' ? t('invite.openApp') : t('invite.goToLogin')} variant="outline" onPress={() => router.replace(status === 'signedIn' ? '/' : '/login')} />
      </AuthLayout>
    );
  }

  if (view.kind === 'wrong_account') {
    return (
      <AuthLayout title={t('invite.wrongAccount.title')}>
        {header}
        <Alert variant="destructive">
          {t('invite.wrongAccount.message', { invitedEmail: view.invitedEmail, currentEmail: view.currentEmail })}
        </Alert>
        <Button title={t('common.logOut')} onPress={() => logout()} />
      </AuthLayout>
    );
  }

  if (view.kind === 'login') {
    return (
      <AuthLayout title={t('invite.join.title')}>
        {header}
        <Text style={styles.body}>{t('invite.login.body')}</Text>
        <Button title={t('auth.register.logIn')} onPress={() => router.replace({ pathname: '/login', params: { next: `/invite/${String(token)}` } })} />
      </AuthLayout>
    );
  }

  if (view.kind === 'accept') {
    return (
      <AuthLayout title={t('invite.join.title')}>
        {header}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Checkbox label={t('invite.consentText')} checked={consent} onChange={setConsent} />
        <Button title={busy ? t('invite.accept.submitting') : t('invite.accept.submit')} onPress={accept} loading={busy} disabled={!consent} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.register.title')}>
      {header}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <TextField label={t('auth.field.email')} value={preview?.email ?? ''} editable={false} autoCapitalize="none" />
      <TextField label={t('auth.field.fullName')} autoComplete="name" value={fullName} onChangeText={setFullName} error={fieldErrors.fullName} />
      <View style={styles.passwordBlock}>
        <TextField label={t('auth.field.password')} secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} error={fieldErrors.password} />
        <Text style={styles.hint}>{t('auth.register.passwordHint')}</Text>
      </View>
      <TextField
        label={t('auth.field.confirmPassword')}
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={fieldErrors.passwordConfirmation}
      />
      <Checkbox label={t('auth.register.terms')} checked={termsAccepted} onChange={setTermsAccepted} error={fieldErrors.termsAccepted} />
      <Checkbox label={t('auth.register.privacy')} checked={privacyAccepted} onChange={setPrivacyAccepted} error={fieldErrors.privacyAccepted} />
      <Checkbox label={t('invite.consentText')} checked={consent} onChange={setConsent} error={fieldErrors.groupConsent} />
      <Button title={busy ? t('auth.register.submitting') : t('invite.register.submit')} onPress={register} loading={busy} />
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
