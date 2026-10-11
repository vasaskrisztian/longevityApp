import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { useTabParam } from '@/src/navigation/useTabParam';
import ExerciseScreen from '@/src/screens/ExerciseScreen';
import NutritionScreen from '@/src/screens/NutritionScreen';
import PersonalScreen from '@/src/screens/PersonalScreen';
import { colors } from '@/src/theme/tokens';

const SEGMENTS = ['personal', 'exercise', 'nutrition'] as const;

/** About me: the three profile forms (formerly Profile, Lifestyle and Nutrition) in one place. */
export default function AboutMeScreen() {
  const [segment, setSegment] = useTabParam(SEGMENTS, 'personal');
  return (
    <View style={styles.container}>
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'personal', label: 'Personal' },
            { value: 'exercise', label: 'Exercise' },
            { value: 'nutrition', label: 'Nutrition' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      <View style={styles.body}>
        {segment === 'personal' ? <PersonalScreen /> : null}
        {segment === 'exercise' ? <ExerciseScreen /> : null}
        {segment === 'nutrition' ? <NutritionScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segments: { paddingHorizontal: 20, paddingTop: 12 },
  body: { flex: 1 },
});
