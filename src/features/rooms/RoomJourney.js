import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import HomeScreen from "../../screens/HomeScreen";
import FurnitureDiscovery from "../../../mobile/FurnitureDiscovery";
import { Button, Header, Notice, Screen, ui } from "../../ui";
import { Chip, s } from "../home-profile/components";
import { HomeProfileEditor } from "../home-profile/HomeProfileEditor";
import { PlacementEditor } from "../home-profile/PlacementEditor";
import { ProductEvaluationScreen } from "../product-evaluation/ProductEvaluationScreen";
import { ComparisonScreen } from "../comparison/ComparisonScreen";
import { adaptDiscoveryProduct } from "../product-evaluation/adaptProduct";
import { PhotoScreen } from "../flow/PhotoScreen";
import { DimensionsScreen } from "../flow/DimensionsScreen";
import { RequestScreen } from "../flow/RequestScreen";
import { ResultsScreen } from "../flow/ResultsScreen";
import { usePreviewController } from "../preview/usePreviewController";
import { createLiveService, normalizeApiOrigin } from "../preview/liveService";
import {
  SAMPLE_PHOTO,
  SAMPLE_ROOM,
  SAMPLE_FURNITURE_REQUEST,
  savedExampleService,
  photoImageSource,
} from "../preview/sampleScenario";
import { discoveryDemoProducts } from "../../../shared/discovery";
import RoomDetailsScreen from "./RoomDetailsScreen";
import RoomWorkspace from "./RoomWorkspace";
import HistoryScreen from "./HistoryScreen";
import FurnitureForYou from "../style/FurnitureForYou";
import {
  makeRoom,
  newId,
  projectStore,
  retainPhoto,
  retainPreview,
  roomDimensions,
  snapshotAttempt,
} from "./projectStore";

function notifyUser(title, message, buttons) {
  if (Platform.OS === 'web') {
    if (buttons) {
      if (window.confirm(`${title}\n${message}`)) buttons.find(button => button.style === 'destructive')?.onPress?.();
    } else window.alert(`${title}\n${message}`);
  } else Alert.alert(title, message, buttons);
}

