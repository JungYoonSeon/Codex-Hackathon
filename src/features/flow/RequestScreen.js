import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { PHOTO_HANDLING_NOTICE } from '../../../shared/contracts.ts';
import { Button, COLORS, Header, Notice, Screen, ui } from '../../ui.js';
import { matchesSampleInputs } from '../preview/savedExampleService.js';
import { formatRoom } from './PhotoScreen.js';

const CATEGORIES = [{ id: 'sofa', label: 'Sofa' }, { id: 'chair', label: 'Chair' }];
const MAX_DESCRIPTION = 500;

/** Step 3: furniture request; live settings when the photo is the user's own. */
export function RequestScreen({ room, photo, request, live, onBack, onSubmit, onRestoreSample }) {
  const [category, setCategory] = useState(request?.category ?? null);
  const [description, setDescription] = useState(request?.description ?? '');
  const [error, setError] = useState(null);

  const draft = category ? { category, description: description.trim() } : null;
  const isSample = photo?.source === 'sample';
  const sampleMismatch = isSample && draft && !matchesSampleInputs(room, draft);

  const submit = () => {
    if (!category) { setError('Choose sofa or chair.'); return; }
    setError(null);
    onSubmit(draft);
  };

  return (
    <Screen>
      <Header onBack={onBack} label="CHOOSE FURNITURE" />
      <Text style={ui.eyebrow}>WHAT ARE YOU LOOKING FOR?</Text>
      <Text style={ui.title}>What would you like to try?</Text>
      <Text style={[ui.hint, { marginTop: 8, marginBottom: 18 }]}>
        Room: {room ? formatRoom(room) : '—'} · {isSample ? 'sample room' : 'your photo'}
      </Text>

      <Text style={ui.label}>Category</Text>
      <View style={[ui.row, { marginBottom: 16 }]} accessibilityRole="radiogroup">
        {CATEGORIES.map((item) => {
          const selected = category === item.id;
          return (
            <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }}
              onPress={() => setCategory(item.id)}
              style={{ minHeight: 44, minWidth: 96, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 2,
                borderColor: selected ? COLORS.green : COLORS.line, backgroundColor: selected ? COLORS.pale : COLORS.white }}>
              <Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: selected ? '800' : '500' }}>{selected ? `✓ ${item.label}` : item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[ui.errorText, { marginTop: -8, marginBottom: 12 }]}>{error}</Text> : null}

      <View style={ui.field}>
        <Text style={ui.label} nativeID="description-label">Style or colour (optional)</Text>
        <TextInput accessibilityLabel="Style or colour" accessibilityLabelledBy="description-label" value={description}
          onChangeText={setDescription} maxLength={MAX_DESCRIPTION} placeholder="e.g. compact beige" style={ui.input} returnKeyType="done" />
        <Text style={[ui.hint, { marginTop: 5 }]}>Simple English colour and style words help ranking, e.g. beige, sage, oak, compact.</Text>
      </View>

      {isSample ? (
        sampleMismatch ? (
          <Notice tone="warn" title="Saved examples need the sample inputs">
            Saved illustrations only exist for exactly 400 × 300 cm, a 260 cm ceiling, sofa and “compact beige”. With other inputs the sample room shows no previews.
          </Notice>
        ) : (
          <Notice title="Saved illustrated examples">These are bundled with the app. Nothing is uploaded and no AI is run.</Notice>
        )
      ) : (
        <LiveSettings live={live} />
      )}

      <View style={ui.stack}>
        <Button title="Show furniture options" onPress={submit} />
        {sampleMismatch ? <Button title="Restore sample inputs" secondary onPress={onRestoreSample} /> : null}
      </View>
    </Screen>
  );
}

function LiveSettings({ live }) {
  const { origin, token, onTokenChange, health, onCheckHealth } = live;
  return (
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>Live AI preview</Text>
      <Text style={[ui.noticeText, { marginTop: 6 }]}>{PHOTO_HANDLING_NOTICE}</Text>
      <Text style={[ui.hint, { marginTop: 10 }]}>Server: {origin || 'not configured in this build (EXPO_PUBLIC_API_URL)'}</Text>
      <Text style={[ui.label, { marginTop: 12 }]} nativeID="token-label">Demo-session token</Text>
      <TextInput accessibilityLabel="Demo-session token" accessibilityLabelledBy="token-label" value={token} onChangeText={onTokenChange}
        secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Ask the demo operator" style={ui.input} />
      <Text style={[ui.hint, { marginTop: 5 }]}>Kept in memory only while the app is open.</Text>
      <View style={[ui.row, { alignItems: 'center', marginTop: 10 }]}>
        <Button small secondary title="Check server" onPress={onCheckHealth} disabled={!origin || health.status === 'checking'} />
        {health.status === 'checking' ? <ActivityIndicator color={COLORS.green} /> : null}
      </View>
      {health.status === 'ok' ? (
        <Text style={[ui.hint, { marginTop: 8 }]} accessibilityLiveRegion="polite">
          {health.liveConfigured ? 'Server reachable. Live generation is configured (not yet proven to work).' : 'Server reachable, but live generation is not configured. Previews will be unavailable.'}
        </Text>
      ) : null}
      {health.status === 'error' ? <Text style={ui.errorText} accessibilityLiveRegion="polite">{health.message}</Text> : null}
    </View>
  );
}
