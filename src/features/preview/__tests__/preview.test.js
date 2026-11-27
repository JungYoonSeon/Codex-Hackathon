// Run with: npm test   (Node's built-in test runner; no React Native needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPreviewController } from '../previewController.js';
import { createSavedExampleService } from '../savedExampleService.js';
import { createLiveService } from '../liveService.js';
import { SAMPLE_PHOTO_ID, SAMPLE_REQUEST } from '../../../../shared/fixtures.ts';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const sampleCandidates = readJson('../sampleRecommendations.json').candidates;

const room = { widthCm: 400, lengthCm: 300, heightCm: 260 };
const request = { category: 'sofa', description: 'compact beige' };
const userPhoto = { photoId: 'photo-1', uri: 'file:///room.jpg', mimeType: 'image/jpeg', widthPx: 1280, heightPx: 960, source: 'user', uploadReady: true };
const samplePhoto = { photoId: SAMPLE_PHOTO_ID, uri: 'bundled:sample', mimeType: 'image/jpeg', widthPx: 960, heightPx: 720, source: 'sample' };
const candidates = [
  { id: 'sofa-linen', name: 'A', category: 'sofa', widthCm: 160, depthCm: 85, tags: [], description: '', matchReason: '' },
  { id: 'sofa-sage', name: 'B', category: 'sofa', widthCm: 200, depthCm: 95, tags: [], description: '', matchReason: '' },
];

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const okResponse = (input) => ({
  requestId: input.requestId, inputVersion: input.inputVersion, optionId: input.candidate.id,
  mode: 'live', mimeType: 'image/jpeg', imageBase64: 'AAAA',
});
const tick = () => new Promise((r) => setImmediate(r));
let idCounter = 0;
const ids = () => (optionId) => `${optionId}-attempt-${++idCounter}`;

test('generates candidates sequentially, using the original photo for every option', async () => {
  const calls = [];
  const pending = [];
  const service = {
    getRecommendations: async () => ({ candidates, notice: 'n' }),
    generatePreview: (input) => { calls.push(input); const d = deferred(); pending.push({ input, d }); return d.promise; },
  };
  const c = createPreviewController({ createRequestId: ids() });
  const done = c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  await tick();
  assert.equal(calls.length, 1, 'B must not start before A finishes');
  assert.equal(c.getState().results['sofa-linen'].status, 'generating');
  assert.equal(c.getState().results['sofa-sage'].status, 'waiting');
  pending[0].d.resolve(okResponse(pending[0].input));
  await tick();
  assert.equal(c.getState().results['sofa-linen'].status, 'ready', 'A is visible before B finishes');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].photo, userPhoto, 'option B uses the original photo, not A\'s output');
  pending[1].d.resolve(okResponse(pending[1].input));
  await done;
  assert.equal(c.getState().results['sofa-sage'].status, 'ready');
  assert.notEqual(calls[0].requestId, calls[1].requestId);
});

test('a repeated start while busy is ignored synchronously', async () => {
  let recs = 0;
  const d = deferred();
  const service = { getRecommendations: () => { recs++; return d.promise; }, generatePreview: async (i) => okResponse(i) };
  const c = createPreviewController({ createRequestId: ids() });
  const first = c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  const second = await c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  assert.equal(second, false);
  assert.equal(recs, 1);
  d.resolve({ candidates: [] });
  await first;
});

test('responses arriving after an input change are discarded and requests are aborted', async () => {
  const pending = [];
  const service = {
    getRecommendations: async () => ({ candidates }),
    generatePreview: (input) => { const d = deferred(); pending.push({ input, d }); return d.promise; },
  };
  const c = createPreviewController({ createRequestId: ids() });
  const done = c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  await tick();
  c.invalidate(); // e.g. user replaced the photo
  assert.equal(pending[0].input.signal.aborted, true, 'client request is aborted');
  pending[0].d.resolve(okResponse(pending[0].input)); // late success from the old run
  await done;
  assert.equal(c.getState().phase, 'idle');
  assert.deepEqual(c.getState().results, {});
  assert.equal(pending.length, 1, 'option B is not generated for a stale run');
});

