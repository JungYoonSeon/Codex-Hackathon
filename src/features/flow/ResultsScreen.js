import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { VISUALIZATION_NOTICE } from '../../../shared/contracts.ts';
import { Button, COLORS, Header, Notice, Screen, ui } from '../../ui.js';
import { isBusy } from '../preview/previewController.js';
import { photoImageSource } from '../preview/sampleScenario.js';
import { SAVED_EXAMPLE_LABEL } from '../preview/savedExampleService.js';

const LETTERS = ['A', 'B'];

/** Step 4: candidate cards and per-option Original / Furnished comparison. */
export function ResultsScreen({ state, onRetry, onRunAgain, onEditRequest, onStartAgain, onUseSample, onRestoreSample, onCompare, onRoom, readOnly = false }) {
  const busy = isBusy(state);
  const saved = state.mode === 'saved_demo';
  const total = state.candidates.length;
  const aspectRatio = state.photo?.widthPx && state.photo?.heightPx ? state.photo.widthPx / state.photo.heightPx : 4 / 3;

  return (
    <Screen>
      <Header onBack={onEditRequest} label="VISUALIZE YOUR ROOM" />
      <Text style={ui.eyebrow}>{saved ? 'SAVED ILLUSTRATED EXAMPLES' : 'LIVE AI PREVIEWS'}</Text>
      <Text style={ui.title}>Your furniture options</Text>
      <Notice title={saved ? 'Saved illustrated examples — not live AI results' : 'Live AI previews'}>
        {saved
          ? 'These pictures are bundled with the app for the sample room. Nothing was uploaded.'
          : 'Your photo is sent to the RoomReady demo server and OpenAI to create each preview.'}
      </Notice>

      {state.phase === 'matching' ? (
        <View style={[ui.row, { alignItems: 'center', marginVertical: 16 }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={COLORS.green} />
          <Text style={ui.hint}>Finding furniture for your room…</Text>
        </View>
      ) : null}

      {state.phase === 'error' && state.error && readOnly ? <Notice tone="warn">{state.error.message}</Notice> : null}
      {state.phase === 'error' && state.error && !readOnly ? (
        <ErrorPanel error={state.error} saved={saved} onRunAgain={onRunAgain} onEditRequest={onEditRequest}
          onUseSample={onUseSample} onRestoreSample={onRestoreSample} />
      ) : null}

      {state.phase === 'ready' && total === 0 ? (
        <Notice tone="warn" title="No matching furniture">{state.notice || 'No demo furniture matches this category and these dimensions.'}</Notice>
      ) : null}
      {state.phase === 'ready' && total > 0 && state.notice ? <Text style={[ui.hint, { marginBottom: 12 }]}>{state.notice}</Text> : null}
      {state.phase === 'ready' && total === 1 ? <Text style={[ui.hint, { marginBottom: 12 }]}>Only one option matches.</Text> : null}

      {state.candidates.map((candidate, index) => (
        <CandidateCard key={`${state.runId}-${candidate.id}`} candidate={candidate} letter={LETTERS[index] ?? String(index + 1)}
          index={index} total={total} result={state.results[candidate.id]} saved={saved}
          originalSource={photoImageSource(state.photo)} aspectRatio={aspectRatio}
          retryDisabled={busy || readOnly} onRetry={() => onRetry(candidate.id)} />
      ))}

      <Text style={[ui.hint, { marginVertical: 14 }]}>{VISUALIZATION_NOTICE}</Text>
      <View style={ui.stack}>
        {onCompare ? <Button title="Compare candidates · fit & reasons" onPress={onCompare} disabled={total < 2}/> : null}
        {onRoom ? <Button title="Back to room" secondary onPress={onRoom}/> : null}
        {!readOnly && <Button title="Edit request" secondary onPress={onEditRequest} />}
        {!readOnly && <Button title="Start again" secondary onPress={onStartAgain} />}
      </View>
    </Screen>
  );
}

function ErrorPanel({ error, saved, onRunAgain, onEditRequest, onUseSample, onRestoreSample }) {
  const sampleMismatch = saved && error.code === 'LIVE_UNAVAILABLE';
  const liveUnavailable = !saved && error.code === 'LIVE_UNAVAILABLE';
  return (
    <View style={{ marginBottom: 12 }}>
      <Notice tone="warn" title={sampleMismatch ? 'Saved examples need the sample inputs' : liveUnavailable ? 'Live preview unavailable' : 'Could not load options'}>
        {error.message}
      </Notice>
      <View style={ui.stack}>
        {error.retryable ? <Button title="Try again" onPress={onRunAgain} /> : null}
        {sampleMismatch ? <Button title="Restore sample inputs" onPress={onRestoreSample} /> : null}
        {liveUnavailable ? <Button title="Try the sample room instead" onPress={onUseSample} /> : null}
        {error.code === 'UNAUTHORIZED' ? <Button title="Enter demo token" onPress={onEditRequest} /> : null}
      </View>
    </View>
  );
}

function CandidateCard({ candidate, letter, index, total, result, saved, originalSource, aspectRatio, retryDisabled, onRetry }) {
  const [view, setView] = useState('furnished');
  const [imageError, setImageError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const status = result?.status ?? 'waiting';
  const showFurnished = status === 'ready' && view === 'furnished';
  const source = showFurnished ? result.imageSource : originalSource;
  const dims = [candidate.widthCm, candidate.depthCm, candidate.heightCm].map(value => value ?? '?').join(' × ');

  return (
    <View style={ui.card}>
      <Text style={ui.eyebrow}>OPTION {letter}</Text>
      <Text style={ui.sectionTitle}>{candidate.name}</Text>
      <Text style={[ui.hint, { marginTop: 4 }]}>{dims} cm (W × D × H) · {candidate.catalogProduct && candidate.dataMode !== 'demo' ? 'selected retailer product' : 'fictional demo furniture'}</Text>
      {candidate.matchReason ? <Text style={[ui.hint, { marginTop: 4 }]}>{candidate.matchReason}</Text> : null}

      {status === 'ready' ? (
        <View style={[ui.row, { marginTop: 12 }]} accessibilityRole="tablist">
          {[['original', 'Original'], ['furnished', 'Furnished']].map(([key, label]) => {
            const selected = view === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }}
                accessibilityLabel={`${label} view, option ${letter}`}
                onPress={() => { setView(key); setImageError(false); }}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11, borderWidth: 2,
                  borderColor: selected ? COLORS.green : COLORS.line, backgroundColor: selected ? COLORS.pale : COLORS.white }}>
                <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: selected ? '800' : '500' }}>{selected ? `● ${label}` : label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        {source && !imageError ? (
          <Image key={`${view}-${reloadKey}`} source={source} resizeMode="contain" onError={() => setImageError(true)}
            style={{ width: '100%', aspectRatio, borderRadius: 12, backgroundColor: '#E7E7DB', opacity: status === 'ready' ? 1 : 0.55 }}
            accessible
            accessibilityLabel={showFurnished
              ? `Furnished room preview, option ${letter}, ${candidate.name}. ${saved ? 'Saved illustration' : 'AI visualization'}.`
              : 'Original room photo'} />
        ) : null}
        {imageError ? (
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: COLORS.warnBg }}>
            <Text style={[ui.noticeText, { color: COLORS.warnInk }]}>This image could not be displayed.</Text>
            <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Button small secondary title="Reload image" onPress={() => { setImageError(false); setReloadKey((k) => k + 1); }} />
            </View>
          </View>
        ) : null}
        {status === 'ready' ? (
          <Text style={[ui.hint, { marginTop: 6 }]}>
            {view === 'furnished' ? (saved ? SAVED_EXAMPLE_LABEL : 'Live AI visualization') : saved ? 'Original sample room' : 'Your original photo'}
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
        {status === 'waiting' ? <Text style={ui.hint}>Waiting to create preview</Text> : null}
        {status === 'generating' ? (
          <View style={[ui.row, { alignItems: 'center' }]}>
            <ActivityIndicator color={COLORS.green} />
            <Text style={ui.hint}>{saved ? `Loading saved example ${index + 1} of ${total}` : `Creating option ${index + 1} of ${total}`}</Text>
          </View>
        ) : null}
        {status === 'failed' && result?.error ? (
          <View>
            <Notice tone="warn" title="Preview not available">{result.error.message}</Notice>
            {result.error.retryable ? (
              <Button small title={`Retry option ${letter}`} onPress={onRetry} disabled={retryDisabled}
                accessibilityHint={retryDisabled ? 'Available when the current preview finishes' : undefined} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
