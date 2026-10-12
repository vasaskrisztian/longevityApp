import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountError, changePassword, deleteAccount } from '@/src/api/account';
import { getPublicProfileStatus, setPublicProfileConsent, type PublicProfileStatus } from '@/src/api/creators';
import { getMyWellbeing, leaveGroup, type MyGroup } from '@/src/api/groups';
import { useSession } from '@/src/auth/useSession';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { TextField } from '@/src/components/ui/TextField';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { newPasswordProblem } from '@/src/validation/passwordChange';
import { confirmDestructive } from '@/src/utils/confirm';

/**
 * Me > Account: sign-in identity, the creator public-profile switch (CREATOR
 * accounts only), password change, who can see your data (groups, with Leave),
 * a factual summary of what the app holds, account deletion and Log out.
 */
export default function AccountScreen() {
  const { user, logout } = useSession();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Signed in as</Text>
        <Text style={styles.body}>{user?.email ?? '—'}</Text>
      </Card>

      <CreatorProfileCard />
      <ChangePasswordCard onChanged={() => logout()} />
      <DataSharingCard />
      <YourDataCard />
      <DeleteAccountCard onDeleted={() => logout()} />

      <Button title="Log out" variant="outline" onPress={() => logout()} />
    </ScrollView>
  );
}

function CreatorProfileCard() {
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
      <Text style={styles.cardTitle}>Creator public profile</Text>
      <Text style={styles.description}>
        {status.canPublish
          ? 'Your public protocols, challenges, and recent data are visible to anyone in the Creators directory.'
          : 'Turn this on to let followers see your public protocols, challenges, and recent data in the Creators directory.'}
      </Text>
      <Button
        title={toggling ? 'Updating…' : status.canPublish ? 'Make profile private' : 'Publish profile publicly'}
        variant={status.canPublish ? 'outline' : 'primary'}
        size="sm"
        onPress={toggle}
        loading={toggling}
      />
    </Card>
  );
}

function ChangePasswordCard({ onChanged }: { onChanged: () => void }) {
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
      setError(e instanceof AccountError ? e.message : 'Could not change the password. Please try again.');
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Change password</Text>
      <Text style={styles.description}>
        After the change you are signed out on all your devices and sign in again with the new password.
      </Text>
      {done ? (
        <Alert variant="success">Password updated. Signing you out…</Alert>
      ) : (
        <>
          <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <TextField label="Repeat new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <Button title="Change password" size="sm" onPress={submit} loading={saving} />
        </>
      )}
    </Card>
  );
}

function DataSharingCard() {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyWellbeing()
      .then((r) => {
        setGroups(r.groups);
        setError(null);
      })
      .catch(() => setError('Could not load your groups.'));
  }, []);

  useEffect(load, [load]);

  async function leave(group: MyGroup) {
    const confirmed = await confirmDestructive(
      `Leave ${group.name}?`,
      'The group’s administrators will no longer be able to see your health data, and you will be removed from its challenges.',
      'Leave group',
    );
    if (!confirmed) return;
    setLeavingId(group.id);
    try {
      await leaveGroup(group.id);
      load();
    } catch {
      setError('Could not leave the group. Please try again.');
    } finally {
      setLeavingId(null);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Who can see my data</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {groups === null && !error ? <Text style={styles.description}>Loading…</Text> : null}
      {groups && groups.length === 0 ? (
        <Text style={styles.description}>No group can see your health data. It is visible only to you.</Text>
      ) : null}
      {groups && groups.length > 0 ? (
        <>
          <Text style={styles.description}>
            Administrators of these groups can see your health data. You can stop sharing at any time by leaving a group.
          </Text>
          {groups.map((group) => (
            <View key={group.id} style={styles.row}>
              <Text style={[styles.body, styles.flex]}>{group.name}</Text>
              <Button title="Leave" variant="outline" size="sm" onPress={() => leave(group)} loading={leavingId === group.id} />
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function YourDataCard() {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Your data</Text>
      <Text style={styles.description}>
        The app stores your profile and goals, wearable and Apple Health readings, InBody measurements, protocols, supplements and
        challenge progress. Your data is visible only to you, plus the administrators of groups you have joined and the followers of a
        public creator profile you have published yourself.
      </Text>
      <Text style={styles.description}>Deleting your account (below) permanently removes all of it.</Text>
    </Card>
  );
}

function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    const confirmed = await confirmDestructive(
      'Delete your account?',
      'Your account and all of your data will be permanently deleted. This cannot be undone.',
      'Delete account',
    );
    if (!confirmed) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Could not delete the account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Delete account</Text>
      <Text style={styles.description}>
        Permanently deletes your account and all of your data, and disconnects your wearable. This cannot be undone.
      </Text>
      {open ? (
        <>
          <TextField label="Your password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <View style={styles.row}>
            <Button title="Delete my account" variant="destructive" size="sm" onPress={submit} loading={deleting} />
            <Button
              title="Cancel"
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
        <Button title="Delete account…" variant="outline" size="sm" onPress={() => setOpen(true)} />
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
