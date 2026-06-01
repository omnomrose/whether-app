// Onboarding screen 2 — name entry
// Faithfully implements Figma node 152:164

import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

// Place the nametag image at assets/images/nametag.png
const NAMETAG_IMAGE = require('@/assets/images/nametag.png');

// ─── Figma spec (frame: 393 × 844) ──────────────────────────────────────────
// Nametag container: fixed 334 × 223, left: 29, top: 295
const NAMETAG_W = 334;
const NAMETAG_H = 223;
const NAMETAG_LEFT = 29;
const NAMETAG_TOP = 295;
const FRAME_H = 844;

// Name text: top-[406px] in Figma → 406 − 295 = 111px from top of nametag
// left-[calc(33.33%+33px)] in Figma frame → rendered centred via textAlign
const NAME_TOP = 406 - NAMETAG_TOP; // 111
// ─────────────────────────────────────────────────────────────────────────────

export default function NameScreen() {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { height } = useWindowDimensions();

  // Scale the vertical position proportionally to the device screen height
  // so the nametag sits in the same relative position as the Figma frame.
  const topScale = height / FRAME_H;
  const nametagTop = NAMETAG_TOP * topScale;

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

        {/* Nametag — fixed 334 × 223, cropped image, editable name overlay */}
        <Pressable
          style={[styles.nametag, { left: NAMETAG_LEFT, top: nametagTop }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Image
            source={NAMETAG_IMAGE}
            style={{ width: NAMETAG_W, height: NAMETAG_H }}
            resizeMode="contain"
          />

          {/* Editable name — sits in the white area of the sticker */}
          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="your name"
            placeholderTextColor="rgba(29,29,29,0.35)"
            returnKeyType="next"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (name.trim()) router.push('/(onboarding)/location');
            }}
            autoCorrect={false}
            autoCapitalize="characters"
            style={styles.nameInput}
          />
        </Pressable>
        {/* Continue — appears once a name is typed */}
        {name.trim().length > 0 && (
          <Pressable
            style={styles.continueBtn}
            onPress={() => {
              Keyboard.dismiss();
              router.push('/(onboarding)/location');
            }}
          >
            <Text style={styles.continueText}>continue</Text>
          </Pressable>
        )}
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
    width: NAMETAG_W,
    height: NAMETAG_H,
  },
  continueBtn: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: Colors.surface[200],
    borderRadius: 200,
  },
  continueText: {
    ...Typography.caption,
    color: Colors.surface[100],
  },
  nameInput: {
    position: 'absolute',
    top: NAME_TOP,        // 111px — in the white area of the sticker
    left: 0,
    right: 0,
    textAlign: 'center',
    // body-xl: Public Sans Medium 18/22, -0.36 tracking, uppercase
    ...Typography.bodyXl,
    textTransform: 'uppercase',
    color: Colors.text.primary,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
});
