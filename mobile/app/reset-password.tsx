import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { confirmPasswordReset, requestPasswordReset } from '@/src/api/auth';
import { AuthLayout } from '@/src/components/AuthLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { RequestPasswordResetFormSchema, ResetPasswordFormSchema } from '@/src/validation/schemas';
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
  const router = useRouter();
  return (
    <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={styles.linkRow}>
      <Text style={styles.link}>Back to log in</Text>
    </Pressable>
  );
}

function RequestResetForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    const parsed = RequestPasswordResetFormSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await requestPasswordReset(parsed.data.email);
    setSubmitting(false);
    // Like the web page: any non-rate-limit outcome shows the same generic
    // confirmation, so the screen never reveals whether the account exists.
    if (!result.ok && result.reason === 'rate_limited') {
      setError('Too many requests. Try again later.');
      return;
    }
    setSubmitted(true);
  }

  return (
    <AuthLayout title="Reset your password">
      {submitted ? (
        <Alert variant="success">If that email is registered, a reset link has been sent to it.</Alert>
      ) : (
        <>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleSubmit}
          />
          <Button title={submitting ? 'Sending…' : 'Send reset link'} onPress={handleSubmit} loading={submitting} />
        </>
      )}
      <BackToLogin />
    </AuthLayout>
  );
}

function ConfirmResetForm({ token }: { token: string }) {
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
      setErrors({ password: flat.password?.[0], passwordConfirmation: flat.passwordConfirmation?.[0] });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await confirmPasswordReset(token, parsed.data.password, parsed.data.passwordConfirmation);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(
        result.reason === 'rate_limited'
          ? 'Too many requests. Try again later.'
          : result.reason === 'invalid'
            ? 'This reset link is invalid or has expired.'
            : 'Something went wrong. Please try again.',
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthLayout title="Choose a new password">
        <Alert variant="success">Password updated. You can now log in.</Alert>
        <Button title="Log in" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
      <TextField
        label="New password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <TextField
        label="Confirm new password"
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={errors.passwordConfirmation}
        onSubmitEditing={handleSubmit}
      />
      <Button title={submitting ? 'Updating…' : 'Update password'} onPress={handleSubmit} loading={submitting} />
      <BackToLogin />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  linkRow: { alignItems: 'center' },
  link: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.accent.default },
});
