import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountError, changePassword, deleteAccount, saveAccountLanguage } from '@/src/api/account';
import { getPublicProfileStatus, setPublicProfileConsent, type PublicProfileStatus } from '@/src/api/creators';
import { getMyWellbeing, leaveGroup, type MyGroup } from '@/src/api/groups';
import { useSession } from '@/src/auth/useSession';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { LanguagePicker } from '@/src/components/ui/LanguagePicker';
import { TextField } from '@/src/components/ui/TextField';
import { setLanguage, useT, type Language } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { newPasswordProblem } from '@/src/validation/passwordChange';
import { confirmDestructive } from '@/src/utils/confirm';

/**
 * Me > Account: sign-in identity, the language of the app, the creator public-profile switch (CREATOR
 * accounts only), password change, who can see your data (groups, with Leave),
 * a factual summary of what the app holds, account deletion and Log out.
 */
export default function AccountScreen() {
  const { t } = useT();
  const { user, logout } = useSession();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('account.signedInAs')}</Text>
        <Text style={styles.body}>{user?.email ?? '—'}</Text>
      </Card>

      <LanguageCard />

      <CreatorProfileCard />
      <ChangePasswordCard onChanged={() => logout()} />
      <DataSharingCard />
      <YourDataCard />
      <DeleteAccountCard onDeleted={() => logout()} />

      <Button title={t('common.logOut')} variant="outline" onPress={() => logout()} />
    </ScrollView>
  );
}

/** The preferred language: switches the app at once and saves it on the account (emails and notifications follow it). */
function LanguageCard() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);

  async function changed(next: Language, previous: Language) {
    setError(null);
    try {
      await saveAccountLanguage(next);
    } catch (e) {
      // The account still has the old language — go back to it rather than show one the server does not know.
      setLanguage(previous);
      setError(e instanceof AccountError ? e.message : t('account.language.saveFailed'));
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('language.label')}</Text>
      <Text style={styles.description}>{t('language.description')}</Text>
      <LanguagePicker onChange={changed} />
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </Card>
  );
}

function CreatorProfileCard() {
  const { t } = useT();
  const [status, setStatus] = useState<PublicProfileStatus | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    getPublicProfileStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (status?.accountType !== 'CREATOR') return null;

  async function toggle() {
    if (!status) return;
    setToggling(true);
    const next = !status.canPublish;
    try {
      await setPublicProfileConsent(next);
      setStatus({ ...status, canPublish: next });
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.creator.title')}</Text>
      <Text style={styles.description}>
        {status.canPublish
          ? t('account.creator.publicDescription')
          : t('account.creator.privateDescription')}
      </Text>
      <Button
        title={toggling ? t('account.creator.updating') : status.canPublish ? t('account.creator.makePrivate') : t('account.creator.publish')}
        variant={status.canPublish ? 'outline' : 'primary'}
        size="sm"
        onPress={toggle}
        loading={toggling}
      />
    </Card>
  );
}

function ChangePasswordCard({ onChanged }: { onChanged: () => void }) {
  const { t } = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const problem = newPasswordProblem(current, next, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      // Every mobile session of the account is revoked by the server, so this
      // device has to sign in again with the new password too.
      setDone(true);
      setTimeout(onChanged, 1500);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : t('account.password.failed'));
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.password.title')}</Text>
      <Text style={styles.description}>{t('account.password.description')}</Text>
      {done ? (
        <Alert variant="success">{t('account.password.success')}</Alert>
      ) : (
        <>
          <TextField label={t('account.password.current')} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          <TextField label={t('account.password.new')} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <TextField label={t('account.password.repeat')} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <Button title={t('account.password.submit')} size="sm" onPress={submit} loading={saving} />
        </>
      )}
    </Card>
  );
}

function DataSharingCard() {
  const { t } = useT();
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyWellbeing()
      .then((r) => {
        setGroups(r.groups);
        setError(null);
      })
      .catch(() => setError(t('account.sharing.loadFailed')));
  }, [t]);

  useEffect(load, [load]);

  async function leave(group: MyGroup) {
    const confirmed = await confirmDestructive(
      t('account.sharing.leaveTitle', { name: group.name }),
      t('account.sharing.leaveMessage'),
      t('account.sharing.leaveConfirm'),
    );
    if (!confirmed) return;
    setLeavingId(group.id);
    try {
      await leaveGroup(group.id);
      load();
    } catch {
      setError(t('account.sharing.leaveFailed'));
    } finally {
      setLeavingId(null);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.sharing.title')}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {groups === null && !error ? <Text style={styles.description}>{t('common.loading')}</Text> : null}
      {groups && groups.length === 0 ? (
        <Text style={styles.description}>{t('account.sharing.none')}</Text>
      ) : null}
      {groups && groups.length > 0 ? (
        <>
          <Text style={styles.description}>{t('account.sharing.description')}</Text>
          {groups.map((group) => (
            <View key={group.id} style={styles.row}>
              <Text style={[styles.body, styles.flex]}>{group.name}</Text>
              <Button title={t('common.leave')} variant="outline" size="sm" onPress={() => leave(group)} loading={leavingId === group.id} />
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function YourDataCard() {
  const { t } = useT();
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.data.title')}</Text>
      <Text style={styles.description}>{t('account.data.description')}</Text>
      <Text style={styles.description}>{t('account.data.deleteNote')}</Text>
    </Card>
  );
}

function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    if (!password) {
      setError(t('account.delete.enterPassword'));
      return;
    }
    const confirmed = await confirmDestructive(
      t('account.delete.confirmTitle'),
      t('account.delete.confirmMessage'),
      t('account.delete.confirmButton'),
    );
    if (!confirmed) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : t('account.delete.failed'));
      setDeleting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.delete.title')}</Text>
      <Text style={styles.description}>{t('account.delete.description')}</Text>
      {open ? (
        <>
          <TextField label={t('account.delete.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <View style={styles.row}>
            <Button title={t('account.delete.submit')} variant="destructive" size="sm" onPress={submit} loading={deleting} />
            <Button
              title={t('common.cancel')}
              variant="outline"
              size="sm"
              onPress={() => {
                setOpen(false);
                setPassword('');
                setError(null);
              }}
              disabled={deleting}
            />
          </View>
        </>
      ) : (
        <Button title={t('account.delete.open')} variant="outline" size="sm" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  content: { padding: 20, gap: 16 },
  card: { gap: 10 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 17, color: colors.foreground },
  description: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