const initialConnection = {
  origin: normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL),
  token: "",
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const mergeProducts = (existing, items) => [
  ...new Map([...existing, ...items].map((p) => [p.id, p])).values(),
];
function productsFromPreview(state) {
  return state.candidates.map(
    (candidate) =>
      discoveryDemoProducts.find((p) => p.previewOptionId === candidate.id) ?? {
        id: `demo:${candidate.id}`,
        name: candidate.name,
        category: candidate.category ?? state.request.category,
        sourceLabel: "RoomReady sample",
        dataMode: "demo",
        tags: [],
        dimensions: {
          widthCm: candidate.widthCm,
          depthCm: candidate.depthCm,
          heightCm: candidate.heightCm,
        },
        previewOptionId: candidate.id,
      },
  );
}
function previewsFor(state) {
  return Object.fromEntries(
    (state?.candidates ?? [])
      .filter((c) => state.results[c.id]?.status === "ready")
      .map((c) => [
        `demo:${c.id}`,
        {
          photoId: state.photo.photoId,
          source: state.results[c.id].imageSource,
          mode: state.mode,
        },
      ]),
  );
}
export default function RoomJourney() {
  const [data, setData] = useState(null),
    dataRef = useRef(null),
    [loadError, setLoadError] = useState(""),
    [storageError, setStorageError] = useState("");
  const [screen, setScreen] = useState("home"),
    [activeId, setActiveId] = useState(null),
    [draft, setDraft] = useState(null),
    [selected, setSelected] = useState([]);
  const [productId, setProductId] = useState(null),
    [returnTo, setReturnTo] = useState("workspace"),
    [searchReturn, setSearchReturn] = useState("explore");
  const [connection, setConnection] = useState(initialConnection),
    [health, setHealth] = useState({ status: "idle" }),
    [wantedProduct, setWantedProduct] = useState(null);
  const [historyItem, setHistoryItem] = useState(null),
    [dimensionNext, setDimensionNext] = useState("workspace");
  const { state: preview, controller } = usePreviewController();
  const version = useRef(0),
    runRoom = useRef(null),
    savedSignatures = useRef(new Set());
  const liveService = useMemo(
    () =>
      createLiveService({
        apiOrigin: connection.origin,
        getToken: () => connection.token,
      }),
    [connection],
  );
  const room = data?.rooms.find((r) => r.id === activeId) ?? data?.rooms[0];
  const normalized = useMemo(
    () => (room?.products ?? []).map(adaptDiscoveryProduct),
    [room?.products],
  );
  const product = normalized.find((p) => p.id === productId);
  const load = async () => {
    setLoadError("");
    try {
      const next = await projectStore.load();
      await projectStore.save(next);
      dataRef.current = next;
      setData(next);
      setActiveId(next.rooms[0]?.id ?? null);
    } catch (e) {
      setLoadError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const commit = async (next) => {
    dataRef.current = next;
    setData(next);
    try {
      await projectStore.save(next);
      setStorageError("");
      return true;
    } catch (e) {
      setStorageError(e.message);
      return false;
    }
  };
  const updateRoom = (id, patch) => {
    const current = dataRef.current;
    return commit({
      ...current,
      rooms: current.rooms.map((r) =>
        r.id === id
          ? { ...r, ...patch, updatedAt: new Date().toISOString() }
          : r,
      ),
    });
  };
  const addAttempt = async (r, label) => {
    const success = await commit({
      ...dataRef.current,
      attempts: [
        snapshotAttempt({ ...r, comparisonIds: selected }, label),
        ...dataRef.current.attempts,
      ],
    });
    if (!success)
      throw new Error(
        "The snapshot could not be saved. Retry saving from the warning above.",
      );
    return true;
  };
  const invalidate = () => {
    version.current++;
    controller.invalidate();
    runRoom.current = null;
  };
  const openRoom = (id, to = "photo") => {
    invalidate();
    setActiveId(id);
    setSelected([]);
    setWantedProduct(null);
    setScreen(to);
  };
  const createRoom = () => {
    invalidate();
    setDraft(makeRoom());
    setScreen("details");
  };
  const preferences = (patch) => updateRoom(room.id, patch);
  const saveProduct = (p) => {
    if (!room) {
      createRoom();
      return;
    }
    updateRoom(room.id, { products: mergeProducts(room.products, [p]) });
  };
  const choose = (id) =>
    setSelected((ids) =>
      ids.includes(id)
        ? ids.filter((v) => v !== id)
        : ids.length < 2
          ? [...ids, id]
          : [ids[0], id],
    );
  const search = () => {
    setSearchReturn(screen);
    setScreen("search");
  };
  const navigate = (tab) => {
    if (tab === "create") {
      createRoom();
      return;
    }
    invalidate();
    setScreen(tab === "drafts" ? "history" : tab);
  };
  const goVisualize = (p = null) => {
    if (!room) {
      createRoom();
      return;
    }
    invalidate();
    setWantedProduct(p);
    if (p) saveProduct(p);
    if (!room.photo) {
      setScreen("photo");
      return;
    }
    if (!roomDimensions(room)) {
      setDimensionNext("request");
      setScreen("dimensions");
      return;
    }
    setScreen("request");
  };
  const applySample = async () => {
    invalidate();
    const profile = {
      ...room.profile,
      room: {
        widthCm: { value: SAMPLE_ROOM.widthCm, source: "demo" },
        depthCm: { value: SAMPLE_ROOM.lengthCm, source: "demo" },
        heightCm: { value: SAMPLE_ROOM.heightCm, source: "demo" },
      },
    };
    await updateRoom(room.id, {
      photo: SAMPLE_PHOTO,
      profile,
      request: SAMPLE_FURNITURE_REQUEST,
      latestPreview: null,
    });
    setWantedProduct(null);
    setScreen("workspace");
  };
  const runPreview = (next) => {
    const dimensions = roomDimensions(room);
    if (!dimensions || !room.photo) return;
    invalidate();
    const snapshot = { ...room, request: next };
    const attempt = snapshotAttempt(
      { ...snapshot, latestPreview: null },
      "Preview requested",
    );
    runRoom.current = { ...snapshot, attemptId: attempt.id };
    commit({
      ...dataRef.current,
      rooms: dataRef.current.rooms.map((r) =>
        r.id === room.id ? { ...r, request: next } : r,
      ),
      attempts: [attempt, ...dataRef.current.attempts],
    });
    const base =
      room.photo.source === "sample" ? savedExampleService : liveService;
    const target = wantedProduct?.previewOptionId;
    const service = target
      ? {
          ...base,
          async getRecommendations(...args) {
            const response = await base.getRecommendations(...args);
            const candidates = response.candidates.filter(
              (c) => c.id === target,
            );
            return {
              ...response,
              candidates,
              notice: candidates.length
                ? response.notice
                : "This selected product is not eligible for these inputs. Change the request or select another product.",
            };
          },
        }
      : base;
    setScreen("results");
    controller.start(
      {
        room: dimensions,
        photo: room.photo,
        request: next,
        inputVersion: version.current,
      },
      { service, mode: base.mode },
    );
  };
  useEffect(() => {
    if (
      !runRoom.current ||
      !["ready", "error"].includes(preview.phase) ||
      preview.activeOptionId !== null ||
      preview.candidates.some((c) =>
        ["waiting", "generating"].includes(preview.results[c.id]?.status),
      )
    )
      return;
    const signature = `${preview.runId}:${Object.values(preview.results)
      .map((r) => `${r.requestId}:${r.status}`)
      .join("|")}`;
    if (savedSignatures.current.has(signature)) return;
    savedSignatures.current.add(signature);
    const owner = copy(runRoom.current);
    retainPreview(preview)
      .then(async (saved) => {
        const current = dataRef.current;
        if (!current.rooms.some((r) => r.id === owner.id)) return;
        const products = mergeProducts(
          owner.products,
          productsFromPreview(saved),
        );
        const snapshot = { ...owner, products, latestPreview: saved };
        await commit({
          ...current,
          rooms: current.rooms.map((r) =>
            r.id === owner.id
              ? {
                  ...r,
                  products: mergeProducts(r.products, products),
                  latestPreview: saved,
                }
              : r,
          ),
          attempts: current.attempts.map((a) =>
            a.id === owner.attemptId
              ? {
                  ...snapshotAttempt(snapshot, "Furniture preview", saved),
                  id: a.id,
                }
              : a,
          ),
        });
      })
      .catch((e) => {
        savedSignatures.current.delete(signature);
        setStorageError(
          `Could not retain this preview: ${e.message}. The request is in history; furnished images were not saved.`,
        );
      });
  }, [preview]);
  const checkHealth = async () => {
    setHealth({ status: "checking" });
    try {
      setHealth({ ...(await liveService.checkHealth()), status: "ok" });
    } catch (e) {
      setHealth({ status: "error", message: e.message });
    }
  };
  const photoProps = (state) =>
    state?.photo
      ? { photoId: state.photo.photoId, source: photoImageSource(state.photo) }
      : undefined;
  const changeProfile = async (profile, label) => {
    const updated = { ...room, profile, name: profile.name };
    const next = {
      ...dataRef.current,
      rooms: dataRef.current.rooms.map((r) => (r.id === room.id ? updated : r)),
      attempts: [snapshotAttempt(updated, label), ...dataRef.current.attempts],
    };
    await commit(next);
  };
  const recommendations = (compact) => (
    <FurnitureForYou
      key={room?.id ?? "none"}
      compact={compact}
      room={room}
      connection={connection}
      onPreferences={preferences}
      onSave={saveProduct}
      onTry={goVisualize}
      onSearch={search}
    />
  );
  const showComparison = (state = room.latestPreview) => {
    const additions = state ? productsFromPreview(state) : [];
    if (additions.length)
      updateRoom(room.id, {
        products: mergeProducts(room.products, additions),
      });
    const ids =
      additions.length >= 2
        ? additions.slice(0, 2).map((p) => p.id)
        : room.products.slice(0, 2).map((p) => p.id);
    setSelected(ids);
    setScreen(ids.length === 2 ? "compare" : "workspace");
  };
  const render = () => {
    if (!data)
      return (
        <Screen>
          <Header />
          <Text style={ui.title}>Your rooms</Text>
          {loadError ? (
            <>
              <Notice tone="warn">{loadError}</Notice>
              <Button title="Retry loading rooms" onPress={load} />
            </>
          ) : (
            <Text>Loading saved rooms…</Text>
          )}
        </Screen>
      );
    if (screen === "details")
      return (
        <RoomDetailsScreen
          key={draft.id}
          room={draft}
          onBack={() => setScreen("home")}
          onSave={async (next) => {
            const exists = dataRef.current.rooms.some((r) => r.id === next.id);
            await commit({
              ...dataRef.current,
              rooms: exists
                ? dataRef.current.rooms.map((r) =>
                    r.id === next.id ? next : r,
                  )
                : [...dataRef.current.rooms, next],
            });
            setActiveId(next.id);
            setScreen(exists ? "workspace" : "photo");
          }}
        />
      );
    if (screen === "home")
      return (
        <HomeScreen
          rooms={data.rooms}
          onOpenPlanner={(id) => openRoom(id)}
          onEditRoom={(id) => {
            setDraft(data.rooms.find((r) => r.id === id));
            setScreen("details");
          }}
          onDeleteRoom={(id) =>
            notifyUser(
              "Delete this room?",
              "Saved attempts stay in Drafts until you delete them separately.",
              [
                { text: "Cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    invalidate();
                    commit({
                      ...dataRef.current,
                      rooms: dataRef.current.rooms.filter((r) => r.id !== id),
                    });
                  },
                },
              ],
            )
          }
          onNavigate={navigate}
          recommendations={
            <View>
              {data.rooms.length > 1 ? (
                <View style={s.row}>
                  {data.rooms.map((r) => (
                    <Chip
                      key={r.id}
                      title={r.name}
                      selected={room?.id === r.id}
                      onPress={() => setActiveId(r.id)}
                    />
                  ))}
                </View>
              ) : null}
              {recommendations(true)}
            </View>
          }
        />
      );
    if (screen === "history")
      return (
        <HistoryScreen
          rooms={data.rooms}
          attempts={data.attempts}
          onBack={() => setScreen("home")}
          onOpenRoom={(id) => openRoom(id, "workspace")}
          onOpenAttempt={(attempt) => {
            invalidate();
            setHistoryItem(attempt);
            setScreen("attempt");
          }}
          onDeleteAttempt={(id) =>
            notifyUser(
              "Delete saved attempt?",
              "This removes the snapshot from history.",
              [
                { text: "Cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    commit({
                      ...dataRef.current,
                      attempts: dataRef.current.attempts.filter(
                        (a) => a.id !== id,
                      ),
                    }),
                },
              ],
            )
          }
        />
      );
    if (screen === "attempt" && historyItem)
      return (
        <Screen>
          <Header onBack={() => setScreen("history")} label="SAVED ATTEMPT" />
          <Text style={ui.title}>{historyItem.room.name}</Text>
          <Text style={ui.body}>
            {historyItem.name} ·{" "}
            {new Date(historyItem.createdAt).toLocaleString()}
          </Text>
          <Button
            title="Restore as a separate room"
            onPress={async () => {
              const id = newId(),
                restored = {
                  ...copy(historyItem.room),
                  id,
                  name: `${historyItem.room.name} · restored`,
                  profile: { ...copy(historyItem.room.profile), id },
                };
              await commit({
                ...dataRef.current,
                rooms: [...dataRef.current.rooms, restored],
              });
              openRoom(id, "workspace");
              setSelected(restored.comparisonIds ?? []);
            }}
          />
          <Text style={s.small}>
            The original room is kept. Restoring lets you inspect saved
            placements, reasons and comparisons.
          </Text>
          {historyItem.room.latestPreview ? (
            <Button
              secondary
              title="View saved original & furnished images"
              onPress={() => setScreen("attempt-images")}
            />
          ) : null}
        </Screen>
      );
    if (screen === "attempt-images" && historyItem?.room.latestPreview)
      return (
        <ResultsScreen
          state={historyItem.room.latestPreview}
          readOnly
          onRetry={() => {}}
          onRunAgain={() => {}}
          onEditRequest={() => setScreen("attempt")}
          onRoom={() => setScreen("attempt")}
        />
      );
    if (screen === "explore")
      return (
        <Screen>
          <Header onBack={() => setScreen("home")} label="EXPLORE" />
          {data.rooms.length > 1 ? (
            <View style={s.row}>
              {data.rooms.map((r) => (
                <Chip
                  key={r.id}
                  title={r.name}
                  selected={room?.id === r.id}
                  onPress={() => setActiveId(r.id)}
                />
              ))}
            </View>
          ) : null}
          {recommendations(false)}
        </Screen>
      );
    if (screen === "search")
      return (
        <FurnitureDiscovery
          connection={connection}
          onConnectionChange={(next) => {
            invalidate();
            setHealth({ status: "idle" });
            setConnection({ ...next, origin: normalizeApiOrigin(next.origin) });
          }}
          onBack={() => setScreen(searchReturn)}
          onSave={saveProduct}
          savedIds={room?.products.map((p) => p.id) ?? []}
        />
      );
    if (!room)
      return (
        <Screen>
          <Header onBack={() => setScreen("home")} />
          <Notice>Create a room to start designing.</Notice>
          <Button title="Create a room" onPress={createRoom} />
        </Screen>
      );
    if (screen === "photo")
      return (
        <PhotoScreen
          room={roomDimensions(room)}
          photo={room.photo}
          focus={room.focus}
          onFocusChange={(focus) => preferences({ focus })}
          onBack={() => setScreen("home")}
          onSkip={() => setScreen("workspace")}
          onPhotoChange={async (photo) => {
            invalidate();
            try {
              const saved = await retainPhoto(photo);
              await updateRoom(room.id, { photo: saved, latestPreview: null });
            } catch (e) {
              setStorageError(e.message);
            }
          }}
          onUseSample={applySample}
          onContinue={() => setScreen("workspace")}
        />
      );
    if (screen === "measurements")
      return (
        <HomeProfileEditor
          key={room.id}
          profile={room.profile}
          onCancel={() => setScreen("workspace")}
          onSave={async (profile) => {
            invalidate();
            await changeProfile(profile, "Measurements & preferences");
            setScreen("workspace");
          }}
        />
      );
    if (screen === "dimensions")
      return (
        <DimensionsScreen
          room={roomDimensions(room)}
          onBack={() => setScreen("workspace")}
          onContinue={async (d) => {
            invalidate();
            await updateRoom(room.id, {
              profile: {
                ...room.profile,
                room: {
                  widthCm: { value: d.widthCm, source: "measured" },
                  depthCm: { value: d.lengthCm, source: "measured" },
                  ...(d.heightCm
                    ? { heightCm: { value: d.heightCm, source: "measured" } }
                    : {}),
                },
              },
            });
            setScreen(dimensionNext);
          }}
        />
      );
    if (screen === "request")
      return (
        <RequestScreen
          key={`${room.id}-${wantedProduct?.id ?? "all"}`}
          room={roomDimensions(room)}
          photo={room.photo}
          request={
            room.photo?.source === "sample"
              ? SAMPLE_FURNITURE_REQUEST
              : wantedProduct
                ? {
                    category: wantedProduct.category,
                    description: [room.mood, room.color]
                      .filter(Boolean)
                      .join(" "),
                  }
                : (room.request ?? {
                    category: "sofa",
                    description: [room.mood, room.color]
                      .filter(Boolean)
                      .join(" "),
                  })
          }
          live={{
            origin: connection.origin,
            token: connection.token,
            onTokenChange: (token) => setConnection({ ...connection, token }),
            health,
            onCheckHealth: checkHealth,
          }}
          onBack={() => setScreen("workspace")}
          onSubmit={runPreview}
          onRestoreSample={applySample}
        />
      );
    if (screen === "results")
      return (
        <ResultsScreen
          state={preview}
          onRetry={(id) => controller.retry(id)}
          onRunAgain={() => runPreview(room.request)}
          onEditRequest={() => {
            invalidate();
            setScreen("request");
          }}
          onStartAgain={() => {
            invalidate();
            setScreen("workspace");
          }}
          onRoom={() => {
            invalidate();
            setScreen("workspace");
          }}
          onUseSample={applySample}
          onRestoreSample={applySample}
          onCompare={() => showComparison(preview)}
        />
      );
    if (screen === "evaluate" && product)
      return (
        <ProductEvaluationScreen
          product={product}
          home={room.profile}
          onBack={() => setScreen(returnTo)}
          onEditPlacement={() => {
            setReturnTo("workspace");
            setScreen("placement");
          }}
        />
      );
    if (screen === "placement" && product)
      return (
        <PlacementEditor
          product={product}
          home={room.profile}
          onBack={() => setScreen(returnTo)}
          onSave={async (profile) => {
            await changeProfile(profile, "Furniture placement");
            setScreen(returnTo);
          }}
        />
      );
    if (
      screen === "compare" &&
      selected.length === 2 &&
      selected.every((id) => normalized.some((p) => p.id === id))
    )
      return (
        <ComparisonScreen
          left={normalized.find((p) => p.id === selected[0])}
          right={normalized.find((p) => p.id === selected[1])}
          home={room.profile}
          roomPhoto={photoProps({ photo: room.photo })}
          previewImages={previewsFor(room.latestPreview)}
          onBack={() => setScreen("workspace")}
          onEvaluate={(id) => {
            setProductId(id);
            setReturnTo("compare");
            setScreen("evaluate");
          }}
          onEditPlacement={(id) => {
            setProductId(id);
            setReturnTo("compare");
            setScreen("placement");
          }}
          onSaveComparison={() =>
            addAttempt(
              room,
              `Comparison: ${selected.map((id) => room.products.find((p) => p.id === id)?.name).join(" / ")}`,
            )
          }
        />
      );
    return (
      <RoomWorkspace
        room={room}
        connection={connection}
        onBack={() => setScreen("home")}
        onPhoto={() => setScreen("photo")}
        onDetails={() => {
          setDraft(room);
          setScreen("details");
        }}
        onMeasurements={() => setScreen("measurements")}
        onVisualize={() => goVisualize()}
        onSearch={search}
        onPreferences={preferences}
        onSaveProduct={saveProduct}
        onTry={goVisualize}
        selected={selected}
        onSelect={choose}
        onCompare={() => setScreen("compare")}
        onEvaluate={(id) => {
          setProductId(id);
          setReturnTo("workspace");
          setScreen("evaluate");
        }}
        onPlacement={(id) => {
          setProductId(id);
          setReturnTo("workspace");
          setScreen("placement");
        }}
        onSaveAttempt={async () => {
          try {
            await addAttempt(room, "Saved arrangement");
            notifyUser("Saved", "This arrangement is in Drafts & history.");
          } catch (e) {
            notifyUser("Not saved", e.message);
          }
        }}
        onHistory={() => setScreen("history")}
        onRemoveProduct={(id) => {
          setSelected(selected.filter((v) => v !== id));
          updateRoom(room.id, {
            products: room.products.filter((p) => p.id !== id),
          });
        }}
      />
    );
  };
  return (
    <View style={{ flex: 1 }}>
      {storageError ? (
        <View style={{ padding: 12, backgroundColor: "#F9E8DC" }}>
          <Text accessibilityLiveRegion="assertive">
            Changes are not saved: {storageError}
          </Text>
          <Button
            small
            title="Retry saving"
            onPress={() => commit(dataRef.current)}
          />
        </View>
      ) : null}
      {render()}
    </View>
  );
}