test('stale recommendations from an old run cannot overwrite a new run', async () => {
  const first = deferred();
  let n = 0;
  const service = {
    getRecommendations: () => (++n === 1 ? first.promise : Promise.resolve({ candidates: [candidates[1]] })),
    generatePreview: async (i) => okResponse(i),
  };
  const c = createPreviewController({ createRequestId: ids() });
  const old = c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  c.invalidate();
  await c.start({ room, request: { ...request, description: 'sage' }, photo: userPhoto, inputVersion: 2 }, { service, mode: 'live' });
  first.resolve({ candidates });
  await old;
  assert.equal(c.getState().inputVersion, 2);
  assert.deepEqual(c.getState().candidates.map((x) => x.id), ['sofa-sage']);
});

test('a response echoing the wrong identity is rejected', async () => {
  const service = {
    getRecommendations: async () => ({ candidates: [candidates[0]] }),
    generatePreview: async (i) => ({ ...okResponse(i), inputVersion: i.inputVersion - 1 }),
  };
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ room, request, photo: userPhoto, inputVersion: 5 }, { service, mode: 'live' });
  const result = c.getState().results['sofa-linen'];
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'INVALID_OUTPUT');
  assert.equal(result.imageSource, null);
});

test('partial failure keeps the successful option; explicit retry uses a new requestId', async () => {
  const calls = [];
  let failNext = true;
  const service = {
    getRecommendations: async () => ({ candidates }),
    async generatePreview(input) {
      calls.push(input);
      if (input.candidate.id === 'sofa-linen' && failNext) {
        failNext = false;
        throw Object.assign(new Error('timeout'), { code: 'PROVIDER_TIMEOUT', retryable: true });
      }
      return okResponse(input);
    },
  };
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  assert.equal(c.getState().results['sofa-linen'].status, 'failed');
  assert.equal(c.getState().results['sofa-sage'].status, 'ready', 'B still proceeds after A fails');
  assert.equal(calls.length, 2, 'no automatic retry');

  const sageBefore = c.getState().results['sofa-sage'];
  assert.equal(await c.retry('sofa-linen'), true);
  assert.equal(calls.length, 3);
  assert.notEqual(calls[2].requestId, calls[0].requestId, 'retry gets a fresh requestId');
  assert.equal(c.getState().results['sofa-linen'].status, 'ready');
  assert.equal(c.getState().results['sofa-sage'], sageBefore, 'successful sibling untouched');
  assert.equal(await c.retry('sofa-sage'), false, 'ready options cannot be retried');
});

test('non-retryable failures cannot be retried', async () => {
  const service = {
    getRecommendations: async () => ({ candidates: [candidates[0]] }),
    generatePreview: async () => { throw Object.assign(new Error('x'), { code: 'UPLOAD_TOO_LARGE', retryable: false }); },
  };
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  assert.equal(await c.retry('sofa-linen'), false);
});

test('zero candidates finish without generation', async () => {
  let generated = 0;
  const service = { getRecommendations: async () => ({ candidates: [], notice: 'No demo furniture matches.' }), generatePreview: async () => { generated++; } };
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ room, request, photo: userPhoto, inputVersion: 1 }, { service, mode: 'live' });
  assert.equal(c.getState().phase, 'ready');
  assert.equal(c.getState().notice, 'No demo furniture matches.');
  assert.equal(generated, 0);
});

// ---- Saved-example (fixture) restrictions ----

const imageSources = { 'sofa-linen': 101, 'sofa-sage': 102 }; // stand-ins for bundled require() ids
const saved = () => createSavedExampleService({ candidates: sampleCandidates, imageSources });

