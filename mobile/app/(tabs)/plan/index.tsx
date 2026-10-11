import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { HubList } from '@/src/components/ui/HubRow';
import { colors, fontFamily } from '@/src/theme/tokens';

export default function PlanScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>What you follow and what you aim for.</Text>
      <HubList
        items={[
          { label: 'Protocols', description: 'The routine you follow and its daily targets', icon: 'clipboard-outline', onPress: () => router.push('/plan/protocols') },
          { label: 'Supplements', description: 'What you take and when', icon: 'medkit-outline', onPress: () => router.push('/plan/supplements') },
          { label: 'Goals', description: 'Personal targets you track', icon: 'flag-outline', onPress: () => router.push('/plan/goals') },
          { label: 'My challenges', description: 'Challenges you set for yourself', icon: 'trophy-outline', onPress: () => router.push('/plan/challenges') },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  intro: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground },
});
