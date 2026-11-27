import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { COLORS } from '../theme/colors';

const TABS = [
  { id: 'home', label: 'Home', icon: require('../../assets/icons/home-white.png') },
  { id: 'explore', label: 'Explore', icon: require('../../assets/icons/explore-navy.png') },
  { id: 'create', label: 'Create', icon: require('../../assets/icons/create-navy.png') },
  { id: 'drafts', label: 'Drafts', icon: require('../../assets/icons/drafts-navy.png') },
];

export default function BottomNavigation({ activeTab, onSelect }) {
  const [hoveredTab, setHoveredTab] = useState(null);
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const hovered = hoveredTab === tab.id;
        return (
          <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label} onPress={() => onSelect(tab.id)} onHoverIn={() => setHoveredTab(tab.id)} onHoverOut={() => setHoveredTab(null)} style={({ pressed }) => [styles.tab, active && styles.active, hovered && !active && styles.hovered, pressed && styles.pressed]}>
            <Image source={tab.icon} resizeMode="contain" style={[styles.icon, { tintColor: active ? COLORS.white : hovered ? COLORS.navyPressed : COLORS.navy }]} />
            <AppText style={[styles.label, active && styles.activeLabel]}>{tab.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68, marginHorizontal: 11, marginBottom: 5, padding: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.nav, flexDirection: 'row', alignItems: 'stretch', shadowColor: '#172B59', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  tab: { flex: 1, marginHorizontal: 2, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 1 },
  active: { backgroundColor: COLORS.navy },
  icon: { width: 27, height: 27 },
  hovered: { backgroundColor: '#EEF1F9' },
  label: { color: COLORS.navy, fontSize: 9, lineHeight: 12 },
  activeLabel: { color: COLORS.white },
  pressed: { opacity: 0.68, transform: [{ scale: 0.97 }] },
});
