import type { Candidate, PreviewService, ApiError } from './contracts.ts';
import { SAMPLE_PHOTO_ID, SAMPLE_REQUEST } from './fixtures.ts';
/** Anna supplies loaded asset bytes; no filesystem or server imports reach mobile. */
export function createFixtureService(options: {
  candidates: Candidate[];
  images: Record<string, { imageBase64: string; mimeType: 'image/jpeg' }>;
}): PreviewService {
  const fail = (): never => { throw Object.assign(new Error('Saved examples are only available for the supplied sample room and request.'),
    { code: 'LIVE_UNAVAILABLE', retryable: false } satisfies Omit<ApiError, 'message'>); };
  const matches = (room: typeof SAMPLE_REQUEST.room, request: typeof SAMPLE_REQUEST.request) =>
    room.widthCm === SAMPLE_REQUEST.room.widthCm && room.lengthCm === SAMPLE_REQUEST.room.lengthCm &&
    room.heightCm === SAMPLE_REQUEST.room.heightCm && request.category === SAMPLE_REQUEST.request.category &&
    request.description.trim().toLowerCase() === SAMPLE_REQUEST.request.description;
  return {
    async getRecommendations(room, request) {
      if (!matches(room, request)) return fail();
      return { candidates: options.candidates.map(c => ({ ...c, tags: [...c.tags] })), notice: 'Saved illustrated examples only — not live AI output.' };
    },
    async generatePreview(input) {
      input.signal?.throwIfAborted();
      if (input.photo.source !== 'sample' || input.photo.photoId !== SAMPLE_PHOTO_ID || !matches(input.room,input.request)) return fail();
      const image = options.images[input.candidate.id];
      if (!image || !options.candidates.some(c => c.id === input.candidate.id)) return fail();
      return { requestId: input.requestId, inputVersion: input.inputVersion, optionId: input.candidate.id,
        ...image, mode: 'saved_demo' };
    },
  };
}
