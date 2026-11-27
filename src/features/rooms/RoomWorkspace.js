import React from "react";
import { Image, Text, View } from "react-native";
import { Button, Header, Notice, Screen, ui } from "../../ui";
import { Chip, s } from "../home-profile/components";
import { photoImageSource } from "../preview/sampleScenario";
import FurnitureForYou from "../style/FurnitureForYou";
export default function RoomWorkspace({
  room,
  connection,
  onBack,
  onPhoto,
  onDetails,
  onMeasurements,
  onVisualize,
  onSearch,
  onPreferences,
  onSaveProduct,
  onTry,
  onCompare,
  onEvaluate,
  onPlacement,
  onSaveAttempt,
  onHistory,
  onRemoveProduct,
  selected,
  onSelect,
}) {
  return (
    <Screen>
      <Header onBack={onBack} label={room.type.toUpperCase()} />
      <Text style={ui.title}>{room.name}</Text>
      <Text style={ui.body}>
        Choose furniture, picture it here, and check the measurements.
      </Text>
      {room.photo ? (
        <Image
          source={photoImageSource(room.photo)}
          style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 18 }}
          resizeMode="contain"
        />
      ) : (
        <Notice>
          Add a room photo when you're ready to visualize furniture.
        </Notice>
      )}
      {room.photo?.source === "sample" ? (
        <Text style={s.small}>
          Illustrated sample room · not your measured room.
        </Text>
      ) : null}
      <View style={s.row}>
        <Button title="Visualize furniture →" onPress={onVisualize} />
        <Button secondary title="Photo & shooting guide" onPress={onPhoto} />
      </View>
      <View style={s.row}>
        <Button small secondary title="Room name & style" onPress={onDetails} />
        <Button
          small
          secondary
          title="Measurements & lifestyle"
          onPress={onMeasurements}
        />
        <Button small secondary title="Saved attempts" onPress={onHistory} />
      </View>
      <Text style={s.section}>Furniture in this room</Text>
      {!room.products.length ? (
        <Notice>
          Save candidates below or search stores. You can keep this room without
          selecting furniture.
        </Notice>
      ) : null}
      {room.products.map((p) => (
        <View key={p.id} style={ui.card}>
          <Text style={ui.sectionTitle}>{p.name}</Text>
          <Text style={s.small}>
            {p.sourceLabel} ·{" "}
            {p.dataMode === "demo" ? "Fictional sample" : "Catalog product"}
          </Text>
          <View style={s.row}>
            <Chip
              title={
                selected.includes(p.id)
                  ? "✓ Compare selected"
                  : "Select for comparison"
              }
              selected={selected.includes(p.id)}
              onPress={() => onSelect(p.id)}
            />
            <Button
              small
              secondary
              title="Why this fits / checks"
              onPress={() => onEvaluate(p.id)}
            />
            <Button
              small
              secondary
              title="Set placement"
              onPress={() => onPlacement(p.id)}
            />
            {p.previewOptionId ? (
              <Button small title="Visualize" onPress={() => onTry(p)} />
            ) : null}
            <Button
              small
              secondary
              title="Remove candidate"
              onPress={() => onRemoveProduct(p.id)}
            />
          </View>
        </View>
      ))}
      <Button
        title={`Compare two candidates (${selected.length}/2)`}
        onPress={onCompare}
        disabled={selected.length !== 2}
      />
      <View style={{ marginTop: 10 }}>
        <Button
          secondary
          title="Save this arrangement"
          onPress={onSaveAttempt}
        />
      </View>
      <Text style={s.small}>
        Placements and completed preview attempts are saved in history.
        Generated images are visual estimates; measured fit checks are separate.
      </Text>
      <View style={{ marginTop: 24 }}>
        <FurnitureForYou
          room={room}
          connection={connection}
          onPreferences={onPreferences}
          onSave={onSaveProduct}
          onTry={onTry}
          onSearch={onSearch}
        />
      </View>
    </Screen>
  );
}
