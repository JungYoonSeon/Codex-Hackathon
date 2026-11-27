import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, COLORS, Header } from './src/ui.js';
import { usePreviewController } from './src/features/preview/usePreviewController.js';
import { createLiveService, normalizeApiOrigin } from './src/features/preview/liveService.js';
import { SAMPLE_FURNITURE_REQUEST, SAMPLE_PHOTO, SAMPLE_ROOM, savedExampleService } from './src/features/preview/sampleScenario.js';
import { DimensionsScreen } from './src/features/flow/DimensionsScreen.js';
import { PhotoScreen } from './src/features/flow/PhotoScreen.js';
import { SampleConfirmScreen } from './src/features/flow/SampleConfirmScreen.js';
import { RequestScreen } from './src/features/flow/RequestScreen.js';
import { ResultsScreen } from './src/features/flow/ResultsScreen.js';

// Backend origin for live previews (inlined by Expo at bundle time). Never put provider keys here.
const API_ORIGIN = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);

const sameRoom = (a, b) => !!a && !!b && a.widthCm === b.widthCm && a.lengthCm === b.lengthCm && a.heightCm === b.heightCm;
const sameRequest = (a, b) => !!a && !!b && a.category === b.category && a.description === b.description;

// Products for the earlier 2D planner prototype (outside the current preview flow).
const PRODUCTS = [
  { id: 'chair', name: 'Everyday chair', size: '50 × 50 cm', emoji: '🪑', color: '#E8D1B5', w: 18, h: 18 },
  { id: 'table', name: 'Small table', size: '120 × 80 cm', emoji: '🟤', color: '#D7B78F', w: 26, h: 21 },
  { id: 'shelf', name: 'Low shelf', size: '80 × 40 cm', emoji: '📚', color: '#C9D7CB', w: 23, h: 15 },
];

