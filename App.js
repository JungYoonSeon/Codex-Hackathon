import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import FurnitureDiscovery, { SavedFurniture } from './mobile/FurnitureDiscovery';

const COLORS = {
  ink: '#24332E', muted: '#68756F', green: '#386B55', pale: '#EAF0E8',
  cream: '#F7F5F0', white: '#FFFFFF', line: '#E4E7E1', coral: '#C86F53',
};

const PRODUCTS = [
  { id: 'chair', name: 'Everyday chair', size: '50 × 50 cm', emoji: '🪑', color: '#E8D1B5', w: 18, h: 18 },
  { id: 'table', name: 'Small table', size: '120 × 80 cm', emoji: '🟤', color: '#D7B78F', w: 26, h: 21 },
  { id: 'shelf', name: 'Low shelf', size: '80 × 40 cm', emoji: '📚', color: '#C9D7CB', w: 23, h: 15 },
];

function Button({ title, onPress, secondary = false, small = false }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, small && styles.buttonSmall, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, small && styles.buttonTextSmall]}>{title}</Text>
    </Pressable>
  );
}

function Header({ onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : <View style={styles.brandMark}><Text style={styles.brandMarkText}>R</Text></View>}
      <Text style={styles.brand}>roomready</Text>
      <View style={styles.headerSpacer} />
      <Text style={styles.stepPill}>ROOM PLANNER</Text>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [room, setRoom] = useState('sample');
  const [photo, setPhoto] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [savedProducts, setSavedProducts] = useState([]);
  const [discoveryReturn, setDiscoveryReturn] = useState('home');
  const [catalogConnection, setCatalogConnection] = useState({ origin: process.env.EXPO_PUBLIC_API_URL || '', token: '' });
  const exploreFurniture = () => { setDiscoveryReturn(screen === 'saved' ? 'saved' : screen); setScreen('discover'); };
  const saveProduct = (product) => setSavedProducts(items => items.some(p => p.id === product.id) ? items : [...items, product]);

  const choosePhoto = async (camera) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow ${camera ? 'camera' : 'photo library'} access to choose a room photo. You can keep using the sample room without it.`);
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhoto(result.assets[0].uri);
      setRoom('photo');
      setScreen('planner');
    }
  };

  const addProduct = (product) => {
    const item = { ...product, instanceId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x: 18 + (placements.length % 3) * 24, y: 20 + (placements.length % 2) * 28 };
    setPlacements((items) => [...items, item]);
    setSelected(item.instanceId);
  };
  const move = (dx, dy) => setPlacements((items) => items.map((item) => item.instanceId === selected ? { ...item, x: Math.max(0, Math.min(100 - item.w, item.x + dx)), y: Math.max(0, Math.min(100 - item.h, item.y + dy)) } : item));
  const removeSelected = () => {
    setPlacements((items) => items.filter((item) => item.instanceId !== selected));
    setSelected(null);
  };
  const startSample = () => { setRoom('sample'); setPhoto(null); setScreen('planner'); };

  if (screen === 'discover') return <FurnitureDiscovery onBack={() => setScreen(discoveryReturn)} onSave={saveProduct} savedIds={savedProducts.map(p => p.id)} connection={catalogConnection} onConnectionChange={setCatalogConnection} />;
  if (screen === 'saved') return <SavedFurniture products={savedProducts} onBack={() => setScreen('home')} onExplore={exploreFurniture} onRemove={id => setSavedProducts(items => items.filter(p => p.id !== id))} />;

  if (screen === 'home') return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Header />
        <View style={styles.heroTag}><View style={styles.tagDot} /><Text style={styles.tagText}>A LITTLE MORE ROOM TO IMAGINE</Text></View>
        <Text style={styles.heroTitle}>Make space for{ '\n' }what matters.</Text>
        <Text style={styles.heroBody}>Try furniture arrangements before you buy. Start with a sample room—no account or personal photo needed.</Text>
        <View style={styles.heroArt}>
          <View style={styles.sun} />
          <View style={styles.window}><View style={styles.windowPane} /><View style={styles.windowPane} /></View>
          <View style={styles.plant}><Text style={{ fontSize: 42 }}>🪴</Text></View>
          <View style={styles.rug}><View style={styles.sofa}><View style={styles.sofaCushion} /><View style={styles.sofaCushion} /></View><View style={styles.lamp}><Text style={{ fontSize: 28 }}>◉</Text></View></View>
          <View style={styles.artCaption}><Text style={styles.artCaptionTitle}>A room to begin with</Text><Text style={styles.artCaptionSub}>Illustrative sample room</Text></View>
        </View>
        <Button title="가구 검색 · 브랜드별로 둘러보기   →" onPress={exploreFurniture} />
        <Pressable onPress={() => setScreen('saved')} style={styles.textAction}><Text style={styles.textActionText}>내 방 후보 보기 ({savedProducts.length})</Text></Pressable>
        <Button title="Try a sample room   →" secondary onPress={startSample} />
        <Pressable onPress={() => setScreen('choose')} style={styles.textAction}><Text style={styles.textActionText}>Choose a room or take a photo</Text><Text style={styles.textArrow}>↗</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  if (screen === 'choose') return (
    <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.pageContent}>
      <Header onBack={() => setScreen('home')} />
      <Text style={styles.eyebrow}>STEP 01 · YOUR SPACE</Text><Text style={styles.pageTitle}>Where should we{ '\n' }start?</Text>
      <Text style={styles.body}>A photo is just a visual reference. It won’t be measured or uploaded.</Text>
      <Pressable onPress={startSample} style={({ pressed }) => [styles.roomOption, pressed && styles.pressed]}>
        <View style={styles.sampleThumb}><View style={styles.thumbRug}><View style={styles.thumbSofa} /></View></View>
        <View style={styles.roomOptionCopy}><Text style={styles.roomOptionTitle}>Try the sample room</Text><Text style={styles.roomOptionSub}>Ready to explore · no photo needed</Text></View><Text style={styles.roomOptionArrow}>→</Text>
      </Pressable>
      <View style={styles.orRow}><View style={styles.rule} /><Text style={styles.orText}>OR ADD YOUR OWN</Text><View style={styles.rule} /></View>
      <Pressable onPress={() => choosePhoto(true)} style={styles.photoChoice}><Text style={styles.choiceIcon}>⌕</Text><View style={styles.roomOptionCopy}><Text style={styles.roomOptionTitle}>Take a room photo</Text><Text style={styles.roomOptionSub}>Camera access is only used when you choose this</Text></View><Text style={styles.roomOptionArrow}>＋</Text></Pressable>
      <Pressable onPress={() => choosePhoto(false)} style={styles.photoChoice}><Text style={styles.choiceIcon}>▧</Text><View style={styles.roomOptionCopy}><Text style={styles.roomOptionTitle}>Choose from photos</Text><Text style={styles.roomOptionSub}>Stays on your device; remove it any time</Text></View><Text style={styles.roomOptionArrow}>＋</Text></Pressable>
      <Text style={styles.privacyNote}>Your photo stays on this device. RoomReady doesn’t upload or save it.</Text>
    </ScrollView></SafeAreaView>
  );

  const selectedItem = placements.find((item) => item.instanceId === selected);
  const selectedProduct = PRODUCTS.find((product) => product.id === (selectedItem?.id || ''));
  return (
    <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.pageContent}>
      <Header onBack={() => setScreen('home')} />
      <View style={styles.plannerTitleRow}><View><Text style={styles.eyebrow}>YOUR ROOM · SAMPLE</Text><Text style={styles.pageTitleSmall}>Room planner</Text></View><Pressable onPress={() => { setPlacements([]); setSelected(null); }} style={styles.reset}><Text style={styles.resetText}>Reset</Text></Pressable></View>
      <View style={styles.photoCard}>
        {photo ? <Image source={{ uri: photo }} style={styles.photoImage} /> : <View style={styles.samplePhoto}><View style={styles.samplePhotoWindow} /><View style={styles.samplePhotoRug}><View style={styles.samplePhotoSofa} /></View><Text style={styles.samplePhotoLabel}>SUNLIT LIVING ROOM</Text></View>}
        <View style={styles.photoCardText}><Text style={styles.photoTitle}>{photo ? 'Your room photo' : 'A room to plan in'}</Text><Text style={styles.photoSub}>{photo ? 'Photo reference only · not measured' : 'Sample room · no photo needed'}</Text></View>
        {photo ? <Pressable accessibilityLabel="Remove room photo" onPress={() => { setPhoto(null); setRoom('sample'); }}><Text style={styles.removePhoto}>Remove</Text></Pressable> : null}
      </View>
      <View style={styles.planHeading}><Text style={styles.sectionTitle}>2D floor plan</Text><Text style={styles.scaleNote}>Illustrative · not to scale</Text></View>
      <View style={styles.planWrap}>
        <View style={styles.plan}>
          <View style={styles.doorZone}><Text style={styles.doorText}>DOORWAY</Text></View>
          {placements.map((item, index) => <Pressable key={item.instanceId} onPress={() => setSelected(item.instanceId)} style={[styles.placedBlock, { left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%`, backgroundColor: item.color, borderColor: selected === item.instanceId ? COLORS.green : 'rgba(36,51,46,0.2)' }]}><Text style={styles.placedEmoji}>{item.emoji}</Text><Text numberOfLines={1} style={styles.placedLabel}>{item.name.split(' ')[0]}</Text></Pressable>)}
          <View style={styles.planDoorGap} />
        </View>
      </View>
      <Text style={styles.caption}>Illustrative layout; not measured from the photo.</Text>
      {placements.length === 0 ? <View style={styles.emptyNotice}><Text style={styles.emptyIcon}>＋</Text><Text style={styles.emptyText}>Add a piece below to start arranging your room.</Text></View> : <View style={styles.placedList}><Text style={styles.sectionTitle}>In your plan</Text>{placements.map((item, i) => <Pressable key={item.instanceId} accessibilityRole="button" accessibilityLabel={`Select ${item.name}, item ${i + 1}`} onPress={() => setSelected(item.instanceId)} style={[styles.listItem, selected === item.instanceId && styles.listItemSelected]}><Text style={styles.listEmoji}>{item.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.listName}>{item.name}</Text><Text style={styles.listSize}>{item.size} · demo dimensions</Text></View><Text style={selected === item.instanceId ? styles.selectedLabel : styles.selectLabel}>{selected === item.instanceId ? 'SELECTED' : 'Select'}</Text></Pressable>)}</View>}
      {selectedItem ? <View style={styles.controls}><Text style={styles.sectionTitle}>Move {selectedItem.name}</Text><View style={styles.moveRow}><Button title="← Left" small secondary onPress={() => move(-8, 0)} /><Button title="↑ Up" small secondary onPress={() => move(0, -8)} /><Button title="↓ Down" small secondary onPress={() => move(0, 8)} /><Button title="Right →" small secondary onPress={() => move(8, 0)} /></View><Button title="Remove from plan" small secondary onPress={removeSelected} /></View> : null}
      <View style={styles.catalogHeader}><View><Text style={styles.eyebrow}>THE STARTER SET</Text><Text style={styles.sectionTitle}>Choose furniture</Text></View><Text style={styles.catalogCount}>3 DEMO PIECES</Text></View>
      <Pressable onPress={exploreFurniture} style={styles.connectCard}><View style={styles.connectIcon}><Text style={styles.connectIconText}>⌕</Text></View><View style={{ flex: 1 }}><Text style={styles.connectTitle}>상품명·브랜드로 가구 찾기</Text><Text style={styles.connectSub}>IKEA · Amazon · eBay 검색과 종류별 탐색</Text></View><Text style={styles.comingSoon}>OPEN →</Text></Pressable>
      {PRODUCTS.map((product) => <View key={product.id} style={styles.productRow}><View style={[styles.productThumb, { backgroundColor: product.color }]}><Text style={styles.productEmoji}>{product.emoji}</Text></View><View style={{ flex: 1 }}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{product.size} · illustrative</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name}`} onPress={() => addProduct(product)} style={styles.addButton}><Text style={styles.addButtonText}>＋ Add</Text></Pressable></View>)}
      <View style={styles.bottomNote}><Text style={styles.bottomNoteText}>Demo dimensions are illustrative. The sample plan does not check physical fit or furniture overlaps.</Text></View>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream }, homeContent: { paddingHorizontal: 24, paddingBottom: 36 }, pageContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 28 }, brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 9 }, brandMarkText: { color: 'white', fontSize: 17, fontWeight: '800' }, brand: { color: COLORS.ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.5 }, headerSpacer: { flex: 1 }, stepPill: { color: COLORS.muted, fontSize: 9, letterSpacing: 1, fontWeight: '700', backgroundColor: '#EBEAE4', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 }, back: { width: 32, height: 36, justifyContent: 'center' }, backText: { fontSize: 36, color: COLORS.green, lineHeight: 38 },
  heroTag: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 }, tagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.coral, marginRight: 8 }, tagText: { color: COLORS.green, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }, heroTitle: { color: COLORS.ink, fontSize: 43, lineHeight: 47, letterSpacing: -1.6, fontWeight: '600' }, heroBody: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginTop: 15, maxWidth: 330 },
  heroArt: { height: 245, borderRadius: 22, marginVertical: 23, overflow: 'hidden', backgroundColor: '#E7E7DB' }, sun: { position: 'absolute', right: 32, top: 24, width: 66, height: 66, borderRadius: 35, backgroundColor: '#F1D8A8' }, window: { position: 'absolute', right: 33, top: 28, width: 93, height: 111, borderWidth: 7, borderColor: '#FAF8F1', flexDirection: 'row', gap: 4 }, windowPane: { flex: 1, backgroundColor: '#B9CDC1' }, plant: { position: 'absolute', bottom: 48, left: 19 }, rug: { position: 'absolute', bottom: -48, left: 62, right: 33, height: 155, borderRadius: 80, backgroundColor: '#CFB99D' }, sofa: { position: 'absolute', left: 44, top: 13, width: 145, height: 70, borderRadius: 16, backgroundColor: '#768A78', flexDirection: 'row', padding: 8, gap: 6, elevation: 3 }, sofaCushion: { flex: 1, borderRadius: 9, backgroundColor: '#93A18F' }, lamp: { position: 'absolute', right: 15, top: 20 }, artCaption: { position: 'absolute', left: 16, top: 16 }, artCaptionTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '700' }, artCaptionSub: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: COLORS.green, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' }, buttonSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, buttonTextSecondary: { color: COLORS.ink }, buttonSmall: { minHeight: 40, paddingHorizontal: 13, borderRadius: 11 }, buttonTextSmall: { fontSize: 12 }, pressed: { opacity: 0.78 }, textAction: { paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, textActionText: { color: COLORS.green, fontSize: 14, fontWeight: '700' }, textArrow: { color: COLORS.green, fontSize: 16 },
  eyebrow: { color: COLORS.green, fontSize: 10, letterSpacing: 1.25, fontWeight: '800', marginBottom: 8 }, pageTitle: { color: COLORS.ink, fontSize: 34, lineHeight: 38, letterSpacing: -1, fontWeight: '600' }, pageTitleSmall: { color: COLORS.ink, fontSize: 26, letterSpacing: -0.6, fontWeight: '650' }, body: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 11, marginBottom: 24 },
  roomOption: { backgroundColor: COLORS.pale, borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 10 }, sampleThumb: { width: 62, height: 58, borderRadius: 12, backgroundColor: '#D5DFD1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }, thumbRug: { width: 48, height: 30, borderRadius: 20, backgroundColor: '#CDB79C', justifyContent: 'center', alignItems: 'center' }, thumbSofa: { width: 27, height: 16, borderRadius: 5, backgroundColor: '#7E927D' }, roomOptionCopy: { flex: 1 }, roomOptionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '700' }, roomOptionSub: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, roomOptionArrow: { color: COLORS.green, fontSize: 20, fontWeight: '600', paddingHorizontal: 4 }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }, rule: { flex: 1, height: 1, backgroundColor: COLORS.line }, orText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: COLORS.muted }, photoChoice: { backgroundColor: COLORS.white, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: COLORS.line, marginBottom: 10 }, choiceIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: COLORS.pale, color: COLORS.green, fontSize: 22, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' }, privacyNote: { textAlign: 'center', color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 15, paddingHorizontal: 15 },
  plannerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, reset: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, resetText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' }, photoCard: { borderRadius: 17, backgroundColor: COLORS.white, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, gap: 11 }, photoImage: { width: 62, height: 55, borderRadius: 11 }, samplePhoto: { width: 62, height: 55, borderRadius: 11, overflow: 'hidden', backgroundColor: '#DCE6DD' }, samplePhotoWindow: { position: 'absolute', top: 6, right: 6, width: 20, height: 22, backgroundColor: '#B4C8BB', borderWidth: 2, borderColor: 'white' }, samplePhotoRug: { position: 'absolute', left: 10, bottom: -11, width: 45, height: 30, borderRadius: 20, backgroundColor: '#C8AE90', alignItems: 'center' }, samplePhotoSofa: { width: 28, height: 13, backgroundColor: '#718874', borderRadius: 5, marginTop: 3 }, samplePhotoLabel: { position: 'absolute', bottom: 3, left: 3, color: 'white', fontSize: 4, letterSpacing: 0.5, fontWeight: '800' }, photoCardText: { flex: 1 }, photoTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '700' }, photoSub: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, removePhoto: { color: COLORS.coral, fontSize: 11, fontWeight: '700', padding: 5 },
  planHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 }, sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700' }, scaleNote: { color: COLORS.muted, fontSize: 10 }, planWrap: { padding: 9, backgroundColor: '#E4E8E0', borderRadius: 18 }, plan: { height: 250, backgroundColor: '#FDFCF8', borderRadius: 12, borderWidth: 2, borderColor: '#687B6F', position: 'relative', overflow: 'hidden' }, doorZone: { position: 'absolute', top: '68%', left: 0, width: '25%', height: '16%', backgroundColor: '#F6E1D8', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#C8866E', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }, doorText: { color: '#A65F49', fontSize: 7, fontWeight: '800', letterSpacing: 0.8 }, planDoorGap: { position: 'absolute', bottom: -3, left: '9%', width: '16%', height: 7, backgroundColor: '#FDFCF8' }, placedBlock: { position: 'absolute', borderRadius: 8, borderWidth: 2, justifyContent: 'center', alignItems: 'center', padding: 2 }, placedEmoji: { fontSize: 17 }, placedLabel: { fontSize: 7, color: COLORS.ink, fontWeight: '700' }, caption: { color: COLORS.muted, fontSize: 10, marginTop: 8 },
  emptyNotice: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#F0EEE8', padding: 13, borderRadius: 13, marginTop: 18 }, emptyIcon: { color: COLORS.green, fontSize: 20, fontWeight: '600' }, emptyText: { color: COLORS.muted, fontSize: 12, flex: 1, lineHeight: 18 }, placedList: { marginTop: 20 }, listItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, marginTop: 8, gap: 10 }, listItemSelected: { borderColor: COLORS.green, backgroundColor: '#F1F6F0' }, listEmoji: { fontSize: 23 }, listName: { fontSize: 12, fontWeight: '700', color: COLORS.ink }, listSize: { color: COLORS.muted, fontSize: 10, marginTop: 3 }, selectedLabel: { color: COLORS.green, fontSize: 8, letterSpacing: 0.6, fontWeight: '800' }, selectLabel: { color: COLORS.muted, fontSize: 10 }, controls: { marginTop: 16, padding: 13, backgroundColor: COLORS.pale, borderRadius: 15, gap: 10 }, moveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catalogHeader: { marginTop: 25, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, catalogCount: { color: COLORS.muted, fontSize: 8, letterSpacing: 0.8, fontWeight: '800', marginBottom: 2 }, connectCard: { padding: 12, borderRadius: 15, backgroundColor: '#EAE9E2', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, connectIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }, connectIconText: { color: COLORS.green, fontSize: 19 }, connectTitle: { color: COLORS.ink, fontSize: 11, fontWeight: '700' }, connectSub: { color: COLORS.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, comingSoon: { color: COLORS.green, fontSize: 7, letterSpacing: 0.5, fontWeight: '800' }, productRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.line }, productThumb: { width: 45, height: 45, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, productEmoji: { fontSize: 23 }, productName: { color: COLORS.ink, fontSize: 12, fontWeight: '700' }, productMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, addButton: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: COLORS.white }, addButtonText: { color: COLORS.green, fontSize: 11, fontWeight: '700' }, bottomNote: { backgroundColor: '#F0EEE8', padding: 12, borderRadius: 12, marginTop: 17 }, bottomNoteText: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
});
