// Onboarding screen 2 — name entry
// Nametag sticker image with an editable TextInput overlaid on the white area.
//
// NOTE: Work Sans font — add @expo-google-fonts/work-sans and load in root _layout.tsx
// to match the design exactly. Uses system font until then.

import { useRef, useState } from 'react';
import {
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Keyboard,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

// Save the nametag image to assets/images/nametag.png
const NAMETAG_IMAGE = require('@/assets/images/nametag.png');

// Figma frame dimensions (base design at 393px wide)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 844;

// Nametag container dimensions & position in Figma frame
const NAMETAG = {
  left: 29,
  top: 295,
  width: 334,
  height: 223,
};

// Image overflows its container (Figma: w-[117.38%], h-[121%], top-[-10.23%], left-[-9.22%])
const IMG_OVERFLOW = {
  widthRatio: 1.1738,
  heightRatio: 1.21,
  leftRatio: -0.0922,
  topRatio: -0.1023,
};

// Name text sits at 50% into the sticker vertically (in the white area)
const NAME_INPUT_TOP_RATIO = 0.5;

export default function NameScreen() {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { width, height } = useWindowDimensions();

  const scale = width / BASE_WIDTH;

  const nametag = {
    left: NAMETAG.left * scale,
    top: NAMETAG.top * scale,
    width: NAMETAG.width * scale,
    height: NAMETAG.height * scale,
  };

  const imgW = nametag.width * IMG_OVERFLOW.widthRatio;
  const imgH = nametag.height * IMG_OVERFLOW.heightRatio;
  const imgLeft = nametag.width * IMG_OVERFLOW.leftRatio;
  const imgTop = nametag.height * IMG_OVERFLOW.topRatio;

  const inputTop = nametag.height * NAME_INPUT_TOP_RATIO;
  const fontSize = 24 * scale;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        {/* Skip */}
        <Pressable
          style={styles.skip}
          onPress={() => router.replace('/(tabs)')}
          hitSlop={12}
        >
          <Text style={styles.skipText}>skip</Text>
        </Pressable>

        {/* Nametag */}
        <Pressable
          style={[
            styles.nametag,
            { left: nametag.left, top: nametag.top, width: nametag.width, height: nametag.height },
          ]}
          onPress={() => inputRef.current?.focus()}
        >
          {/* Sticker image — slightly oversized + offset per Figma */}
          <View style={styles.imageClip}>
            <Image
              source={NAMETAG_IMAGE}
              style={{
                position: 'absolute',
                width: imgW,
                height: imgH,
                left: imgLeft,
                top: imgTop,
              }}
              resizeMode="stretch"
            />
          </View>

          {/* Editable name — overlaid on the white area of the sticker */}
          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="your name"
            placeholderTextColor="rgba(29, 29, 29, 0.35)"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            autoCorrect={false}
            autoCapitalize="characters"
            style={[
              styles.nameInput,
              {
                top: inputTop,
                fontSize,
                lineHeight: fontSize * 1.17,
                letterSpacing: -0.48 * scale,
              },
            ]}
          />
        </Pressable>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
  nametag: {
    position: 'absolute',
  },
  imageClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  nameInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '700',
    color: Colors.text.primary,
    textTransform: 'uppercase',
    backgroundColor: 'transparent',
    // Remove default TextInput border/underline
    borderWidth: 0,
    padding: 0,
  },
});
