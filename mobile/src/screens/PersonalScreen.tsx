import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getProfileBundle, updatePersonalInfo } from '@/src/api/profile';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { tDynamic, useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { GenderEnum, PersonalInfoSchema, enumLabel, type PersonalInfoInput } from '@/src/validation/schemas';

/**
 * Me > About me > Personal: view/edit personal info (mirrors the web app's
 * profile/page.tsx + personal-info-form.tsx). The nav rows and the creator
 * public-profile toggle that used to share this screen now live in the Plan
 * area and Me > Account.
 */

interface PersonalFormState {
  fullName: string;
  birthDate: string;
  gender: string | undefined;
  heightCm: string;
  weightKg: string;
  timezone: string;
}

export default function PersonalScreen() {
  const { t } = useT();
  const [form, setForm] = useState<PersonalFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<'load' | 'save' | null>(null);

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
      .catch(() => setServerError('load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!form) return;
    const parsed = PersonalInfoSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ? tDynamic(v[0]) : '']),
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
      setServerError('save');
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
        <Text style={styles.cardTitle}>{t('profile.personal.title')}</Text>
        <Text style={styles.cardDescription}>{t('profile.personal.description')}</Text>

        {serverError ? (
          <Alert variant="destructive">
            {serverError === 'load' ? t('profile.personal.loadFailed') : t('profile.saveFailed')}
          </Alert>
        ) : null}
        {saved ? <Alert variant="success">{t('profile.saved')}</Alert> : null}

        <TextField
          label={t('profile.field.fullName')}
          value={form.fullName}
          onChangeText={(v) => setForm({ ...form, fullName: v })}
          error={errors.fullName}
        />
        <TextField
          label={t('profile.field.birthDate')}
          value={form.birthDate}
          onChangeText={(v) => setForm({ ...form, birthDate: v })}
          error={errors.birthDate}
        />
        <ChipSingleSelect
          label={t('profile.field.gender')}
          options={GenderEnum.options.map((v): ChipOption => ({ value: v, label: enumLabel(v) }))}
          value={form.gender}
          onChange={(v) => setForm({ ...form, gender: v })}
        />
        <TextField
          label={t('profile.field.height')}
          keyboardType="numeric"
          value={form.heightCm}
          onChangeText={(v) => setForm({ ...form, heightCm: v })}
          error={errors.heightCm}
        />
        <TextField
          label={t('profile.field.weight')}
          keyboardType="numeric"
          value={form.weightKg}
          onChangeText={(v) => setForm({ ...form, weightKg: v })}
          error={errors.weightKg}
        />
        <TextField
          label={t('profile.field.timezone')}
          value={form.timezone}
          onChangeText={(v) => setForm({ ...form, timezone: v })}
          error={errors.timezone}
        />
        <Button title={saving ? t('common.saving') : t('profile.saveChanges')} onPress={save} loading={saving} />
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackground,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
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
