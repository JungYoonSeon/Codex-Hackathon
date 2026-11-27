import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFonts } from 'expo-font';
import * as ImagePicker from 'expo-image-picker';
import ChooseRoomScreen from './src/screens/ChooseRoomScreen';
import HomeScreen from './src/screens/HomeScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import SplashScreen from './src/screens/SplashScreen';
import FurnitureDiscovery, { SavedFurniture } from './mobile/FurnitureDiscovery';
import { usePreviewController } from './src/features/preview/usePreviewController.js';
import { createLiveService, normalizeApiOrigin } from './src/features/preview/liveService.js';
import { SAMPLE_FURNITURE_REQUEST, SAMPLE_PHOTO, SAMPLE_ROOM, savedExampleService } from './src/features/preview/sampleScenario.js';
import { DimensionsScreen } from './src/features/flow/DimensionsScreen.js';
import { PhotoScreen } from './src/features/flow/PhotoScreen.js';
import { SampleConfirmScreen } from './src/features/flow/SampleConfirmScreen.js';
import { RequestScreen } from './src/features/flow/RequestScreen.js';
import { ResultsScreen } from './src/features/flow/ResultsScreen.js';

const API_ORIGIN = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);
const sameRoom = (a, b) => !!a && !!b && a.widthCm === b.widthCm && a.lengthCm === b.lengthCm && a.heightCm === b.heightCm;
const sameRequest = (a, b) => !!a && !!b && a.category === b.category && a.description === b.description;