test('bundled candidate copy matches the backend sample response', () => {
  assert.deepEqual(readJson('../sampleRecommendations.json'), readJson('../../../../server/docs/sample-recommendations.json'));
});

test('saved examples render for the exact sample, paired with the right candidate', async () => {
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ ...SAMPLE_REQUEST, photo: samplePhoto, inputVersion: 1 }, { service: saved(), mode: 'saved_demo' });
  const s = c.getState();
  assert.deepEqual(s.candidates.map((x) => x.id), ['sofa-linen', 'sofa-sage']);
  assert.equal(s.results['sofa-linen'].imageSource, 101);
  assert.equal(s.results['sofa-sage'].imageSource, 102);
  assert.equal(s.results['sofa-linen'].mode, 'saved_demo');
});

test('saved examples are refused for a user photo, even with sample inputs', async () => {
  const c = createPreviewController({ createRequestId: ids() });
  await c.start({ ...SAMPLE_REQUEST, photo: userPhoto, inputVersion: 1 }, { service: saved(), mode: 'saved_demo' });
  for (const id of ['sofa-linen', 'sofa-sage']) {
    assert.equal(c.getState().results[id].status, 'failed');
    assert.equal(c.getState().results[id].imageSource, null);
  }
});

test('saved examples are refused when the sample dimensions or request are edited', async () => {
  for (const [r, q] of [[{ ...room, widthCm: 401 }, request], [room, { ...request, description: 'sage' }], [{ widthCm: 400, lengthCm: 300 }, request]]) {
    const c = createPreviewController({ createRequestId: ids() });
    await c.start({ room: r, request: q, photo: samplePhoto, inputVersion: 1 }, { service: saved(), mode: 'saved_demo' });
    assert.equal(c.getState().phase, 'error');
    assert.equal(c.getState().error.code, 'LIVE_UNAVAILABLE');
    assert.deepEqual(c.getState().candidates, []);
  }
});

test('a missing saved illustration hides that option instead of duplicating another', async () => {
  const service = createSavedExampleService({ candidates: sampleCandidates, imageSources: { 'sofa-linen': 101 } });
  const response = await service.getRecommendations(SAMPLE_REQUEST.room, SAMPLE_REQUEST.request);
  assert.deepEqual(response.candidates.map((x) => x.id), ['sofa-linen']);
});

// ---- Live adapter (controlled fetch responses; no network) ----

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  return { impl, calls };
}
const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
class FakeForm { constructor() { this.parts = []; } append(name, value) { this.parts.push([name, value]); } }

test('live preview uploads multipart metadata + photo with bearer token and no manual Content-Type', async () => {
  const { impl, calls } = fakeFetch((_url, init) => {
    const meta = JSON.parse(init.body.parts[0][1]);
    return jsonResponse(200, { ...meta, imageBase64: 'QUJD', mimeType: 'image/png', mode: 'live' });
  });
  const live = createLiveService({ apiOrigin: 'https://demo.example/', getToken: () => 'tok', fetchImpl: impl, createFormData: () => new FakeForm() });
  const out = await live.generatePreview({ photo: userPhoto, room: { widthCm: 400, lengthCm: 300 }, request, candidate: candidates[0], requestId: 'r-1', inputVersion: 3 });
  const { url, init } = calls[0];
  assert.equal(url, 'https://demo.example/preview');
  assert.deepEqual(init.headers, { Authorization: 'Bearer tok' });
  assert.deepEqual(init.body.parts.map(([n]) => n), ['metadata', 'photo']);
  assert.deepEqual(JSON.parse(init.body.parts[0][1]), { requestId: 'r-1', inputVersion: 3, room: { widthCm: 400, lengthCm: 300 }, request, optionId: 'sofa-linen' });
  assert.deepEqual(init.body.parts[1][1], { uri: 'file:///room.jpg', type: 'image/jpeg', name: 'room.jpg' });
  assert.deepEqual(out.imageSource, { uri: 'data:image/png;base64,QUJD' });
});

