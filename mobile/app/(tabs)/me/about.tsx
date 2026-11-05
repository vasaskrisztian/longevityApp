import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { useT } from '@/src/i18n';
import { useTabParam } from '@/src/navigation/useTabParam';
import ExerciseScreen from '@/src/screens/ExerciseScreen';
import NutritionScreen from '@/src/screens/NutritionScreen';
import PersonalScreen from '@/src/screens/PersonalScreen';
import { screenBackground } from '@/src/theme/tokens';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';

const SEGMENTS = ['personal', 'exercise', 'nutrition'] as const;

/** About me: the three profile forms (formerly Profile, Lifestyle and Nutrition) in one place. */
export default function AboutMeScreen() {
  const { t } = useT();
  const [segment, setSegment] = useTabParam(SEGMENTS, 'personal');
  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'personal', label: t('nav.segment.personal') },
            { value: 'exercise', label: t('nav.segment.exercise') },
            { value: 'nutrition', label: t('nav.segment.nutrition') },
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
  container: { flex: 1, backgroundColor: screenBackground },
  segments: { paddingHorizontal: 20, paddingTop: 12 },
  body: { flex: 1 },
});
