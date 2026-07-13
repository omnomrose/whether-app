/**
 * AuthBackground
 *
 * Shared backdrop for all auth screens.
 * Figma "darker-blue-sky" gradient: #1586cc → #b4dbf2
 *
 * Cloud proportions from Figma node 341:157 "parallax cloud anim":
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

const D_W = 393;
const D_H = 852;

const D_CLOUD_LEFT   = -292;
const D_CLOUD_TOP    =  153;
const D_CLOUD_WIDTH  =  716;
const D_CLOUD_HEIGHT =  265;

const GRADIENT: readonly [string, string] = ['#1586cc', '#b4dbf2'];

interface Props { children: React.ReactNode }

export default function AuthBackground({ children }: Props) {
  const { width: W, height: H } = useWindowDimensions();

  const sx = W / D_W;
  const sy = H / D_H;

  const cloudLeft   = D_CLOUD_LEFT   * sx;
  const cloudTop    = D_CLOUD_TOP    * sy;
  const cloudWidth  = D_CLOUD_WIDTH  * sx;
  const cloudHeight = D_CLOUD_HEIGHT * sy;

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
        {/* @ts-ignore blendMode is valid in RN */}
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
  gradient:  { flex: 1 },
  container: { flex: 1, overflow: 'hidden' },
});
