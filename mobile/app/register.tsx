import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { registerAccount } from '@/src/api/auth';
import { useSession } from '@/src/auth/useSession';
import { AuthLayout } from '@/src/components/AuthLayout';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Checkbox } from '@/src/components/ui/Checkbox';
import { TextField } from '@/src/components/ui/TextField';
import { RegisterFormSchema } from '@/src/validation/schemas';
import { colors, fontFamily } from '@/src/theme/tokens';

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'passwordConfirmation' | 'termsAccepted' | 'privacyAccepted', string>>;

/** Mirrors src/app/(auth)/register/page.tsx. */
export default function RegisterScreen() {
  const { status } = useSession();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setServerError(null);
    const parsed = RegisterFormSchema.safeParse({
      fullName,
      email,
      password,
      passwordConfirmation,
      termsAccepted,
      privacyAccepted,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        fullName: flat.fullName?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
        passwordConfirmation: flat.passwordConfirmation?.[0],
        termsAccepted: flat.termsAccepted?.[0],
        privacyAccepted: flat.privacyAccepted?.[0],
      });
      return;
    }
    setErrors({});

    setSubmitting(true);
    const result = await registerAccount(parsed.data);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(
        result.reason === 'rate_limited'
          ? 'Too many requests. Try again later.'
          : 'Something went wrong. Please try again.',
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthLayout title="Check your email">
        <Text style={styles.body}>
          If your email is valid, we’ve sent a verification link. You need to verify your email before you can log in.
        </Text>
        <Button title="Back to log in" variant="outline" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}

      <TextField label="Full name" autoComplete="name" value={fullName} onChangeText={setFullName} error={errors.fullName} />
      <TextField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <View style={styles.passwordBlock}>
        <TextField
          label="Password"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <Text style={styles.hint}>At least 10 characters, with an uppercase letter, a lowercase letter and a digit.</Text>
      </View>
      <TextField
        label="Confirm password"
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={errors.passwordConfirmation}
      />

      <Checkbox label="I accept the Terms of Service" checked={termsAccepted} onChange={setTermsAccepted} error={errors.termsAccepted} />
      <Checkbox
        label="I accept the Privacy Policy"
        checked={privacyAccepted}
        onChange={setPrivacyAccepted}
        error={errors.privacyAccepted}
      />

      <Button title={submitting ? 'Creating account…' : 'Create account'} onPress={handleSubmit} loading={submitting} />

      <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={styles.linkRow}>
        <Text style={styles.hint}>
          Already have an account? <Text style={styles.link}>Log in</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground },
  passwordBlock: { gap: 6 },
  hint: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  linkRow: { alignItems: 'center' },
  link: { fontFamily: fontFamily.sansMedium, color: colors.accent.default },
});
