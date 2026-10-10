import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getProfileBundle, updatePersonalInfo } from '@/src/api/profile';
import { getPublicProfileStatus, setPublicProfileConsent, type PublicProfileStatus } from '@/src/api/creators';
import { useSession } from '@/src/auth/useSession';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { colors, fontFamily } from '@/src/theme/tokens';
import { GenderEnum, PersonalInfoSchema, enumLabel, type PersonalInfoInput } from '@/src/validation/schemas';

/**
 * The Profile tab's hub screen — personal info (view/edit, mirrors the web
 * app's profile/page.tsx + personal-info-form.tsx) plus nav rows into the
 * Goals/Supplements/Nutrition/Lifestyle/Discover/Protocols/Challenges
 * sub-screens, same grouping the web sidebar uses. Phase 20 (see
 * claude/phase-15-mobile-migration-plan.md) adds the creator public-profile
 * toggle below, mirroring the web app's creator-consent-toggle.tsx — shown
 * only for an account the admin has granted CREATOR status, fetched
 * separately from the personal-info bundle above since it comes from the
 * creators module, not the profile module.
 */

const GENDER_OPTIONS: ChipOption[] = GenderEnum.options.map((v) => ({ value: v, label: enumLabel(v) }));

interface PersonalFormState {
  fullName: string;
  birthDate: string;
  gender: string | undefined;
  heightCm: string;
  weightKg: string;
  timezone: string;
}

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <Text style={styles.navRowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
    </Pressable>
  );
}

export default function ProfileHomeScreen() {
  const { user, logout } = useSession();
  const [form, setForm] = useState<PersonalFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [publicProfileStatus, setPublicProfileStatus] = useState<PublicProfileStatus | null>(null);
  const [togglingConsent, setTogglingConsent] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getProfileBundle()
      .then((bundle) => {
        setForm({
          fullName: bundle.profile?.fullName ?? '',
          birthDate: bundle.profile?.birthDate ?? '',
          gender: bundle.profile?.gender ?? undefined,
          heightCm: bundle.profile ? String(bundle.profile.heightCm) : '',
          weightKg: bundle.profile ? String(bundle.profile.weightKg) : '',
          timezone: bundle.profile?.timezone ?? 'UTC',
        });
      })
      .catch(() => setServerError('Could not load your profile.'))
      .finally(() => setLoading(false));
    getPublicProfileStatus()
      .then(setPublicProfileStatus)
      .catch(() => setPublicProfileStatus(null));
  }, []);

  useEffect(load, [load]);

  async function handleToggleConsent() {
    if (!publicProfileStatus) return;
    setTogglingConsent(true);
    const nextConsent = !publicProfileStatus.canPublish;
    try {
      await setPublicProfileConsent(nextConsent);
      setPublicProfileStatus({ ...publicProfileStatus, canPublish: nextConsent });
    } finally {
      setTogglingConsent(false);
    }
  }

  async function save() {
    if (!form) return;
    const parsed = PersonalInfoSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
      ));
      return;
    }
    setErrors({});
    setServerError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updatePersonalInfo(parsed.data as PersonalInfoInput);
      setSaved(true);
    } catch {
      setServerError('Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Personal information</Text>
        <Text style={styles.cardDescription}>Used for your dashboard and to personalize insights.</Text>

        {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
        {saved ? <Alert variant="success">Saved.</Alert> : null}

        <TextField
          label="Full name"
          value={form.fullName}
          onChangeText={(v) => setForm({ ...form, fullName: v })}
          error={errors.fullName}
        />
        <TextField
          label="Birth date (yyyy-mm-dd)"
          value={form.birthDate}
          onChangeText={(v) => setForm({ ...form, birthDate: v })}
          error={errors.birthDate}
        />
        <ChipSingleSelect
          label="Gender"
          options={GENDER_OPTIONS}
          value={form.gender}
          onChange={(v) => setForm({ ...form, gender: v })}
        />
        <TextField
          label="Height (cm)"
          keyboardType="numeric"
          value={form.heightCm}
          onChangeText={(v) => setForm({ ...form, heightCm: v })}
          error={errors.heightCm}
        />
        <TextField
          label="Weight (kg)"
          keyboardType="numeric"
          value={form.weightKg}
          onChangeText={(v) => setForm({ ...form, weightKg: v })}
          error={errors.weightKg}
        />
        <TextField
          label="Timezone"
          value={form.timezone}
          onChangeText={(v) => setForm({ ...form, timezone: v })}
          error={errors.timezone}
        />
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={save} loading={saving} />
      </Card>

      <Card style={styles.navCard}>
        <NavRow label="Goals" onPress={() => router.push('/profile/goals')} />
        <View style={styles.navDivider} />
        <NavRow label="Supplements" onPress={() => router.push('/profile/supplements')} />
        <View style={styles.navDivider} />
        <NavRow label="Nutrition" onPress={() => router.push('/profile/nutrition')} />
        <View style={styles.navDivider} />
        <NavRow label="Lifestyle" onPress={() => router.push('/profile/lifestyle')} />
        <View style={styles.navDivider} />
        <NavRow label="InBody" onPress={() => router.push('/profile/inbody')} />
      </Card>

      <Card style={styles.navCard}>
        <NavRow label="Discover" onPress={() => router.push('/profile/discover')} />
        <View style={styles.navDivider} />
        <NavRow label="Protocols" onPress={() => router.push('/profile/protocols')} />
        <View style={styles.navDivider} />
        <NavRow label="Challenges" onPress={() => router.push('/profile/challenges')} />
        <View style={styles.navDivider} />
        <NavRow label="Creators" onPress={() => router.push('/profile/creators')} />
        <View style={styles.navDivider} />
        <NavRow label="Wellbeing" onPress={() => router.push('/profile/wellbeing')} />
      </Card>

      {publicProfileStatus?.accountType === 'CREATOR' ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Creator public profile</Text>
          <Text style={styles.cardDescription}>
            {publicProfileStatus.canPublish
              ? 'Your public protocols, challenges, and recent data are visible to anyone in the Creators directory.'
              : 'Turn this on to let followers see your public protocols, challenges, and recent data in the Creators directory.'}
          </Text>
          <Button
            title={togglingConsent ? 'Updating…' : publicProfileStatus.canPublish ? 'Make profile private' : 'Publish profile publicly'}
            variant={publicProfileStatus.canPublish ? 'outline' : 'primary'}
            size="sm"
            onPress={handleToggleConsent}
            loading={togglingConsent}
          />
        </Card>
      ) : null}

      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      <Button title="Kijelentkezés" variant="destructive" onPress={() => logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: 14,
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 17,
    color: colors.foreground,
  },
  cardDescription: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
    marginTop: -8,
  },
  navCard: {
    padding: 0,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  navRowLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    color: colors.foreground,
  },
  navDivider: {
    height: 1,
    backgroundColor: colors.card.border,
  },
  email: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
    textAlign: 'center',
  },
});