test('live recommendations send only dimensions and request as JSON', async () => {
  const { impl, calls } = fakeFetch(() => jsonResponse(200, { candidates, notice: 'n' }));
  const live = createLiveService({ apiOrigin: 'https://demo.example', getToken: () => 'tok', fetchImpl: impl });
  await live.getRecommendations(room, request);
  assert.deepEqual(JSON.parse(calls[0].init.body), { room, request });
});

test('live server errors keep their documented code and retryability', async () => {
  const cases = [
    [401, { code: 'UNAUTHORIZED', message: 'Enter token', retryable: false }, 'UNAUTHORIZED', false],
    [429, { code: 'BUSY', message: 'busy', retryable: true }, 'BUSY', true],
    [503, { code: 'LIVE_UNAVAILABLE', message: 'off', retryable: false }, 'LIVE_UNAVAILABLE', false],
    [504, null, 'PROVIDER_TIMEOUT', true],
    [500, null, 'INTERNAL_ERROR', true],
  ];
  for (const [status, body, code, retryable] of cases) {
    const live = createLiveService({ apiOrigin: 'https://demo.example', getToken: () => 'tok', fetchImpl: async () => jsonResponse(status, body), createFormData: () => new FakeForm() });
    await assert.rejects(live.generatePreview({ photo: userPhoto, room, request, candidate: candidates[0], requestId: 'r', inputVersion: 1 }),
      (e) => e.code === code && e.retryable === retryable);
  }
});

test('live mode is explicitly unavailable without an origin or token, and never sends the request', async () => {
  const { impl, calls } = fakeFetch(() => jsonResponse(200, {}));
  await assert.rejects(createLiveService({ apiOrigin: '', getToken: () => 'tok', fetchImpl: impl }).getRecommendations(room, request), { code: 'LIVE_UNAVAILABLE' });
  await assert.rejects(createLiveService({ apiOrigin: 'https://demo.example', getToken: () => '', fetchImpl: impl }).getRecommendations(room, request), { code: 'UNAUTHORIZED' });
  assert.equal(calls.length, 0);
});

test('live preview refuses sample photos and photos that failed preparation', async () => {
  const live = createLiveService({ apiOrigin: 'https://demo.example', getToken: () => 'tok', fetchImpl: async () => jsonResponse(200, {}) });
  const base = { room, request, candidate: candidates[0], requestId: 'r', inputVersion: 1 };
  await assert.rejects(live.generatePreview({ ...base, photo: samplePhoto }), { code: 'INVALID_INPUT' });
  await assert.rejects(live.generatePreview({ ...base, photo: { ...userPhoto, uploadReady: false, prepError: 'too big' } }), { message: 'too big' });
});

test('live preview rejects malformed image output', async () => {
  const live = createLiveService({ apiOrigin: 'https://demo.example', getToken: () => 'tok', createFormData: () => new FakeForm(),
    fetchImpl: async () => jsonResponse(200, { requestId: 'r', inputVersion: 1, optionId: 'sofa-linen', imageBase64: '', mimeType: 'image/jpeg', mode: 'live' }) });
  await assert.rejects(live.generatePreview({ photo: userPhoto, room, request, candidate: candidates[0], requestId: 'r', inputVersion: 1 }), { code: 'INVALID_OUTPUT' });
});

test('aborting a live preview rejects as AbortError, not as a user-facing failure', async () => {
  const outer = new AbortController();
  const live = createLiveService({ apiOrigin: 'https://demo.example', getToken: () => 'tok', createFormData: () => new FakeForm(),
    fetchImpl: (_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  const p = live.generatePreview({ photo: userPhoto, room, request, candidate: candidates[0], requestId: 'r', inputVersion: 1, signal: outer.signal });
  outer.abort();
  await assert.rejects(p, { name: 'AbortError' });
});
