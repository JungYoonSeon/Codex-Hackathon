import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Header, Notice, Screen, ui } from '../../ui.js';

const MAX_CM = 100_000; // matches the server schema

function parseCm(text, { required }) {
  const value = text.trim();
  if (!value) return required ? { error: 'Enter a value in centimeters.' } : { value: undefined };
  if (!/^\d+$/.test(value)) return { error: 'Use whole centimeters, for example 400.' };
  const number = Number(value);
  if (number < 1 || number > MAX_CM) return { error: 'Use a value from 1 to 100,000 cm.' };
  return { value: number };
}

/** Step 1: room dimensions. Emits a validated RoomInput. */
export function DimensionsScreen({ room, onBack, onContinue }) {
  const [width, setWidth] = useState(room?.widthCm ? String(room.widthCm) : '');
  const [length, setLength] = useState(room?.lengthCm ? String(room.lengthCm) : '');
  const [height, setHeight] = useState(room?.heightCm ? String(room.heightCm) : '');
  const [errors, setErrors] = useState({});

  const submit = () => {
    const w = parseCm(width, { required: true });
    const l = parseCm(length, { required: true });
    const h = parseCm(height, { required: false });
    const next = { width: w.error, length: l.error, height: h.error };
    setErrors(next);
    if (w.error || l.error || h.error) return;
    const result = { widthCm: w.value, lengthCm: l.value };
    if (h.value !== undefined) result.heightCm = h.value;
    onContinue(result);
  };

  const field = (key, label, value, setValue, hint) => (
    <View style={ui.field}>
      <Text style={ui.label} nativeID={`${key}-label`}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${key}-label`}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        maxLength={6}
        placeholder="cm"
        style={[ui.input, errors[key] && ui.inputError]}
      />
      {hint ? <Text style={[ui.hint, { marginTop: 5 }]}>{hint}</Text> : null}
      {errors[key] ? <Text style={ui.errorText} accessibilityLiveRegion="polite">{errors[key]}</Text> : null}
    </View>
  );

  return (
    <Screen>
      <Header onBack={onBack} label="ROOM MEASUREMENTS" />
      <Text style={ui.eyebrow}>YOUR SPACE</Text>
      <Text style={ui.title}>How big is the room?</Text>
      <Text style={ui.body}>Measure the floor area where the furniture should go.</Text>
      {field('width', 'Width (cm)', width, setWidth)}
      {field('length', 'Length (cm)', length, setLength)}
      {field('height', 'Ceiling height (cm, optional)', height, setHeight)}
      <Notice>These dimensions help screen candidate sizes. Add doorways, obstacles and delivery routes in Measurements & lifestyle for detailed checks.</Notice>
      <Button title="Continue" onPress={submit} />
    </Screen>
  );
}
