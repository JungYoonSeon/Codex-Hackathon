import React, { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Button, Header, Notice, Screen, ui } from "../../ui";
import { Chip, s } from "../home-profile/components";
import { photoImageSource } from "../preview/sampleScenario";
import { pickPhoto, preparePhoto } from "../preview/photo";
import { retainPhoto } from "./projectStore";
export default function ProductPreviewSetup({
  room,
  products,
  initialIds,
  connection,
  onConnection,
  onBack,
  onSearch,
  onGenerate,
  onSaveTargets,
  onSavedDemo,
}) {
  const [ids, setIds] = useState(
    initialIds.length ? initialIds : products.slice(0, 2).map((p) => p.id),
  );
  const [activeId, setActiveId] = useState(initialIds[0] ?? products[0]?.id);
  const [targets, setTargets] = useState(room.visualTargets ?? {}),
    [references, setReferences] = useState(room.productReferences ?? {});
  const [showConnection, setShowConnection] = useState(false);
  const [description, setDescription] = useState(
    [room.mood, room.color].filter(Boolean).join(" "),
  );
  const [origin, setOrigin] = useState(connection.origin),
    [token, setToken] = useState(connection.token),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const chosen = products.filter((p) => ids.includes(p.id));
  const active = chosen.find((p) => p.id === activeId) ?? chosen[0];
  const point = targets[active?.id];
  const [imageWidth, setImageWidth] = useState(1);
  const aspect = room.photo.widthPx / room.photo.heightPx || 4 / 3;
  const select = (id) => {
    const next = ids.includes(id)
      ? ids.filter((v) => v !== id)
      : ids.length < 2
        ? [...ids, id]
        : [ids[0], id];
    setIds(next);
    setActiveId(id);
  };
  async function upload() {
    setError("");
    setBusy(true);
    try {
      const picked = await pickPhoto({ camera: false });
      if (picked.status === "canceled") return;
      if (picked.status !== "picked") throw new Error(picked.message);
      const photo = await preparePhoto(picked.asset);
      if (!photo.uploadReady) throw new Error(photo.prepError);
      setReferences({ ...references, [active.id]: await retainPhoto(photo) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header onBack={onBack} label="PLACE & VISUALIZE" />
      <Text style={ui.title}>Try your furniture here</Text>
      <Text style={ui.body}>
        Select one or two products. Tap where the base of each piece should sit
        in the photo.
      </Text>
      {!products.length ? (
        <Notice>Save a product from Explore first.</Notice>
      ) : null}
      <View style={s.row}>
        {products.map((p) => (
          <Chip
            key={p.id}
            title={p.name}
            selected={ids.includes(p.id)}
            onPress={() => select(p.id)}
          />
        ))}
      </View>
      <Button secondary title="Find another product" onPress={onSearch} />
      <View style={s.row}>
        {chosen.map((p) => (
          <Chip
            key={p.id}
            title={`Position: ${p.name}`}
            selected={active?.id === p.id}
            onPress={() => setActiveId(p.id)}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap desired furniture position in room photo"
        onLayout={(event) => setImageWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          if (!active) return;
          const { locationX, locationY } = event.nativeEvent;
          setTargets({
            ...targets,
            [active.id]: {
              x: Math.max(0, Math.min(1, locationX / imageWidth)),
              y: Math.max(0, Math.min(1, locationY / (imageWidth / aspect))),
              rotation: point?.rotation ?? 0,
            },
          });
        }}
        style={{
          width: "100%",
          aspectRatio: aspect,
          position: "relative",
          backgroundColor: "#EEF0F5",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <Image
          pointerEvents="none"
          source={photoImageSource(room.photo)}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
        {point ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: 24,
              height: 24,
              marginLeft: -12,
              marginTop: -12,
              borderRadius: 12,
              borderColor: "white",
              borderWidth: 3,
              backgroundColor: "#162B70",
            }}
          />
        ) : null}
      </Pressable>
      {active ? (
        <>
          <Text style={s.small}>
            Target for {active.name}
            {point
              ? ` · ${Math.round(point.x * 100)}% across, ${Math.round(point.y * 100)}% down`
              : " · tap the photo to choose"}
          </Text>
          <View style={s.row}>
            {[0, 90].map((rotation) => (
              <Chip
                key={rotation}
                title={`${rotation}° plan orientation`}
                selected={point?.rotation === rotation}
                onPress={() =>
                  setTargets({
                    ...targets,
                    [active.id]: {
                      x: point?.x ?? 0.5,
                      y: point?.y ?? 0.75,
                      rotation,
                    },
                  })
                }
              />
            ))}
          </View>
          {references[active.id]?.uri || active.imageUrl ? (
            <Image
              source={{ uri: references[active.id]?.uri ?? active.imageUrl }}
              style={{ height: 130, width: "100%" }}
              resizeMode="contain"
            />
          ) : null}
          <Button
            secondary
            title={
              references[active.id]
                ? "Replace product reference photo"
                : "Upload product photo (optional / image unavailable)"
            }
            disabled={busy}
            onPress={upload}
          />
          <Text style={s.small}>
            We use the retailer product photo, or the reference you upload here.
            The room is not measured from this image.
          </Text>
        </>
      ) : null}
      <Text style={ui.label}>Style / placement note (optional)</Text>
      <TextInput
        accessibilityLabel="Preview preference"
        style={ui.input}
        maxLength={500}
        value={description}
        onChangeText={setDescription}
      />
      <Button
        small
        secondary
        title={
          origin && token
            ? "Server connected · settings"
            : "Connect preview server"
        }
        onPress={() => setShowConnection(!showConnection)}
      />
      {showConnection ? (
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>
            One-time connection for this app session
          </Text>
          <Text style={s.small}>
            Use the backend URL and DEMO_SESSION_TOKEN from server/.env. The
            OpenAI API key stays on the server.
          </Text>
          <TextInput
            accessibilityLabel="Preview server URL"
            style={ui.input}
            placeholder="https://your-server"
            autoCapitalize="none"
            value={origin}
            onChangeText={setOrigin}
          />
          <TextInput
            accessibilityLabel="Preview session token"
            secureTextEntry
            style={ui.input}
            autoCapitalize="none"
            placeholder="DEMO_SESSION_TOKEN"
            value={token}
            onChangeText={setToken}
          />
          <Button
            title="Save connection"
            onPress={() => {
              const next = {
                origin: origin.trim().replace(/\/+$/, ""),
                token: token.trim(),
              };
              if (!/^https?:\/\/[^\s/]+/.test(next.origin) || !next.token) {
                setError("Enter the backend address and demo-session token.");
                return;
              }
              onConnection(next);
              setShowConnection(false);
              setError("");
            }}
          />
        </View>
      ) : null}
      <Notice title="Live image generation">
        Generate sends the selected room photo and product reference to our
        server and OpenAI. Position and size in the generated picture are
        approximate; use measured fit checks before buying.
      </Notice>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button
        title={
          busy
            ? "Preparing…"
            : `Generate ${chosen.length} room preview${chosen.length === 1 ? "" : "s"}`
        }
        disabled={busy || !chosen.length}
        onPress={async () => {
          if (!/^https?:\/\/[^\s/]+/.test(origin.trim()) || !token.trim()) {
            setShowConnection(true);
            setError(
              "Connect the preview server once. This connection will be reused for other rooms.",
            );
            return;
          }
          if (chosen.some((p) => !targets[p.id])) {
            setError("Tap a target point for each selected product.");
            return;
          }
          setBusy(true);
          try {
            const next = {
              origin: origin.trim().replace(/\/+$/, ""),
              token: token.trim(),
            };
            onConnection(next);
            await onSaveTargets({
              visualTargets: targets,
              productReferences: references,
            });
            onGenerate({
              products: chosen,
              targets,
              references,
              description,
              connection: next,
            });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {room.photo.source === "sample" && onSavedDemo ? (
        <View style={{ marginTop: 12 }}>
          <Button
            secondary
            title="View saved sofa examples · no API call"
            onPress={onSavedDemo}
          />
        </View>
      ) : null}
    </Screen>
  );
}