export default function App() {
  const [fontsLoaded] = useFonts({ Geologica: require('./assets/fonts/Geologica-Variable.ttf') });
  const [screen, setScreen] = useState('splash');
  const [roomTitle, setRoomTitle] = useState('Sample Room');
  const [plannerPhoto, setPlannerPhoto] = useState(null);

  // Preview-flow state: dimensions → photo → request → results.
  const [room, setRoom] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [request, setRequest] = useState(null);
  const [sampleReturn, setSampleReturn] = useState('home');
  const [token, setToken] = useState('');
  const [apiOrigin, setApiOrigin] = useState(API_ORIGIN);
  const healthCheckRef = useRef(0);
  const [health, setHealth] = useState({ status: 'idle' });
  const versionRef = useRef(0);
  const tokenRef = useRef('');
  const { state: preview, controller } = usePreviewController();
  const liveService = useMemo(() => createLiveService({ apiOrigin, getToken: () => tokenRef.current }), [apiOrigin]);

  // Kept for the earlier 2D planner screen while the photo-preview flow is built out.
  const [placements, setPlacements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [savedProducts, setSavedProducts] = useState([]);
  const [discoveryReturn, setDiscoveryReturn] = useState('home');
  const exploreFurniture = () => { setDiscoveryReturn(screen); setScreen('discover'); };
  const saveProduct = (product) => setSavedProducts((items) => items.some((item) => item.id === product.id) ? items : [...items, product]);

  useEffect(() => {
    if (!fontsLoaded) return undefined;
    const timer = setTimeout(() => setScreen((current) => current === 'splash' ? 'home' : current), 750);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  const openPlanner = (name = 'Sample Room') => {
    setRoomTitle(name);
    setPlannerPhoto(null);
    setScreen('planner');
  };

  const navigate = (tab) => {
    if (tab === 'home') setScreen('home');
    else if (tab === 'explore') exploreFurniture();
    else if (tab === 'create') setScreen('dimensions');
    else setScreen('drafts');
  };

  const choosePhoto = async (useCamera) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', `Allow ${useCamera ? 'camera' : 'photo library'} access to choose a room photo. You can use the sample room without it.`);
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPlannerPhoto(result.assets[0].uri);
      setRoomTitle('My Room');
      setScreen('planner');
    } catch {
      Alert.alert('Could not open photos', 'Please try again or continue with the sample room.');
    }
  };

  const addProduct = (product) => {
    const item = {
      ...product,
      instanceId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: 18 + (placements.length % 3) * 24,
      y: 20 + (placements.length % 2) * 28,
    };
    setPlacements((items) => [...items, item]);
    setSelected(item.instanceId);
  };
  const move = (dx, dy) => setPlacements((items) => items.map((item) => item.instanceId === selected
    ? { ...item, x: Math.max(0, Math.min(100 - item.w, item.x + dx)), y: Math.max(0, Math.min(100 - item.h, item.y + dy)) }
    : item));
  const removeSelected = () => {
    setPlacements((items) => items.filter((item) => item.instanceId !== selected));
    setSelected(null);
  };

  const inputsChanged = () => { versionRef.current += 1; controller.invalidate(); };
  const changeRoom = (next) => { if (!sameRoom(room, next)) { inputsChanged(); setRoom(next); } };
  const changePhoto = (next) => { if (photo?.photoId !== next?.photoId) { inputsChanged(); setPhoto(next); } };
  const changeToken = (next) => { tokenRef.current = next; setToken(next); };
  const changeConnection = (next) => {
    const origin = normalizeApiOrigin(next.origin);
    if (origin !== apiOrigin || next.token !== tokenRef.current) {
      inputsChanged();
      healthCheckRef.current += 1;
      setHealth({ status: 'idle' });
    }
    setApiOrigin(origin);
    changeToken(next.token);
  };
  const runPreview = (inputs) => {
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
    const checkId = ++healthCheckRef.current;
    setHealth({ status: 'checking' });
    try {
      const result = await liveService.checkHealth();
      if (checkId === healthCheckRef.current) setHealth({ ...result, status: 'ok' });
    } catch (error) {
      if (checkId === healthCheckRef.current) setHealth({ status: 'error', message: error.message });
    }
  };

  if (!fontsLoaded || screen === 'splash') return <SplashScreen />;
  if (screen === 'home') return <HomeScreen onOpenPlanner={openPlanner} onOpenPhotoPicker={() => setScreen('dimensions')} onNavigate={navigate} />;
  if (screen === 'choose') return <ChooseRoomScreen onBack={() => setScreen('planner')} onUseSample={openPlanner} onTakePhoto={() => choosePhoto(true)} onChoosePhoto={() => choosePhoto(false)} />;
  if (screen === 'planner') return <PlannerScreen roomTitle={roomTitle} photo={plannerPhoto} placements={placements} selectedId={selected}
    onBack={() => setScreen('home')} onChangePhoto={() => setScreen('choose')} onRemovePhoto={() => setPlannerPhoto(null)}
    onAdd={addProduct} onSelect={setSelected} onMove={move} onRemove={removeSelected}
    onReset={() => { setPlacements([]); setSelected(null); }} />;
  if (screen === 'drafts') return <PlaceholderScreen section="drafts" onNavigate={navigate} />;
  if (screen === 'discover') return <FurnitureDiscovery onBack={() => setScreen(discoveryReturn)} onSave={saveProduct} savedIds={savedProducts.map((item) => item.id)} connection={{ origin: apiOrigin, token }} onConnectionChange={changeConnection} />;
  if (screen === 'saved') return <SavedFurniture products={savedProducts} onBack={() => setScreen('home')} onExplore={exploreFurniture} onRemove={(id) => setSavedProducts((items) => items.filter((item) => item.id !== id))} />;
  if (screen === 'dimensions') return <DimensionsScreen room={room} onBack={() => setScreen('home')} onContinue={(next) => { changeRoom(next); setScreen('photo'); }} />;
  if (screen === 'photo') return <PhotoScreen room={room} photo={photo} onBack={() => setScreen('dimensions')} onPhotoChange={changePhoto} onUseSample={() => askForSample('photo')} onContinue={() => setScreen('request')} />;
  if (screen === 'sampleConfirm') return <SampleConfirmScreen hasExistingInputs={!!(room || photo || request)} onCancel={() => setScreen(sampleReturn)} onConfirm={applySample} />;
  if (screen === 'request') return <RequestScreen key={`request-${versionRef.current}`} room={room} photo={photo} request={request}
    live={{ origin: apiOrigin, token, onTokenChange: changeToken, health, onCheckHealth: checkHealth }}
    onBack={() => setScreen('photo')} onSubmit={submitRequest} onRestoreSample={applySample} />;
  if (screen === 'results') return <ResultsScreen state={preview}
    onRetry={(optionId) => controller.retry(optionId)}
    onRunAgain={() => runPreview({ room, photo, request })}
    onEditRequest={() => leaveResults('request')}
    onStartAgain={() => { controller.invalidate(); startAgain(); }}
    onUseSample={() => { controller.invalidate(); askForSample('request'); }}
    onRestoreSample={() => { controller.invalidate(); applySample(); }} />;
  return <HomeScreen onOpenPlanner={openPlanner} onOpenPhotoPicker={() => setScreen('dimensions')} onNavigate={navigate} />;
}
