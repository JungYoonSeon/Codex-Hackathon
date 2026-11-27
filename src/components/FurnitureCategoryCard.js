import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { COLORS } from '../theme/colors';

export default function FurnitureCategoryCard({ category, onPress }) {
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={category.image ? `Browse ${category.title}` : `Add a photo for ${category.title}`} onPress={onPress} style={({ pressed }) => [styles.visual, !category.image && [styles.placeholder, { backgroundColor: category.background }], pressed && styles.pressed]}>
        {category.image ? <Image source={category.image} resizeMode="cover" style={styles.image} /> : <View style={styles.addPhoto}><AppText style={styles.plus}>＋</AppText><AppText style={styles.hint}>Add photo</AppText></View>}
      </Pressable>
      <AppText style={styles.title}>{category.title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', flexGrow: 0, flexBasis: '48%' },
  visual: { height: 105, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E6E8E4' },
  image: { width: '100%', height: '100%' },
  placeholder: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#D6DBE3' },
  addPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  plus: { color: COLORS.muted, fontSize: 21, lineHeight: 26 }, hint: { color: COLORS.muted, fontSize: 9 },
  title: { marginTop: 6, marginLeft: 2, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});
