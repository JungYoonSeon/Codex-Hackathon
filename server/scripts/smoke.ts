/** Opt-in paid smoke test. Run after adding credentials. Produces reviewable output + timings. */
import { createApp } from '../src/app.ts';
import { createOpenAIEditor } from '../src/provider.ts';
import { SAMPLE_REQUEST } from '../../shared/fixtures.ts';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { PreviewResponse, RecommendationsResponse } from '../../shared/contracts.ts';
const key = process.env.OPENAI_API_KEY?.trim(); const model = process.env.IMAGE_MODEL?.trim();
if (!key || !model) {
  console.error('Live check NOT RUN: add OPENAI_API_KEY and IMAGE_MODEL to server/.env. No paid request was made.');
  process.exit(2);
}
const token = randomBytes(32).toString('hex');
const server = createApp({ sessionToken: token, editor: createOpenAIEditor(key, model) }).listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const headers = { Authorization: `Bearer ${token}` };
const both = process.argv.includes('--two');
const directory = new URL(`../artifacts/live-${Date.now()}/`, import.meta.url);
try {
  const recommendations = await fetch(`${origin}/recommendations`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(SAMPLE_REQUEST) });
  if (!recommendations.ok) throw new Error('Recommendations failed.');
  const data = await recommendations.json() as RecommendationsResponse;
  const room = await readFile(new URL('../assets/sample/room.jpg', import.meta.url));
  const timings: { optionId: string; elapsedMs: number }[] = [];
  await mkdir(directory, { recursive: true });
  for (const candidate of data.candidates.slice(0, both ? 2 : 1)) {
    const requestId = randomUUID(); const form = new FormData();
    form.set('metadata', JSON.stringify({ ...SAMPLE_REQUEST, requestId, inputVersion: 1, optionId: candidate.id }));
    form.set('photo', new Blob([new Uint8Array(room)], { type: 'image/jpeg' }), 'room.jpg');
    const start = performance.now();
    const response = await fetch(`${origin}/preview`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(180_000) });
    if (!response.ok) { const error = await response.json(); throw new Error(`Preview failed (${response.status}): ${error.code}: ${error.message}`); }
    const result = await response.json() as PreviewResponse;
    if (result.requestId !== requestId || result.optionId !== candidate.id || result.inputVersion !== 1 || result.mode !== 'live') throw new Error('Response identity mismatch.');
    const extension = result.mimeType === 'image/png' ? 'png' : result.mimeType === 'image/webp' ? 'webp' : 'jpg';
    await writeFile(new URL(`${candidate.id}.${extension}`, directory), Buffer.from(result.imageBase64, 'base64'));
    timings.push({ optionId: candidate.id, elapsedMs: Math.round(performance.now() - start) });
    console.log(`Live edit completed: ${candidate.id}, ${timings.at(-1)!.elapsedMs} ms. Review image before accepting the demo.`);
  }
  await writeFile(new URL('report.json', directory), JSON.stringify({ mode: 'live', input: SAMPLE_REQUEST,
    sampleKind: 'original illustration, not a personal photo', timings, totalMs: timings.reduce((n,t)=>n+t.elapsedMs,0),
    roomPreservationReview: 'PENDING HUMAN VISUAL REVIEW', deviceQA: 'NOT RUN' }, null, 2));
  console.log(`Saved outputs and report in ${directory.pathname}`);
} catch (error) { console.error(error instanceof Error ? error.message : 'Smoke test failed.'); process.exitCode = 1; }
finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
