import { Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Skip */}
      <Pressable
        style={styles.skip}
        onPress={() => router.replace('/(tabs)')}
        hitSlop={12}
      >
        <Text style={styles.skipText}>skip</Text>
      </Pressable>

      {/* Full-screen tap to proceed */}
      <Pressable style={styles.body} onPress={() => router.push('/(onboarding)/name')}>
        <Text style={styles.heading}>
          Let's get to know each other better!
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface[100],
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 43, // ~11% margin matching Figma
  },
  heading: {
    ...Typography.titleLg,
    color: Colors.text.primary,
    textAlign: 'center',
  },
});
