/**
 * AuthBackground
 *
 * Shared backdrop for all 3 auth screens.
 * Figma "darker-blue-sky" gradient: #1586cc → #b4dbf2 (2-stop, stays blue)
 * vs. the app's clearSky gradient (#78c3f1 → #b4dbf2 → #f5f4f4) used in main tabs.
 *
 * Cloud proportions derived from Figma node 341:157 "parallax cloud anim":
 *   left: -292, top: 153, width: 716, height: 265  (design ref: 393 × 852)
 */

import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Figma design reference dimensions
const D_W = 393;
const D_H = 852;

// Cloud element specs from Figma (in design px)
const D_CLOUD_LEFT   = -292;
const D_CLOUD_TOP    =  153;
const D_CLOUD_WIDTH  =  716;
const D_CLOUD_HEIGHT =  265;

// Auth screens use a darker solid-blue gradient (no white fade)
const GRADIENT: readonly [string, string] = ['#1586cc', '#b4dbf2'];

interface Props {
  children: React.ReactNode;
}

export default function AuthBackground({ children }: Props) {
  const { width: W, height: H } = useWindowDimensions();

  // Scale factor: maps design pixels → real device pixels
  const sx = W / D_W;
  const sy = H / D_H;

  const cloudLeft   = D_CLOUD_LEFT   * sx;
  const cloudTop    = D_CLOUD_TOP    * sy;
  const cloudWidth  = D_CLOUD_WIDTH  * sx;
  const cloudHeight = D_CLOUD_HEIGHT * sy;

  // The cloud travels from its starting position all the way past the right edge
  const cloudTravel = W + Math.abs(cloudLeft);

  const cloudX = useSharedValue(0);

  useEffect(() => {
    cloudX.value = withRepeat(
      withTiming(cloudTravel, { duration: 60_000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [cloudTravel]);

  const cloudAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudX.value }],
  }));

  return (
    <LinearGradient colors={GRADIENT} style={styles.gradient}>
      <View style={styles.container}>
        {/* Cloud — blendMode:'screen' removes the black bg from cloud.png at runtime */}
        <Animated.Image
          source={require('@/assets/images/cloud.png')}
          style={[
            {
              position: 'absolute',
              left: cloudLeft,
              top: cloudTop,
              width: cloudWidth,
              height: cloudHeight,
              zIndex: 0,
              // @ts-ignore — blendMode is valid in RN but missing from TS types
              blendMode: 'screen',
            },
            cloudAnimStyle,
          ]}
          resizeMode="cover"
          pointerEvents="none"
        />
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, overflow: 'hidden' },
});
