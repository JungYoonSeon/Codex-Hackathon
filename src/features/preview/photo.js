// Photo selection and preparation for live upload.
// Output: an upright JPEG, long edge at most 1280 px, rejected client-side above 5 MB
// (the server re-decodes and normalizes again).
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { MAX_UPLOAD_BYTES } from './liveService.js';

const LONG_EDGE_PX = 1280;
const JPEG_QUALITY = 0.85;

const newPhotoId = () => `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Opens the camera or library. Never throws.
 * @returns {Promise<{status:'picked', asset:object} | {status:'canceled'} | {status:'denied'|'error', message:string}>}
 */
export async function pickPhoto({ camera }) {
  try {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return { status: 'denied', message: permission.canAskAgain
          ? 'Camera access is needed to take a room photo. You can choose from your photos or try the sample room instead.'
          : 'Camera access is turned off for this app. Turn it on in iPhone Settings, or choose from your photos instead.' };
      }
    }
    // The iOS photo picker runs out of process, so library selection needs no up-front permission prompt.
    const options = { mediaTypes: ['images'], quality: 1, exif: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return { status: 'canceled' };
    const asset = result.assets?.[0];
    if (!asset?.uri) return { status: 'error', message: 'No photo was returned. Please try again.' };
    return { status: 'picked', asset };
  } catch {
    return { status: 'error', message: camera
      ? 'The camera could not be opened. Choose from your photos or try the sample room instead.'
      : 'Your photos could not be opened. Please try again, or try the sample room instead.' };
  }
}

/**
 * Converts a picked asset into the shared PhotoInput shape.
 * If conversion fails, the original stays usable as a preview but is marked not upload-ready.
 */
export async function preparePhoto(asset) {
  const photoId = newPhotoId();
  try {
    // Rendering first bakes in EXIF orientation and gives the upright pixel size.
    const upright = await ImageManipulator.manipulate(asset.uri).renderAsync();
    const longEdge = Math.max(upright.width, upright.height);
    let image = upright;
    if (longEdge > LONG_EDGE_PX) {
      const size = upright.width >= upright.height ? { width: LONG_EDGE_PX } : { height: LONG_EDGE_PX };
      image = await ImageManipulator.manipulate(upright).resize(size).renderAsync();
    }
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
    const sizeBytes = base64ByteLength(saved.base64);
    releaseQuietly(image);
    if (image !== upright) releaseQuietly(upright);
    const tooLarge = sizeBytes > MAX_UPLOAD_BYTES;
    return {
      photoId, uri: saved.uri, mimeType: 'image/jpeg', widthPx: saved.width, heightPx: saved.height, source: 'user',
      sizeBytes, uploadReady: !tooLarge,
      prepError: tooLarge ? 'This photo is still larger than 5 MB after resizing, so live previews cannot use it. Choose another photo.' : null,
    };
  } catch {
    return {
      photoId, uri: asset.uri, mimeType: asset.mimeType ?? 'unknown', widthPx: asset.width || 0, heightPx: asset.height || 0,
      source: 'user', sizeBytes: asset.fileSize ?? null, uploadReady: false,
      prepError: 'This photo could not be converted to JPEG, so live previews cannot use it. Choose another photo or try the sample room.',
    };
  }
}

function base64ByteLength(base64) {
  if (typeof base64 !== 'string') return Number.POSITIVE_INFINITY;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function releaseQuietly(ref) {
  try { ref?.release?.(); } catch { /* already released */ }
}
