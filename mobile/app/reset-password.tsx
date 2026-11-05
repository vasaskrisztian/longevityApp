import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { confirmPasswordReset, requestPasswordReset } from '@/src/api/auth';
import { AuthLayout } from '@/src/components/AuthLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { RequestPasswordResetFormSchema, ResetPasswordFormSchema } from '@/src/validation/schemas';
import { tDynamic, useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Mirrors src/app/(auth)/reset-password/page.tsx: with no `token` query
 * param it's the "send me a reset link" form; with `?token=…` (the link in
 * the reset email — /reset-password?token=… on the app's own domain) it's
 * the "choose a new password" form. Deliberately NOT redirected away when
 * signed in — resetting a password while logged in is legitimate.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return token ? <ConfirmResetForm token={token} /> : <RequestResetForm />;
}

function BackToLogin() {
  const { t } = useT();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={styles.linkRow}>
      <Text style={styles.link}>{t('auth.reset.backToLogin')}</Text>
    </Pressable>
  );
}

function RequestResetForm() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    const parsed = RequestPasswordResetFormSchema.safeParse({ email });
    if (!parsed.success) {
      setError(tDynamic(parsed.error.errors[0]?.message ?? 'validation.emailInvalid'));
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await requestPasswordReset(parsed.data.email);
    setSubmitting(false);
    // Like the web page: any non-rate-limit outcome shows the same generic
    // confirmation, so the screen never reveals whether the account exists.
    if (!result.ok && result.reason === 'rate_limited') {
      setError(t('common.error.rateLimited'));
      return;
    }
    setSubmitted(true);
  }

  return (
    <AuthLayout title={t('auth.reset.requestTitle')}>
      {submitted ? (
        <Alert variant="success">{t('auth.reset.sent')}</Alert>
      ) : (
        <>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <TextField
            label={t('auth.field.email')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleSubmit}
          />
          <Button title={submitting ? t('auth.reset.sending') : t('auth.reset.send')} onPress={handleSubmit} loading={submitting} />
        </>
      )}
      <BackToLogin />
    </AuthLayout>
  );
}

function ConfirmResetForm({ token }: { token: string }) {
  const { t } = useT();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<{ password?: string; passwordConfirmation?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setServerError(null);
    const parsed = ResetPasswordFormSchema.safeParse({ password, passwordConfirmation });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        password: flat.password?.[0] ? tDynamic(flat.password[0]) : undefined,
        passwordConfirmation: flat.passwordConfirmation?.[0] ? tDynamic(flat.passwordConfirmation[0]) : undefined,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await confirmPasswordReset(token, parsed.data.password, parsed.data.passwordConfirmation);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(
        result.reason === 'rate_limited'
          ? t('common.error.rateLimited')
          : result.reason === 'invalid'
            ? t('auth.reset.linkInvalid')
            : t('common.error.generic'),
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthLayout title={t('auth.reset.confirmTitle')}>
        <Alert variant="success">{t('auth.reset.done')}</Alert>
        <Button title={t('auth.reset.logIn')} onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.reset.confirmTitle')}>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
      <TextField
        label={t('auth.reset.newPassword')}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <TextField
        label={t('auth.reset.confirmNewPassword')}
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={errors.passwordConfirmation}
        onSubmitEditing={handleSubmit}
      />
      <Button title={submitting ? t('auth.reset.updating') : t('auth.reset.update')} onPress={handleSubmit} loading={submitting} />
      <BackToLogin />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  linkRow: { alignItems: 'center' },
  link: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.accent.default },
});
