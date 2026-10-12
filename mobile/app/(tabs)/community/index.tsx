import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { useTabParam } from '@/src/navigation/useTabParam';
import FollowedCreatorsScreen from '@/src/screens/FollowedCreatorsScreen';
import GroupsScreen from '@/src/screens/GroupsScreen';
import { screenBackground } from '@/src/theme/tokens';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';

const SEGMENTS = ['groups', 'creators'] as const;

/** Community: Groups (invitations, team challenges) | Creators (the ones you follow; browse from there). */
export default function CommunityScreen() {
  const [segment, setSegment] = useTabParam(SEGMENTS, 'groups');
  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'groups', label: 'Groups' },
            { value: 'creators', label: 'Creators' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      <View style={styles.body}>{segment === 'groups' ? <GroupsScreen /> : <FollowedCreatorsScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  segments: { paddingHorizontal: 20, paddingTop: 12 },
  body: { flex: 1 },
});
