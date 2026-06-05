import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SkyBackground>
        {/* Skip */}
        <Pressable
          style={styles.skip}
          onPress={() => router.replace('/(tabs)')}
          hitSlop={12}
        >
          <Text style={styles.skipText}>skip</Text>
        </Pressable>

        {/* Tap anywhere to continue */}
        <Pressable style={styles.body} onPress={() => router.push('/(onboarding)/name')}>
          <Text style={styles.heading}>
            Let's get to know each other better!
          </Text>
        </Pressable>
      </SkyBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.gradient.clearSky.colors[0],
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 1,
  },
  skipText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 43,
    zIndex: 1,
  },
  heading: {
    ...Typography.titleLg,
    color: Colors.text.primary,
    textAlign: 'center',
  },
});
