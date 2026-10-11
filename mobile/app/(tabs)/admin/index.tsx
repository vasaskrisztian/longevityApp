import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { useTabParam } from '@/src/navigation/useTabParam';
import AdminGroupsScreen from '@/src/screens/admin/AdminGroupsScreen';
import AdminUsersScreen from '@/src/screens/admin/AdminUsersScreen';
import { colors } from '@/src/theme/tokens';

const SEGMENTS = ['groups', 'users'] as const;

/**
 * Admin: Groups (create, invite, challenges — the day-to-day work) | Users
 * (KPIs, search and the full user list). Previously the groups were hidden
 * behind a card above the user table.
 */
export default function AdminScreen() {
  const [segment, setSegment] = useTabParam(SEGMENTS, 'groups');
  return (
    <View style={styles.container}>
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'groups', label: 'Groups' },
            { value: 'users', label: 'Users' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      <View style={styles.body}>{segment === 'groups' ? <AdminGroupsScreen /> : <AdminUsersScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segments: { paddingHorizontal: 20, paddingTop: 12 },
  body: { flex: 1 },
});
