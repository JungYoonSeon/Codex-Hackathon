import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import AppText from '../components/AppText';
import BrandLogo from '../components/BrandLogo';
import { COLORS } from '../theme/colors';

function Option({ title, note, symbol, onPress, highlighted = false }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, highlighted && styles.highlighted, pressed && styles.pressed]}>
      <View style={styles.symbolBox}><AppText style={styles.symbol}>{symbol}</AppText></View>
      <View style={styles.optionCopy}><AppText style={styles.optionTitle}>{title}</AppText><AppText style={styles.optionNote}>{note}</AppText></View>
      <AppText style={styles.arrow}>›</AppText>
    </Pressable>
  );
}

export default function ChooseRoomScreen({ onBack, onUseSample, onTakePhoto, onChoosePhoto }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={styles.back}><AppText style={styles.backText}>‹</AppText></Pressable><BrandLogo /></View>
        <AppText style={styles.eyebrow}>CREATE A ROOM PLAN</AppText>
        <AppText style={styles.title}>Where should we start?</AppText>
        <AppText style={styles.description}>Use a sample room or add your own photo as a visual reference.</AppText>
        <Option highlighted symbol="⌂" title="Try the sample room" note="Ready to explore · no photo needed" onPress={() => onUseSample('Sample Room')} />
        <AppText style={styles.or}>OR ADD YOUR OWN</AppText>
        <Option symbol="◎" title="Take a room photo" note="Camera access is only used when you choose this" onPress={onTakePhoto} />
        <Option symbol="▧" title="Choose from photos" note="Photo stays on this device and is not uploaded" onPress={onChoosePhoto} />
        <AppText style={styles.privacy}>The sample path does not require a personal photo. Photos are only used as visual references; they are not measured or uploaded.</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white }, content: { padding: 20, paddingBottom: 35 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30 },
  back: { width: 30, height: 38, justifyContent: 'center' }, backText: { fontSize: 32, lineHeight: 36 },
  eyebrow: { color: COLORS.navy, fontSize: 10, letterSpacing: 1, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '700' }, description: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: 8, marginBottom: 21 },
  option: { minHeight: 78, padding: 12, marginBottom: 9, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  highlighted: { backgroundColor: '#F3F5FB', borderColor: '#E2E7F3' }, symbolBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECF7' },
  symbol: { fontSize: 20, color: COLORS.navy }, optionCopy: { flex: 1 }, optionTitle: { fontSize: 13, fontWeight: '700' },
  optionNote: { fontSize: 10, lineHeight: 15, color: COLORS.muted, marginTop: 3 }, arrow: { fontSize: 24, lineHeight: 28, color: COLORS.navy },
  or: { textAlign: 'center', color: COLORS.muted, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginVertical: 17 },
  privacy: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 14, paddingHorizontal: 10 }, pressed: { opacity: 0.72 },
});
