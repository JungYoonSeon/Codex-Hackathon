import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import AppText from './AppText';
import { COLORS } from '../theme/colors';

export default function ActionButton({ title, onPress, secondary = false, compact = false }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, compact && styles.compact, pressed && styles.pressed]}><AppText style={[styles.label, secondary && styles.secondaryLabel, compact && styles.compactLabel]}>{title}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: 13, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  compact: { minHeight: 38, paddingHorizontal: 11, borderRadius: 10 },
  label: { color: COLORS.white, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  secondaryLabel: { color: COLORS.navy }, compactLabel: { fontSize: 11, lineHeight: 15 }, pressed: { opacity: 0.72 },
});
