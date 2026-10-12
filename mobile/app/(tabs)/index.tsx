import { StyleSheet, Text, View } from 'react-native';

import { BellButton } from '@/src/components/BellButton';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { useTabParam } from '@/src/navigation/useTabParam';
import DashboardScreen from '@/src/screens/DashboardScreen';
import InBodyScreen from '@/src/screens/InBodyScreen';
import TrendsScreen from '@/src/screens/TrendsScreen';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';

const SEGMENTS = ['today', 'trends', 'body'] as const;

/**
 * Today: the day's scores (the old Dashboard), the 7/30-day charts (the old
 * Trends tab) and body composition (InBody, previously buried in Profile)
 * behind one segmented switch — "how am I doing" lives in a single place.
 */
export default function TodayScreen() {
  const [segment, setSegment] = useTabParam(SEGMENTS, 'today');
  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <BellButton />
      </View>
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'today', label: 'Today' },
            { value: 'trends', label: 'Trends' },
            { value: 'body', label: 'Body' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      <View style={styles.body}>
        {segment === 'today' ? <DashboardScreen /> : null}
        {segment === 'trends' ? <TrendsScreen /> : null}
        {segment === 'body' ? <InBodyScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: fontFamily.display, fontSize: 28, color: colors.foreground },
  segments: { paddingHorizontal: 20, paddingTop: 12 },
  body: { flex: 1 },
});
