import React from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { photoImageSource } from '../features/preview/sampleScenario';
import AppText from './AppText';
import { COLORS } from '../theme/colors';

const ROOM_IMAGE = require('../../assets/photos/room-sample.jpg');

export default function RoomCard({ title, photo, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Continue designing ${title}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ImageBackground source={photo ? photoImageSource(photo) : ROOM_IMAGE} resizeMode="cover" style={styles.photo} imageStyle={styles.rounded}>
        <View style={styles.overlay} />
        <View style={styles.caption}><AppText style={styles.title}>{title}</AppText><AppText style={styles.action}>Continue →</AppText></View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 112, borderRadius: 20, overflow: 'hidden', backgroundColor: '#A6A4A2' },
  photo: { flex: 1, justifyContent: 'flex-end' }, rounded: { borderRadius: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,13,26,0.42)' },
  caption: { paddingHorizontal: 12, paddingBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.white, fontSize: 11, fontWeight: '600' }, action: { color: COLORS.white, fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
