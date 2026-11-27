import React from 'react';
import { Image, Text, View } from 'react-native';
import { Button, Header, Notice, Screen, ui } from '../../ui.js';
import { SAMPLE_FURNITURE_REQUEST, SAMPLE_ROOM, SAMPLE_ROOM_IMAGE } from '../preview/sampleScenario.js';
import { formatRoom } from './PhotoScreen.js';

/** Explicit opt-in: the saved examples only exist for these exact preset inputs. */
export function SampleConfirmScreen({ hasExistingInputs, onCancel, onConfirm }) {
  return (
    <Screen>
      <Header onBack={onCancel} label="SAMPLE ROOM" />
      <Text style={ui.eyebrow}>SAVED ILLUSTRATED EXAMPLE</Text>
      <Text style={ui.title}>Use the sample room?</Text>
      <Text style={ui.body}>
        The sample shows saved illustrations that are bundled with the app. Nothing is uploaded and no AI is run.
      </Text>
      <View style={ui.card}>
        <Image source={SAMPLE_ROOM_IMAGE} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }} resizeMode="contain"
          accessible accessibilityLabel="Sample room illustration" />
        <Text style={[ui.label, { marginTop: 12 }]}>These inputs will be used</Text>
        <Text style={ui.hint}>Room: {formatRoom(SAMPLE_ROOM)} (fictional demo room)</Text>
        <Text style={ui.hint}>Furniture: {SAMPLE_FURNITURE_REQUEST.category}, “{SAMPLE_FURNITURE_REQUEST.description}”</Text>
      </View>
      {hasExistingInputs ? (
        <Notice tone="warn">This replaces the dimensions, photo and request you entered.</Notice>
      ) : null}
      <View style={ui.stack}>
        <Button title="Use sample inputs" onPress={onConfirm} />
        <Button title="Cancel" secondary onPress={onCancel} />
      </View>
    </Screen>
  );
}
