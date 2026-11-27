// Shared look-and-feel, extracted from the original App.js so new screens match it.
import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

export const COLORS = {
  ink: '#24332E', muted: '#5E6B65', green: '#386B55', pale: '#EAF0E8',
  cream: '#F7F5F0', white: '#FFFFFF', line: '#E4E7E1', coral: '#C86F53',
  warnBg: '#FBEDE6', warnInk: '#8A3F27', infoBg: '#EAF0E8',
};

export function Button({ title, onPress, secondary = false, small = false, disabled = false, accessibilityLabel, accessibilityHint }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [ui.button, secondary && ui.buttonSecondary, small && ui.buttonSmall, disabled && ui.buttonDisabled, pressed && !disabled && ui.pressed]}
    >
      <Text style={[ui.buttonText, secondary && ui.buttonTextSecondary, small && ui.buttonTextSmall, disabled && ui.buttonTextDisabled]}>{title}</Text>
    </Pressable>
  );
}

export function Header({ onBack, label = 'ROOM PLANNER' }) {
  return (
    <View style={ui.header}>
      {onBack
        ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={ui.back} hitSlop={8}><Text style={ui.backText}>‹</Text></Pressable>
        : <View style={ui.brandMark}><Text style={ui.brandMarkText}>R</Text></View>}
      <Text style={ui.brand}>roomready</Text>
      <View style={ui.headerSpacer} />
      <Text style={ui.stepPill}>{label}</Text>
    </View>
  );
}

export function Screen({ children }) {
  return (
    <SafeAreaView style={ui.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={ui.pageContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Notice({ children, tone = 'info', title }) {
  return (
    <View style={[ui.notice, tone === 'warn' && ui.noticeWarn]}>
      {title ? <Text style={[ui.noticeTitle, tone === 'warn' && ui.noticeTextWarn]}>{title}</Text> : null}
      <Text style={[ui.noticeText, tone === 'warn' && ui.noticeTextWarn]}>{children}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  pageContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandMarkText: { color: 'white', fontSize: 17, fontWeight: '800' },
  brand: { color: COLORS.ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.5 },
  headerSpacer: { flex: 1 },
  stepPill: { color: COLORS.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700', backgroundColor: '#EBEAE4', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, overflow: 'hidden' },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 36, color: COLORS.green, lineHeight: 38 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: COLORS.green, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  buttonSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
  buttonTextSecondary: { color: COLORS.ink },
  buttonSmall: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11 },
  buttonTextSmall: { fontSize: 14 },
  buttonDisabled: { backgroundColor: '#C9CFC9', borderColor: '#C9CFC9' },
  buttonTextDisabled: { color: '#4F5A55' },
  pressed: { opacity: 0.78 },
  eyebrow: { color: COLORS.green, fontSize: 11, letterSpacing: 1.25, fontWeight: '800', marginBottom: 8 },
  title: { color: COLORS.ink, fontSize: 30, lineHeight: 35, letterSpacing: -0.8, fontWeight: '600' },
  body: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 20 },
  label: { color: COLORS.ink, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  hint: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: COLORS.ink },
  inputError: { borderColor: COLORS.coral },
  errorText: { color: COLORS.warnInk, fontSize: 13, marginTop: 5 },
  field: { marginBottom: 16 },
  stack: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { borderRadius: 17, backgroundColor: COLORS.white, padding: 14, borderWidth: 1, borderColor: COLORS.line, marginBottom: 14 },
  sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700' },
  notice: { backgroundColor: COLORS.infoBg, padding: 13, borderRadius: 13, marginVertical: 10 },
  noticeWarn: { backgroundColor: COLORS.warnBg },
  noticeTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noticeText: { color: COLORS.ink, fontSize: 13, lineHeight: 19 },
  noticeTextWarn: { color: COLORS.warnInk },
});
