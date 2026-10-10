import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { AuthLayout } from '@/src/components/AuthLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { useSession, InvalidCredentialsError } from '@/src/auth/useSession';
import { colors, fontFamily } from '@/src/theme/tokens';
import { safeNextPath } from '@/src/wellbeing/inviteFlow';

// Mirrors the web app's LoginSchema (lib/validation/auth.schemas.ts) —
// kept as a small duplicate rather than a cross-project import, since
// mobile/ is its own independent npm project (see
// claude/phase-15-mobile-migration-plan.md). If this drifts from the web
// schema it's a UX nit (a slightly different client-side error message),
// never a security issue — the server re-validates with the real schema
// regardless.
const LoginFormSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export default function LoginScreen() {
  const { status, login } = useSession();
  const router = useRouter();
  // The verify-email API route redirects here with ?verified=1 once the
  // emailed link has been opened — same banner the web login shows.
  const { verified, next } = useLocalSearchParams<{ verified?: string; next?: string }>();
  // Invitation links send signed-out people here and expect them back afterwards.
  const nextPath = safeNextPath(next);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mirrors (tabs)/_layout.tsx's guard in the other direction — an already
  // signed-in user landing on /login (e.g. a stale bookmark/deep link)
  // goes straight to the app instead of seeing the form again.
  if (status === 'signedIn') {
    return <Redirect href={(nextPath ?? '/') as never} />;
  }

  async function handleSubmit() {
    setError(null);
    const parsed = LoginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (err) {
      // Same deliberately vague wording as the web login: it must not reveal
      // whether the password was wrong or the account is unverified/suspended.
      setError(
        err instanceof InvalidCredentialsError
          ? 'Invalid email or password, or your account is not verified yet.'
          : 'Could not log in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in">
      {verified === '1' ? <Alert variant="success">Your email is verified — you can log in now.</Alert> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <TextField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
      />

      <Button title={submitting ? 'Logging in…' : 'Log in'} onPress={handleSubmit} loading={submitting} />

      <View style={styles.links}>
        <Pressable onPress={() => router.push('/register')} accessibilityRole="link">
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/reset-password')} accessibilityRole="link">
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: 10, marginTop: 4 },
  link: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.accent.default },
});
