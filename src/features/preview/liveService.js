// Live adapter for 윤선's backend (server/docs/api-handoff.md).
// - EXPO_PUBLIC_API_URL is the backend origin; the demo-session token is entered at runtime.
// - The OpenAI key never reaches the app.
// - Recommendations send dimensions + request only; previews upload JPEG bytes as multipart.
// No automatic retries: every call is one attempt.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DEFAULT_TIMEOUTS = { health: 10_000, recommendations: 20_000, preview: 180_000 };

const FALLBACK_ERRORS = {
  400: ['INVALID_INPUT', 'The server could not use this request. Check your inputs.', false],
  401: ['UNAUTHORIZED', 'Enter the current restricted demo-session token.', false],
  409: ['DUPLICATE_REQUEST', 'This attempt was already used. Retry to start a new attempt.', true],
  413: ['UPLOAD_TOO_LARGE', 'The photo is too large. Choose a smaller photo.', false],
  429: ['BUSY', 'The preview server is busy. Try this option again shortly.', true],
  502: ['PROVIDER_FAILURE', 'The image service could not create this option.', true],
  503: ['LIVE_UNAVAILABLE', 'Live preview is unavailable right now. You can try the sample room instead.', false],
  504: ['PROVIDER_TIMEOUT', 'The preview took too long. You can retry this option.', true],
};

export function apiError(code, message, retryable) {
  return Object.assign(new Error(message), { code, retryable });
}

export function normalizeApiOrigin(raw) {
  const value = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
  return /^https?:\/\/[^\s/]+/i.test(value) ? value : '';
}

/**
 * @param {{ apiOrigin: string, getToken: () => string, fetchImpl?: typeof fetch,
 *   createFormData?: () => FormData, timeouts?: Partial<typeof DEFAULT_TIMEOUTS> }} options
 */
export function createLiveService({ apiOrigin, getToken, fetchImpl, createFormData = () => new FormData(), timeouts = {} }) {
  const origin = normalizeApiOrigin(apiOrigin);
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));

  async function call(path, init, timeoutMs, { outerSignal, timeoutError } = {}) {
    if (!origin) {
      throw apiError('LIVE_UNAVAILABLE', 'Live previews are not set up in this build (EXPO_PUBLIC_API_URL is missing). You can try the sample room instead.', false);
    }
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const onOuterAbort = () => controller.abort();
    if (outerSignal) {
      if (outerSignal.aborted) controller.abort();
      else outerSignal.addEventListener('abort', onOuterAbort);
    }
    try {
      let response;
      try {
        response = await doFetch(`${origin}${path}`, { ...init, signal: controller.signal });
      } catch (error) {
        if (outerSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
        if (timedOut) throw timeoutError ?? apiError('NETWORK_ERROR', 'The RoomReady server did not respond in time. Check the connection and try again.', true);
        throw apiError('NETWORK_ERROR', `Could not reach the RoomReady server at ${origin}. Check that the phone can open ${origin}/health.`, true);
      }
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      if (!response.ok) {
        const [code, message, retryable] = FALLBACK_ERRORS[response.status]
          ?? ['INTERNAL_ERROR', 'The server could not process this request. Please retry.', true];
        throw apiError(
          typeof body?.code === 'string' ? body.code : code,
          typeof body?.message === 'string' ? body.message : message,
          typeof body?.retryable === 'boolean' ? body.retryable : retryable,
        );
      }
      return body;
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener?.('abort', onOuterAbort);
    }
  }

  function authHeader() {
    const token = (getToken?.() ?? '').trim();
    if (!token) throw apiError('UNAUTHORIZED', 'Enter the restricted demo-session token from the team before requesting live previews.', false);
    return { Authorization: `Bearer ${token}` };
  }

  return {
    mode: 'live',
    origin,

    async checkHealth() {
      const body = await call('/health', { method: 'GET' }, limits.health);
      return { status: body?.status, liveConfigured: body?.liveConfigured === true };
    },

    async getRecommendations(room, request) {
      const headers = { ...authHeader(), 'Content-Type': 'application/json' };
      const body = await call('/recommendations', {
        method: 'POST', headers, body: JSON.stringify({ room: roomPayload(room), request: requestPayload(request) }),
      }, limits.recommendations);
      if (!Array.isArray(body?.candidates)) throw apiError('INTERNAL_ERROR', 'The server returned an unexpected recommendation response.', true);
      return { candidates: body.candidates, notice: typeof body.notice === 'string' ? body.notice : '' };
    },

    async generatePreview({ photo, room, request, candidate, requestId, inputVersion, signal }) {
      if (photo?.source !== 'user') throw apiError('INVALID_INPUT', 'Live previews need your own room photo.', false);
      if (!photo.uploadReady) {
        throw apiError('INVALID_INPUT', photo.prepError || 'This photo could not be prepared as a JPEG under 5 MB. Choose another photo.', false);
      }
      const headers = authHeader(); // Content-Type is left to fetch so it can set the multipart boundary.
      const form = createFormData();
      form.append('metadata', JSON.stringify({
        requestId, inputVersion, room: roomPayload(room), request: requestPayload(request), optionId: candidate.id,
      }));
      // React Native's FormData uploads the bytes behind this local file URI.
      form.append('photo', { uri: photo.uri, type: 'image/jpeg', name: 'room.jpg' });
      const body = await call('/preview', { method: 'POST', headers, body: form }, limits.preview, {
        outerSignal: signal,
        timeoutError: apiError('PROVIDER_TIMEOUT', 'The preview took too long. You can retry this option.', true),
      });
      if (typeof body?.imageBase64 !== 'string' || !body.imageBase64 || !IMAGE_MIME_TYPES.includes(body.mimeType) || body.mode !== 'live') {
        throw apiError('INVALID_OUTPUT', 'The server returned an unreadable preview. Retry this option.', true);
      }
      return {
        requestId: body.requestId, inputVersion: body.inputVersion, optionId: body.optionId, mode: 'live',
        mimeType: body.mimeType, imageSource: { uri: `data:${body.mimeType};base64,${body.imageBase64}` },
      };
    },
  };
}

// Send exactly the fields the strict server schema accepts.
function roomPayload(room) {
  const payload = { widthCm: room.widthCm, lengthCm: room.lengthCm };
  if (room.heightCm !== undefined && room.heightCm !== null) payload.heightCm = room.heightCm;
  return payload;
}
function requestPayload(request) {
  return { category: request.category, description: request.description ?? '' };
}
