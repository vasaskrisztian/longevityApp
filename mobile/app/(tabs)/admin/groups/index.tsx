import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { createAdminGroup, listAdminGroups, type GroupSummary } from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { TextField } from '@/src/components/ui/TextField';
import { GroupLogo } from '@/src/components/wellbeing/parts';
import { colors, fontFamily } from '@/src/theme/tokens';
import { pickLogo, type PickedLogo } from '@/src/utils/logoPicker';

/**
 * Corporate wellbeing — admin: all groups, and a form to create one (a name
 * and an optional logo is all a group needs). People, invitations and
 * challenges are managed inside the group (groups/[id]).
 */
export default function AdminGroupsScreen() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [logo, setLogo] = useState<Extract<PickedLogo, { ok: true }> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    listAdminGroups()
      .then((list) => {
        setGroups(list);
        setError(null);
      })
      .catch(() => setError('Could not load the groups.'));
  }, []);

  useFocusEffect(load);

  async function chooseLogo() {
    setFormError(null);
    const picked = await pickLogo();
    if (!picked) return;
    if (!picked.ok) {
      setFormError(picked.message);
      return;
    }
    setLogo(picked);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a name for the group.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const group = await createAdminGroup({ name: trimmed, ...(logo ? { logo: logo.upload } : {}) });
      setName('');
      setLogo(null);
      router.push(`/admin/groups/${group.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the group.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>New group</Text>
        {formError ? <Alert variant="destructive">{formError}</Alert> : null}
        <TextField label="Group name" value={name} onChangeText={setName} placeholder="e.g. Acme Ltd." maxLength={120} />
        <View style={styles.logoRow}>
          {logo ? (
            <Image source={{ uri: logo.previewUri }} style={styles.logoPreview} resizeMode="contain" accessibilityLabel="Selected logo" alt="Selected logo" />
          ) : (
            <GroupLogo size={56} />
          )}
          <View style={styles.logoActions}>
            <Button title={logo ? 'Choose another logo' : 'Choose a logo (optional)'} size="sm" variant="outline" onPress={chooseLogo} />
            {logo ? <Button title="Remove" size="sm" variant="ghost" onPress={() => setLogo(null)} /> : null}
          </View>
        </View>
        <Button title="Create group" onPress={create} loading={creating} />
      </Card>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {groups === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}
      {groups && groups.length === 0 ? <Text style={styles.empty}>No groups yet. Create the first one above.</Text> : null}

      {groups?.map((group) => (
        <Pressable key={group.id} onPress={() => router.push(`/admin/groups/${group.id}`)} accessibilityRole="button">
          <Card style={styles.row}>
            <GroupLogo logoUrl={group.logoUrl} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{group.name}</Text>
              <Text style={styles.rowSubtitle}>
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                {group.pendingInvitationCount > 0 ? ` · ${group.pendingInvitationCount} pending` : ''}
                {group.challengeCount > 0 ? ` · ${group.challengeCount} ${group.challengeCount === 1 ? 'challenge' : 'challenges'}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  card: { gap: 14 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 17, color: colors.foreground },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPreview: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.muted.default },
  logoActions: { flex: 1, gap: 6, alignItems: 'flex-start' },
  centered: { paddingVertical: 20, alignItems: 'center' },
  empty: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 16, color: colors.foreground },
  rowSubtitle: { marginTop: 2, fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
});
