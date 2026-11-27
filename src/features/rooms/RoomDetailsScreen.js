import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Header, Screen, ui } from "../../ui";
import { Chip, Field, s } from "../home-profile/components";
import StylePreferences from "../style/StylePreferences";
const TYPES = [
  "Home office",
  "Bedroom",
  "Living room",
  "Dining room",
  "Kitchen",
  "Other",
];
export default function RoomDetailsScreen({ room, onBack, onSave }) {
  const [draft, setDraft] = useState(room),
    [error, setError] = useState("");
  return (
    <Screen>
      <Header onBack={onBack} label="YOUR ROOM" />
      <Text style={ui.title}>A space of your own</Text>
      <Text style={ui.body}>
        Start with the room. Furniture can come later.
      </Text>
      <Field
        label="Room name"
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
      />
      <Text style={s.label}>Room type</Text>
      <View style={s.row}>
        {TYPES.map((type) => (
          <Chip
            key={type}
            title={type}
            selected={draft.type === type}
            onPress={() => setDraft({ ...draft, type })}
          />
        ))}
      </View>
      <StylePreferences
        value={draft}
        onChange={(patch) => setDraft({ ...draft, ...patch })}
      />
      {error ? <Text style={ui.errorText}>{error}</Text> : null}
      <Button
        title="Save room & continue"
        onPress={() => {
          if (!draft.name.trim()) {
            setError("Please name this room.");
            return;
          }
          onSave({
            ...draft,
            name: draft.name.trim(),
            profile: { ...draft.profile, name: draft.name.trim() },
          });
        }}
      />
    </Screen>
  );
}
