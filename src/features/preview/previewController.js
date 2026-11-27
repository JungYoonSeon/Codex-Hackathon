// Single owner of recommendation + preview state for one results screen.
// Plain JavaScript with no React Native imports so it can be unit-tested in Node.
//
// Rules (from server/docs/api-handoff.md):
// - inputs are snapshotted when a run starts; any input change calls invalidate()
// - candidates are generated sequentially; one failure does not stop the next option
// - every attempt has a fresh requestId; responses must echo requestId/inputVersion/optionId
// - stale or mismatched responses never update the screen
// - no automatic retries: retry(optionId) is always an explicit user action

export const IDLE_STATE = Object.freeze({
  phase: 'idle', // idle | matching | ready | error
  runId: 0,
  mode: null, // 'live' | 'saved_demo'
  inputVersion: null,
  photo: null,
  room: null,
  request: null,
  candidates: [],
  notice: '',
  results: {},
  activeOptionId: null,
  error: null,
});

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function defaultRequestId(optionId) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${optionId}-${Date.now().toString(36)}-${random}`.slice(0, 100);
}

export function normalizeError(error) {
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    return { code: error.code, message: error.message, retryable: error.retryable === true };
  }
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong while creating this option. You can try again.', retryable: true };
}

function imageSourceFrom(response) {
  if (response.imageSource) return response.imageSource;
  if (typeof response.imageBase64 === 'string' && response.imageBase64 && IMAGE_MIME_TYPES.includes(response.mimeType)) {
    return { uri: `data:${response.mimeType};base64,${response.imageBase64}` };
  }
  return null;
}

export function isBusy(state) {
  return state.phase === 'matching' || state.activeOptionId !== null;
}

export function createPreviewController({ createRequestId = defaultRequestId } = {}) {
  let state = IDLE_STATE;
  let run = null;
  let runCounter = 0;
  const listeners = new Set();

  const emit = () => listeners.forEach((listener) => listener(state));
  const set = (patch) => { state = { ...state, ...patch }; emit(); };
  const isCurrent = (r) => run === r && !r.abort.signal.aborted;

  async function generate(r, candidate) {
    const requestId = createRequestId(candidate.id);
    const { inputVersion } = r.snapshot;
    set({
      activeOptionId: candidate.id,
      results: { ...state.results, [candidate.id]: {
        optionId: candidate.id, requestId, inputVersion, mode: r.mode, status: 'generating', imageSource: null, error: null,
      } },
    });

    let response;
    let error = null;
    try {
      response = await r.service.generatePreview({
        photo: r.snapshot.photo, room: r.snapshot.room, request: r.snapshot.request,
        candidate, requestId, inputVersion, signal: r.abort.signal,
      });
    } catch (caught) {
      error = caught;
    }

    // Stale run (input changed, reset, screen left) or superseded attempt: drop silently.
    if (!isCurrent(r) || state.results[candidate.id]?.requestId !== requestId) return;

    let imageSource = null;
    if (!error) {
      const matches = response && response.requestId === requestId && response.inputVersion === inputVersion
        && response.optionId === candidate.id && response.mode === r.mode;
      imageSource = matches ? imageSourceFrom(response) : null;
      if (!matches) {
        error = { code: 'INVALID_OUTPUT', message: 'The server answered for a different request, so the preview was discarded. Retry this option.', retryable: true };
      } else if (!imageSource) {
        error = { code: 'INVALID_OUTPUT', message: 'The preview image was missing or unreadable. Retry this option.', retryable: true };
      }
    }

    set({
      activeOptionId: null,
      results: { ...state.results, [candidate.id]: {
        ...state.results[candidate.id],
        status: error ? 'failed' : 'ready',
        imageSource: error ? null : imageSource,
        error: error ? normalizeError(error) : null,
      } },
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Starts a run. Returns false (synchronously decided) if a run is already busy. */
    async start(snapshot, { service, mode }) {
      if (isBusy(state)) return false;
      if (run) run.abort.abort();
      const r = {
        id: ++runCounter, service, mode, abort: new AbortController(),
        snapshot: {
          photo: snapshot.photo, inputVersion: snapshot.inputVersion,
          room: { ...snapshot.room }, request: { ...snapshot.request },
        },
      };
      run = r;
      set({
        ...IDLE_STATE, phase: 'matching', runId: r.id, mode, inputVersion: r.snapshot.inputVersion,
        photo: r.snapshot.photo, room: r.snapshot.room, request: r.snapshot.request,
      });

      let response;
      try {
        response = await service.getRecommendations(r.snapshot.room, r.snapshot.request);
      } catch (error) {
        if (isCurrent(r)) set({ phase: 'error', error: normalizeError(error) });
        return true;
      }
      if (!isCurrent(r)) return true;

      const candidates = Array.isArray(response?.candidates) ? response.candidates.slice(0, 2) : [];
      const results = {};
      for (const candidate of candidates) {
        results[candidate.id] = {
          optionId: candidate.id, requestId: null, inputVersion: r.snapshot.inputVersion, mode, status: 'waiting', imageSource: null, error: null,
        };
      }
      set({ phase: 'ready', candidates, notice: response?.notice ?? '', results });

      for (const candidate of candidates) {
        if (!isCurrent(r)) return true;
        await generate(r, candidate);
      }
      return true;
    },

    /** Explicit retry of one failed option with a new requestId. Successful options are kept. */
    async retry(optionId) {
      const r = run;
      const result = state.results[optionId];
      const candidate = state.candidates.find((c) => c.id === optionId);
      if (!r || !isCurrent(r) || isBusy(state) || !candidate || result?.status !== 'failed' || !result.error?.retryable) return false;
      await generate(r, candidate);
      return true;
    },

    /** Inputs changed, flow reset or screen left: abort client requests and forget results. */
    invalidate() {
      if (run) run.abort.abort();
      run = null;
      state = IDLE_STATE;
      emit();
    },
  };
}
