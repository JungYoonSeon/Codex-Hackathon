import React from "react";
import { Text, View } from "react-native";
import { Chip, s } from "../home-profile/components";
import { MOODS, PALETTES } from "./preferences";
export default function StylePreferences({ value, onChange }) {
  return (
    <View>
      <Text style={s.label}>Mood · optional</Text>
      <View style={s.row}>
        {MOODS.map((mood) => (
          <Chip
            key={mood}
            title={mood}
            selected={value.mood === mood}
            onPress={() => onChange({ mood: value.mood === mood ? "" : mood })}
          />
        ))}
      </View>
      <Text style={s.label}>Color · optional</Text>
      <View style={s.row}>
        {PALETTES.map((color) => (
          <Chip
            key={color}
            title={color}
            selected={value.color === color}
            onPress={() =>
              onChange({ color: value.color === color ? "" : color })
            }
          />
        ))}
      </View>
    </View>
  );
}
