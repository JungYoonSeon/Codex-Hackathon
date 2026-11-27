import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import AppText from '../components/AppText';
import BrandLogo from '../components/BrandLogo';
import BottomNavigation from '../components/BottomNavigation';
import { COLORS } from '../theme/colors';

const CONTENT = {
  explore: { title: 'Explore furniture', copy: 'Browse room ideas and furniture categories. More ways to explore are coming soon.' },
  drafts: { title: 'Your design drafts', copy: 'Rooms you start will appear here. Draft saving is coming soon.' },
};

export default function PlaceholderScreen({ section, onNavigate }) {
  const content = CONTENT[section] || CONTENT.explore;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.body}>
        <View style={styles.brand}><BrandLogo /></View>
        <AppText style={styles.title}>{content.title}</AppText>
        <AppText style={styles.copy}>{content.copy}</AppText>
      </View>
      <BottomNavigation activeTab={section} onSelect={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white }, body: { flex: 1, padding: 20 },
  brand: { height: 54, justifyContent: 'center', marginBottom: 25 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '700' },
  copy: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 300 },
});
