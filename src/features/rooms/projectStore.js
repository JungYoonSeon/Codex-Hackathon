import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { newHomeProfile } from "../../../shared/home-profile";
import { SAMPLE_ROOM, SAMPLE_PHOTO } from "../preview/sampleScenario";

const KEY = "roomready-projects-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
export const newId = () =>
  `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export function makeRoom(
  name = "My room",
  type = "Living room",
  sample = false,
) {
  const id = newId();
  const profile = { ...newHomeProfile(), id, name };
  if (sample)
    profile.room = {
      widthCm: { value: SAMPLE_ROOM.widthCm, source: "demo" },
      depthCm: { value: SAMPLE_ROOM.lengthCm, source: "demo" },
      heightCm: { value: SAMPLE_ROOM.heightCm, source: "demo" },
    };
  return {
    id,
    name,
    type,
    mood: "",
    color: "",
    focus: "whole",
    profile,
    photo: sample ? SAMPLE_PHOTO : null,
    products: [],
    request: null,
    latestPreview: null,
    updatedAt: new Date().toISOString(),
  };
}
export function roomDimensions(room) {
  const d = room?.profile.room;
  if (!d?.widthCm?.value || !d?.depthCm?.value) return null;
  return {
    widthCm: d.widthCm.value,
    lengthCm: d.depthCm.value,
    ...(d.heightCm?.value ? { heightCm: d.heightCm.value } : {}),
  };
}
function fsModule() {
  const fs = requireOptionalNativeModule("ExponentFileSystem");
  if (!fs?.documentDirectory || !fs.readAsStringAsync)
    throw new Error(
      "Local storage is unavailable in this build. Open the app in Expo Go or rebuild with Expo FileSystem.",
    );
  return fs;
}
async function webStore(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("data");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("data", mode);
      const req = action(tx.objectStore("data"));
      tx.oncomplete = () => resolve(req.result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
async function read() {
  if (Platform.OS === "web") return webStore("readonly", (s) => s.get(KEY));
  const fs = fsModule(),
    uri = `${fs.documentDirectory}${KEY}.json`;
  if (!(await fs.getInfoAsync(uri, {})).exists) return null;
  try {
    return JSON.parse(await fs.readAsStringAsync(uri, { encoding: "utf8" }));
  } catch (error) {
    const backup = `${uri}.backup`;
    if ((await fs.getInfoAsync(backup, {})).exists)
      return JSON.parse(
        await fs.readAsStringAsync(backup, { encoding: "utf8" }),
      );
    throw error;
  }
}
let queue = Promise.resolve();
export const projectStore = {
  async load() {
    await queue.catch(() => {});
    const data = await read();
    if (data === null)
      return {
        version: 1,
        rooms: [
          makeRoom("Home Office", "Home office", true),
          makeRoom("Bedroom", "Bedroom", true),
        ],
        attempts: [],
      };
    if (
      data.version !== 1 ||
      !Array.isArray(data.rooms) ||
      !Array.isArray(data.attempts)
    )
      throw new Error(
        "Saved room data could not be read. It has not been overwritten.",
      );
    return data;
  },
  save(data) {
    const snapshot = clone(data);
    const work = queue
      .catch(() => {})
      .then(async () => {
        if (Platform.OS === "web") {
          await webStore("readwrite", (s) => s.put(snapshot, KEY));
          return;
        }
        const fs = fsModule(),
          uri = `${fs.documentDirectory}${KEY}.json`,
          temp = `${uri}.tmp`;
        const text = JSON.stringify(snapshot);
        await fs.writeAsStringAsync(temp, text, { encoding: "utf8" });
        await fs.moveAsync({ from: temp, to: uri });
        // Keep deletion semantics: the backup reflects this same successful save.
        await fs.writeAsStringAsync(`${uri}.backup`, text, {
          encoding: "utf8",
        });
      });
    queue = work;
    return work;
  },
};
export async function retainPhoto(photo) {
  if (!photo || photo.source === "sample") return photo;
  if (Platform.OS === "web") {
    if (photo.uri.startsWith("data:")) return photo;
    const blob = await (await fetch(photo.uri)).blob();
    const uri = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { ...photo, uri };
  }
  const fs = fsModule();
  if (photo.uri.startsWith(fs.documentDirectory)) return photo;
  const uri = `${fs.documentDirectory}${newId()}.jpg`;
  await fs.copyAsync({ from: photo.uri, to: uri });
  return { ...photo, uri };
}
export async function retainPreview(state) {
  const copy = clone(state);
  copy.photo = await retainPhoto(copy.photo);
  if (Platform.OS !== "web") {
    const fs = fsModule();
    for (const result of Object.values(copy.results ?? {})) {
      const uri = result.imageSource?.uri;
      if (!uri?.startsWith("data:image/")) continue;
      const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(uri);
      if (!match) continue;
      const file = `${fs.documentDirectory}${newId()}.${match[1]}`;
      await fs.writeAsStringAsync(file, match[2], { encoding: "base64" });
      result.imageSource = { uri: file };
    }
  }
  return copy;
}
export function snapshotAttempt(room, label, preview = room.latestPreview) {
  return {
    id: newId(),
    roomId: room.id,
    name: label,
    createdAt: new Date().toISOString(),
    room: clone({ ...room, latestPreview: preview }),
  };
}
