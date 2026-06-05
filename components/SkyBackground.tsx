/**
 * SkyBackground
 *
 * Shared sky-gradient + parallax-cloud backdrop used across onboarding screens.
 * Drop any screen content as children — they render on top of the sky.
 *
 * Gradient: Figma variable "linear-clear-sky"  (#78c3f1 → #b4dbf2 @ 70% → #f5f4f4)
 * Cloud:    Figma node 308:26530 "parallax cloud anim"
 *           1188 × 502 px, starts off-screen left (x = -635), sweeps right over 60 s.
 *           blendMode:"screen" knocks out the black background leaving only the white cloud.
 */

import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CLOUD_WIDTH = 1188;
const CLOUD_NATURAL_LEFT = -635;
const CLOUD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.59);
const CLOUD_BLEED = Math.round(CLOUD_HEIGHT * 0.30); // pushes black base off-screen
const CLOUD_TRAVEL = SCREEN_WIDTH + Math.abs(CLOUD_NATURAL_LEFT); // 1028 px sweep

interface Props {
  children: React.ReactNode;
  /** Where the cloud drifts. Defaults to 'bottom' (original behaviour). */
  cloudPosition?: 'top' | 'bottom';
}

export default function SkyBackground({ children, cloudPosition = 'bottom' }: Props) {
  const cloudX = useSharedValue(0);

  useEffect(() => {
    cloudX.value = withRepeat(
      withTiming(CLOUD_TRAVEL, {
        duration: 60_000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []);

  const cloudStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudX.value }],
  }));

  const cloudPositionStyle = cloudPosition === 'top'
    ? { top: -CLOUD_BLEED }
    : { bottom: -CLOUD_BLEED };

  return (
    <LinearGradient
      colors={Colors.gradient.clearSky.colors}
      locations={Colors.gradient.clearSky.locations}
      style={styles.gradient}
    >
      <View style={styles.container}>
        <Animated.Image
          source={require('@/assets/images/cloud.png')}
          style={[styles.cloud, cloudPositionStyle, cloudStyle]}
          resizeMode="cover"
          pointerEvents="none"
        />
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    left: CLOUD_NATURAL_LEFT,
    width: CLOUD_WIDTH,
    height: CLOUD_HEIGHT,
    zIndex: 0,
    blendMode: 'screen',
  },
});
