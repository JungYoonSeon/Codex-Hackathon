import React from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import AppText from '../components/AppText';
import BrandLogo from '../components/BrandLogo';
import { PLANNER_PRODUCTS } from '../data/plannerProducts';
import { COLORS } from '../theme/colors';

export default function PlannerScreen({ roomTitle, photo, placements, selectedId, onBack, onChangePhoto, onRemovePhoto, onAdd, onSelect, onMove, onRemove, onReset }) {
  const selected = placements.find((item) => item.instanceId === selectedId);
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={styles.back}><AppText style={styles.backText}>‹</AppText></Pressable>
          <BrandLogo />
          <View style={styles.spacer} />
          <Pressable onPress={onReset} accessibilityRole="button" style={styles.reset}><AppText style={styles.resetText}>Reset</AppText></Pressable>
        </View>
        <AppText style={styles.eyebrow}>{roomTitle.toUpperCase()} · SAMPLE PLAN</AppText>
        <AppText style={styles.title}>Room planner</AppText>
        <View style={styles.photoCard}>
          <Image source={photo ? { uri: photo } : require('../../assets/photos/room-sample.jpg')} style={styles.photo} />
          <View style={styles.photoCopy}><AppText style={styles.photoTitle}>{photo ? 'Your room photo' : 'Sample room'}</AppText><AppText style={styles.photoNote}>Visual reference · not measured</AppText></View>
          {photo ? <Pressable onPress={onRemovePhoto}><AppText style={styles.remove}>Remove</AppText></Pressable> : null}
          <Pressable onPress={onChangePhoto}><AppText style={styles.change}>Change</AppText></Pressable>
        </View>
        <View style={styles.sectionHeading}><AppText style={styles.sectionTitle}>2D floor plan</AppText><AppText style={styles.scale}>Illustrative</AppText></View>
        <View style={styles.planFrame}><View style={styles.plan}>
          <View style={styles.doorway}><AppText style={styles.doorwayText}>DOORWAY</AppText></View>
          {placements.map((item) => <Pressable key={item.instanceId} onPress={() => onSelect(item.instanceId)} accessibilityRole="button" accessibilityLabel={`Select ${item.name} in plan`} style={[styles.placed, { left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%`, backgroundColor: item.color, borderColor: selectedId === item.instanceId ? COLORS.navy : '#AEB8AF' }]}><AppText style={styles.placedEmoji}>{item.emoji}</AppText><AppText style={styles.placedName}>{item.name.split(' ')[0]}</AppText></Pressable>)}
        </View></View>
        <AppText style={styles.caption}>Illustrative layout; not measured from the photo.</AppText>
        <View style={styles.sectionHeading}><AppText style={styles.sectionTitle}>Choose furniture</AppText><AppText style={styles.scale}>DEMO PIECES</AppText></View>
        <View style={styles.connection}><AppText style={styles.connectionMark}>＋</AppText><View style={styles.connectionCopy}><AppText style={styles.connectionTitle}>Furniture catalog</AppText><AppText style={styles.connectionNote}>Connecting a live catalog is a placeholder.</AppText></View><AppText style={styles.soon}>SOON</AppText></View>
        {PLANNER_PRODUCTS.map((product) => <View key={product.id} style={styles.productRow}><View style={[styles.productThumb, { backgroundColor: product.color }]}><AppText style={styles.productEmoji}>{product.emoji}</AppText></View><View style={styles.productCopy}><AppText style={styles.productName}>{product.name}</AppText><AppText style={styles.productSize}>{product.size} · demo dimensions</AppText></View><ActionButton title="＋ Add" compact secondary onPress={() => onAdd(product)} /></View>)}
        {placements.length > 0 ? <View style={styles.placedList}><AppText style={styles.sectionTitle}>In your plan</AppText>{placements.map((item, index) => <Pressable key={item.instanceId} onPress={() => onSelect(item.instanceId)} style={[styles.listItem, selectedId === item.instanceId && styles.listSelected]}><AppText style={styles.listEmoji}>{item.emoji}</AppText><View style={styles.productCopy}><AppText style={styles.productName}>{item.name}</AppText><AppText style={styles.productSize}>Item {index + 1} · {item.size}</AppText></View><AppText style={styles.listSelect}>{selectedId === item.instanceId ? 'SELECTED' : 'Select'}</AppText></Pressable>)}</View> : <View style={styles.empty}><AppText style={styles.emptyText}>Add a piece above to start arranging your room.</AppText></View>}
        {selected ? <View style={styles.controls}><AppText style={styles.controlsTitle}>Move {selected.name}</AppText><View style={styles.moveRow}><ActionButton title="← Left" compact secondary onPress={() => onMove(-8, 0)} /><ActionButton title="↑ Up" compact secondary onPress={() => onMove(0, -8)} /><ActionButton title="↓ Down" compact secondary onPress={() => onMove(0, 8)} /><ActionButton title="Right →" compact secondary onPress={() => onMove(8, 0)} /></View><ActionButton title="Remove from plan" compact secondary onPress={onRemove} /></View> : null}
        <AppText style={styles.footnote}>Demo dimensions are illustrative. The sample plan does not measure the room photo.</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white }, content: { paddingHorizontal: 18, paddingBottom: 32 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { width: 28, height: 36, justifyContent: 'center' }, backText: { fontSize: 32, lineHeight: 36 }, spacer: { flex: 1 },
  reset: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 }, resetText: { fontSize: 11, fontWeight: '600' },
  eyebrow: { color: COLORS.navy, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginTop: 7 }, title: { fontSize: 23, lineHeight: 30, fontWeight: '700', marginBottom: 12 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border }, photo: { width: 58, height: 52, borderRadius: 9 }, photoCopy: { flex: 1 },
  photoTitle: { fontSize: 11, fontWeight: '600' }, photoNote: { fontSize: 9, color: COLORS.muted, marginTop: 3 }, remove: { fontSize: 9, color: '#9E3D3D', fontWeight: '600' }, change: { fontSize: 9, color: COLORS.navy, fontWeight: '600' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 19, marginBottom: 8 }, sectionTitle: { fontSize: 15, fontWeight: '700' }, scale: { color: COLORS.muted, fontSize: 8, letterSpacing: 0.6 },
  planFrame: { padding: 8, borderRadius: 15, backgroundColor: '#EDF0F4' }, plan: { height: 220, borderWidth: 2, borderColor: '#7888AA', borderRadius: 11, position: 'relative', overflow: 'hidden', backgroundColor: '#FDFCF9' },
  doorway: { position: 'absolute', left: 0, top: '70%', width: '24%', height: '16%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8E7E2', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D5A397', borderStyle: 'dashed' }, doorwayText: { color: '#9C5D50', fontSize: 7, fontWeight: '700' },
  placed: { position: 'absolute', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 2 }, placedEmoji: { fontSize: 16 }, placedName: { fontSize: 7, fontWeight: '600' }, caption: { color: COLORS.muted, fontSize: 9, marginTop: 7 },
  connection: { minHeight: 56, borderRadius: 13, padding: 10, backgroundColor: '#F3F5FA', flexDirection: 'row', alignItems: 'center', gap: 9 }, connectionMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.white, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontSize: 18 }, connectionCopy: { flex: 1 }, connectionTitle: { fontSize: 10, fontWeight: '700' }, connectionNote: { color: COLORS.muted, fontSize: 8, marginTop: 2 }, soon: { fontSize: 7, letterSpacing: 0.5, color: COLORS.navy, fontWeight: '700' },
  productRow: { minHeight: 60, borderBottomWidth: 1, borderBottomColor: '#EEF0F4', flexDirection: 'row', alignItems: 'center', gap: 9 }, productThumb: { width: 39, height: 39, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, productEmoji: { fontSize: 20 }, productCopy: { flex: 1 }, productName: { fontSize: 10, fontWeight: '600' }, productSize: { color: COLORS.muted, fontSize: 8, marginTop: 3 },
  empty: { marginTop: 13, borderRadius: 11, backgroundColor: '#F5F6F8', padding: 12 }, emptyText: { color: COLORS.muted, fontSize: 10, lineHeight: 15 }, placedList: { marginTop: 19 }, listItem: { minHeight: 49, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }, listSelected: { backgroundColor: '#F4F6FC', borderColor: COLORS.navy }, listEmoji: { fontSize: 18 }, listSelect: { color: COLORS.navy, fontSize: 7, fontWeight: '700' },
  controls: { marginTop: 13, padding: 11, borderRadius: 12, backgroundColor: '#F3F5FA', gap: 8 }, controlsTitle: { fontSize: 11, fontWeight: '700' }, moveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, footnote: { color: COLORS.muted, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 15 },
});
