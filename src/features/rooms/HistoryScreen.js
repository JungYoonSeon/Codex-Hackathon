import React from "react";
import { Image, Text, View } from "react-native";
import { Button, Header, Notice, Screen, ui } from "../../ui";
import { s } from "../home-profile/components";
import { photoImageSource } from "../preview/sampleScenario";
export default function HistoryScreen({
  rooms,
  attempts,
  onBack,
  onOpenRoom,
  onOpenAttempt,
  onDeleteAttempt,
}) {
  return (
    <Screen>
      <Header onBack={onBack} label="DRAFTS & HISTORY" />
      <Text style={ui.title}>Everything you've tried</Text>
      <Text style={ui.body}>
        Room drafts and snapshots are saved on this device. Restoring an attempt
        creates a separate room copy.
      </Text>
      {rooms.map((room) => (
        <View style={ui.card} key={room.id}>
          <Text style={ui.sectionTitle}>{room.name}</Text>
          <Text style={s.small}>
            {room.type} · {room.products.length} candidates
          </Text>
          <Button
            small
            secondary
            title="Continue room"
            onPress={() => onOpenRoom(room.id)}
          />
        </View>
      ))}
      <Text style={s.section}>Saved attempts</Text>
      {!attempts.length ? (
        <Notice>
          Your arrangements and completed preview attempts will appear here.
        </Notice>
      ) : null}
      {attempts.map((attempt) => (
        <View key={attempt.id} style={ui.card}>
          <Text style={ui.sectionTitle}>
            {attempt.room.name} · {attempt.name}
          </Text>
          <Text style={s.small}>
            {new Date(attempt.createdAt).toLocaleString()}
          </Text>
          {attempt.room.photo ? (
            <Image
              source={photoImageSource(attempt.room.photo)}
              style={{ height: 130, width: "100%", marginVertical: 10 }}
              resizeMode="contain"
            />
          ) : null}
          <Text style={s.small}>
            {attempt.room.products.map((p) => p.name).join(" / ") ||
              "Room-only draft"}
          </Text>
          <View style={s.row}>
            <Button
              small
              title="View attempt"
              onPress={() => onOpenAttempt(attempt)}
            />
            <Button
              small
              secondary
              title="Delete attempt"
              onPress={() => onDeleteAttempt(attempt.id)}
            />
          </View>
        </View>
      ))}
    </Screen>
  );
}