export default function App() {
  const [screen, setScreen] = useState('home');
  // Shared inputs for the preview flow: dimensions → photo → request → results.
  const [room, setRoom] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [request, setRequest] = useState(null);
  const [sampleReturn, setSampleReturn] = useState('home');
  const [token, setToken] = useState('');
  const [health, setHealth] = useState({ status: 'idle' });
  const versionRef = useRef(0); // inputVersion: bumped on every input change
  const tokenRef = useRef('');
  const { state: preview, controller } = usePreviewController();
  const liveService = useMemo(() => createLiveService({ apiOrigin: API_ORIGIN, getToken: () => tokenRef.current }), []);
  // Earlier 2D planner prototype state.
  const [placements, setPlacements] = useState([]);
  const [selected, setSelected] = useState(null);

  const inputsChanged = () => { versionRef.current += 1; controller.invalidate(); };
  const changeRoom = (next) => { if (!sameRoom(room, next)) { inputsChanged(); setRoom(next); } };
  const changePhoto = (next) => { if (photo?.photoId !== next?.photoId) { inputsChanged(); setPhoto(next); } };
  const changeToken = (next) => { tokenRef.current = next; setToken(next); };

  const runPreview = (inputs) => {
    // Sample photo → saved illustrated examples; user photo → live backend. Never a silent fallback.
    const service = inputs.photo?.source === 'sample' ? savedExampleService : liveService;
    controller.start({ ...inputs, inputVersion: versionRef.current }, { service, mode: service.mode });
  };
  const submitRequest = (next) => {
    if (!sameRequest(request, next)) { inputsChanged(); setRequest(next); }
    if (!room) { setScreen('dimensions'); return; }
    if (!photo) { setScreen('photo'); return; }
    setScreen('results');
    runPreview({ room, photo, request: next });
  };
  const askForSample = (returnTo) => { setSampleReturn(returnTo); setScreen('sampleConfirm'); };
  const applySample = () => {
    inputsChanged();
    setRoom({ ...SAMPLE_ROOM });
    setPhoto(SAMPLE_PHOTO);
    setRequest({ ...SAMPLE_FURNITURE_REQUEST });
    setScreen('request');
  };
  const leaveResults = (to) => { controller.invalidate(); setScreen(to); };
  const startAgain = () => {
    inputsChanged();
    setRoom(null); setPhoto(null); setRequest(null);
    setScreen('dimensions');
  };
  const checkHealth = async () => {
    setHealth({ status: 'checking' });
    try {
      const result = await liveService.checkHealth();
      setHealth({ status: 'ok', ...result });
    } catch (error) {
      setHealth({ status: 'error', message: error.message });
    }
  };

  if (screen === 'dimensions') return (
    <DimensionsScreen room={room} onBack={() => setScreen('home')}
      onContinue={(next) => { changeRoom(next); setScreen('photo'); }} />
  );
  if (screen === 'photo') return (
    <PhotoScreen room={room} photo={photo} onBack={() => setScreen('dimensions')} onPhotoChange={changePhoto}
      onUseSample={() => askForSample('photo')} onContinue={() => setScreen('request')} />
  );
  if (screen === 'sampleConfirm') return (
    <SampleConfirmScreen hasExistingInputs={!!(room || photo || request)} onCancel={() => setScreen(sampleReturn)} onConfirm={applySample} />
  );
  if (screen === 'request') return (
    <RequestScreen key={`request-${versionRef.current}`} room={room} photo={photo} request={request}
      live={{ origin: API_ORIGIN, token, onTokenChange: changeToken, health, onCheckHealth: checkHealth }}
      onBack={() => setScreen('photo')} onSubmit={submitRequest} onRestoreSample={applySample} />
  );
  if (screen === 'results') return (
    <ResultsScreen state={preview}
      onRetry={(optionId) => controller.retry(optionId)}
      onRunAgain={() => runPreview({ room, photo, request })}
      onEditRequest={() => leaveResults('request')}
      onStartAgain={() => { controller.invalidate(); startAgain(); }}
      onUseSample={() => { controller.invalidate(); askForSample('request'); }}
      onRestoreSample={() => { controller.invalidate(); applySample(); }} />
  );

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
  if (screen === 'home') return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Header />
        <View style={styles.heroTag}><View style={styles.tagDot} /><Text style={styles.tagText}>A LITTLE MORE ROOM TO IMAGINE</Text></View>
        <Text style={styles.heroTitle}>Make space for{ '\n' }what matters.</Text>
        <Text style={styles.heroBody}>See furniture options in your room before you buy. Or start with a sample room—no account or personal photo needed.</Text>
        <View style={styles.heroArt}>
          <View style={styles.sun} />
          <View style={styles.window}><View style={styles.windowPane} /><View style={styles.windowPane} /></View>
          <View style={styles.plant}><Text style={{ fontSize: 42 }}>🪴</Text></View>
          <View style={styles.rug}><View style={styles.sofa}><View style={styles.sofaCushion} /><View style={styles.sofaCushion} /></View><View style={styles.lamp}><Text style={{ fontSize: 28 }}>◉</Text></View></View>
          <View style={styles.artCaption}><Text style={styles.artCaptionTitle}>A room to begin with</Text><Text style={styles.artCaptionSub}>Illustrative sample room</Text></View>
        </View>
        <Button title="Start with your room   →" onPress={() => setScreen('dimensions')} />
        <Pressable accessibilityRole="button" onPress={() => askForSample('home')} style={styles.textAction}><Text style={styles.textActionText}>Try the sample room (saved examples)</Text><Text style={styles.textArrow}>→</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setScreen('planner')} style={styles.textAction}><Text style={[styles.textActionText, { color: COLORS.muted }]}>Earlier 2D planner prototype</Text><Text style={[styles.textArrow, { color: COLORS.muted }]}>↗</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  const selectedItem = placements.find((item) => item.instanceId === selected);
  const selectedProduct = PRODUCTS.find((product) => product.id === (selectedItem?.id || ''));
  return (
    <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.pageContent}>
      <Header onBack={() => setScreen('home')} />
      <View style={styles.plannerTitleRow}><View><Text style={styles.eyebrow}>YOUR ROOM · SAMPLE</Text><Text style={styles.pageTitleSmall}>Room planner</Text></View><Pressable onPress={() => { setPlacements([]); setSelected(null); }} style={styles.reset}><Text style={styles.resetText}>Reset</Text></Pressable></View>
      <View style={styles.photoCard}>
        <View style={styles.samplePhoto}><View style={styles.samplePhotoWindow} /><View style={styles.samplePhotoRug}><View style={styles.samplePhotoSofa} /></View><Text style={styles.samplePhotoLabel}>SUNLIT LIVING ROOM</Text></View>
        <View style={styles.photoCardText}><Text style={styles.photoTitle}>A room to plan in</Text><Text style={styles.photoSub}>Earlier prototype · sample room only</Text></View>
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
      <View style={styles.connectCard}><View style={styles.connectIcon}><Text style={styles.connectIconText}>⌘</Text></View><View style={{ flex: 1 }}><Text style={styles.connectTitle}>Connect your furniture catalog</Text><Text style={styles.connectSub}>Catalog connection is a placeholder. Start with the demo pieces below.</Text></View><Text style={styles.comingSoon}>SOON</Text></View>
      {PRODUCTS.map((product) => <View key={product.id} style={styles.productRow}><View style={[styles.productThumb, { backgroundColor: product.color }]}><Text style={styles.productEmoji}>{product.emoji}</Text></View><View style={{ flex: 1 }}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{product.size} · illustrative</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name}`} onPress={() => addProduct(product)} style={styles.addButton}><Text style={styles.addButtonText}>＋ Add</Text></Pressable></View>)}
      <View style={styles.bottomNote}><Text style={styles.bottomNoteText}>Demo dimensions are illustrative. The sample plan checks drawn furniture overlaps only.</Text></View>
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
