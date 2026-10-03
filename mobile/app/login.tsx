import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { z } from 'zod';

import { useSession, InvalidCredentialsError } from '@/src/auth/useSession';
import { colors, fontFamily } from '@/src/theme/tokens';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mirrors (tabs)/_layout.tsx's guard in the other direction — an already
  // signed-in user landing on /login (e.g. a stale bookmark/deep link)
  // goes straight to the app instead of seeing the form again.
  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setError(null);
    const parsed = LoginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Add meg az email címed és a jelszavad.');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(
        err instanceof InvalidCredentialsError
          ? 'Hibás email cím vagy jelszó.'
          : 'Nem sikerült bejelentkezni. Próbáld újra.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Longevity Klub</Text>
      <Text style={styles.subtitle}>Jelentkezz be a folytatáshoz</Text>

      <TextInput
        style={styles.input}
        placeholder="Email cím"
        placeholderTextColor={colors.muted.foreground}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Jelszó"
        placeholderTextColor={colors.muted.foreground}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.primary.foreground} />
        ) : (
          <Text style={styles.buttonText}>Bejelentkezés</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: colors.foreground,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: colors.muted.foreground,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fontFamily.sans,
    color: colors.foreground,
    backgroundColor: colors.card.default,
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary.default,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.primary.foreground,
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
  },
});
