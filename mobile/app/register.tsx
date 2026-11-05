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
import { tDynamic, useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'passwordConfirmation' | 'termsAccepted' | 'privacyAccepted', string>>;

/** Mirrors src/app/(auth)/register/page.tsx. The language switch on top (AuthLayout) sets the new account's language. */
export default function RegisterScreen() {
  const { t } = useT();
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
      const text = (message?: string) => (message ? tDynamic(message) : undefined);
      setErrors({
        fullName: text(flat.fullName?.[0]),
        email: text(flat.email?.[0]),
        password: text(flat.password?.[0]),
        passwordConfirmation: text(flat.passwordConfirmation?.[0]),
        termsAccepted: text(flat.termsAccepted?.[0]),
        privacyAccepted: text(flat.privacyAccepted?.[0]),
      });
      return;
    }
    setErrors({});

    setSubmitting(true);
    const result = await registerAccount(parsed.data);
    setSubmitting(false);
    if (!result.ok) {
      setServerError(
        result.reason === 'rate_limited' ? t('common.error.rateLimited') : t('common.error.generic'),
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthLayout title={t('auth.register.checkEmailTitle')}>
        <Text style={styles.body}>{t('auth.register.checkEmailBody')}</Text>
        <Button title={t('auth.register.backToLogin')} variant="outline" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.register.title')}>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}

      <TextField label={t('auth.field.fullName')} autoComplete="name" value={fullName} onChangeText={setFullName} error={errors.fullName} />
      <TextField
        label={t('auth.field.email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <View style={styles.passwordBlock}>
        <TextField
          label={t('auth.field.password')}
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <Text style={styles.hint}>{t('auth.register.passwordHint')}</Text>
      </View>
      <TextField
        label={t('auth.field.confirmPassword')}
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={errors.passwordConfirmation}
      />

      <Checkbox label={t('auth.register.terms')} checked={termsAccepted} onChange={setTermsAccepted} error={errors.termsAccepted} />
      <Checkbox
        label={t('auth.register.privacy')}
        checked={privacyAccepted}
        onChange={setPrivacyAccepted}
        error={errors.privacyAccepted}
      />

      <Button title={submitting ? t('auth.register.submitting') : t('auth.register.submit')} onPress={handleSubmit} loading={submitting} />

      <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" style={styles.linkRow}>
        <Text style={styles.hint}>
          {t('auth.register.haveAccount')} <Text style={styles.link}>{t('auth.register.logIn')}</Text>
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
