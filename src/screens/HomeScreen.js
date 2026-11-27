import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import AppText from '../components/AppText';
import BrandLogo from '../components/BrandLogo';
import BottomNavigation from '../components/BottomNavigation';
import RoomCard from '../components/RoomCard';
import { COLORS } from '../theme/colors';

export default function HomeScreen({ rooms = [], onOpenPlanner, onEditRoom, onDeleteRoom, recommendations, onNavigate }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}><BrandLogo /></View>
        <View style={styles.sectionHeader}>
          <AppText style={styles.heading}>Continue Designing</AppText>
          <Pressable accessibilityRole="button" onPress={() => onNavigate('drafts')} hitSlop={8}>
            {({ pressed }) => <AppText style={[styles.viewAll, pressed && styles.pressedText]}>View all →</AppText>}
          </Pressable>
        </View>
        <View style={styles.roomList}>
          {rooms.map(room => <View key={room.id}><RoomCard title={room.name} photo={room.photo} onPress={() => onOpenPlanner(room.id)} /><View style={{flexDirection:'row',gap:24,padding:10}}><Pressable accessibilityRole="button" onPress={() => onEditRoom(room.id)}><AppText>Rename / edit</AppText></Pressable><Pressable accessibilityRole="button" onPress={() => onDeleteRoom(room.id)}><AppText>Delete room</AppText></Pressable></View></View>)}
          <Pressable accessibilityRole="button" onPress={() => onNavigate('create')} style={{padding:18}}><AppText>＋ Create another room</AppText></Pressable>
        </View>
        {recommendations}
      </ScrollView>
      <BottomNavigation activeTab="home" onSelect={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white }, scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 5, paddingBottom: 12 },
  brandRow: { height: 48, justifyContent: 'center', marginBottom: 4 },
  sectionHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  heading: { color: COLORS.navy, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  viewAll: { color: COLORS.navy, fontSize: 9, lineHeight: 14 }, pressedText: { color: COLORS.navyPressed, opacity: 0.65 },
  roomList: { gap: 6 }, furnitureHeader: { marginTop: 7, marginBottom: 9 },
  subtitle: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
});
