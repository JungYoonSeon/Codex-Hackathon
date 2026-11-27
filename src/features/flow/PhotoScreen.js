import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Button, COLORS, Header, Notice, Screen, ui } from '../../ui.js';
import { pickPhoto, preparePhoto } from '../preview/photo.js';
import { photoImageSource } from '../preview/sampleScenario.js';

/** Step 2: choose, replace or remove the room photo. Does not start generation. */
export function PhotoScreen({ room, photo, onBack, onPhotoChange, onUseSample, onContinue }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const busyRef = useRef(false);

  const choose = async (camera) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickPhoto({ camera });
      if (picked.status === 'canceled') return; // keep the existing photo, no error
      if (picked.status !== 'picked') { setMessage(picked.message); return; }
      onPhotoChange(await preparePhoto(picked.asset));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const aspectRatio = photo?.widthPx && photo?.heightPx ? photo.widthPx / photo.heightPx : 4 / 3;

  return (
    <Screen>
      <Header onBack={onBack} label="STEP 2 OF 4" />
      <Text style={ui.eyebrow}>YOUR ROOM PHOTO</Text>
      <Text style={ui.title}>{photo ? 'Your room photo' : 'Choose a room photo'}</Text>
      {room ? <Text style={[ui.hint, { marginTop: 8 }]}>Room: {formatRoom(room)}</Text> : null}
      <Text style={ui.body}>
        Your photo stays on this phone until you ask for live previews. Then it is sent to the RoomReady demo server and OpenAI.
      </Text>

      {photo ? (
        <View style={ui.card}>
          <Image
            source={photoImageSource(photo)}
            style={{ width: '100%', aspectRatio, borderRadius: 12, backgroundColor: '#E7E7DB' }}
            resizeMode="contain"
            accessible
            accessibilityLabel={photo.source === 'sample' ? 'Sample room illustration' : 'Your selected room photo'}
          />
          <Text style={[ui.hint, { marginTop: 8 }]}>
            {photo.source === 'sample' ? 'Sample room · illustration bundled with the app' : `Your photo · ${photo.widthPx} × ${photo.heightPx} px`}
          </Text>
          {photo.prepError ? <Notice tone="warn" title="Live previews unavailable for this photo">{photo.prepError}</Notice> : null}
        </View>
      ) : null}

      {message ? <Notice tone="warn">{message}</Notice> : null}
      {busy ? (
        <View style={[ui.row, { alignItems: 'center', marginBottom: 12 }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={COLORS.green} />
          <Text style={ui.hint}>Preparing photo…</Text>
        </View>
      ) : null}

      <View style={ui.stack}>
        {photo ? <Button title="Continue" onPress={onContinue} disabled={busy} /> : null}
        <Button title={photo ? 'Replace with another photo' : 'Choose from photos'} secondary={!!photo} onPress={() => choose(false)} disabled={busy} />
        <Button title="Take a photo" secondary onPress={() => choose(true)} disabled={busy} />
        {photo ? <Button title="Remove photo" secondary onPress={() => { setMessage(null); onPhotoChange(null); }} disabled={busy} /> : null}
        {photo?.source !== 'sample' ? <Button title="Try the sample room instead" secondary onPress={onUseSample} disabled={busy} /> : null}
      </View>
    </Screen>
  );
}

export function formatRoom(room) {
  const base = `${room.widthCm} × ${room.lengthCm} cm`;
  return room.heightCm ? `${base}, ${room.heightCm} cm ceiling` : base;
}
