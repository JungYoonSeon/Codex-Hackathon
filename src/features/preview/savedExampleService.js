// Saved-example adapter around 윤선's shared fixture service.
// The shared service enforces the sample identity (photo ID, dimensions, request, candidate IDs).
// Bundled images are rendered via static React Native sources, so no image bytes are loaded here;
// the fixture's imageBase64 is left empty and the matching bundled source is attached instead.
import { createFixtureService } from '../../../shared/fixture-service.ts';
import { SAMPLE_PHOTO_ID, SAMPLE_REQUEST, SAVED_EXAMPLES } from '../../../shared/fixtures.ts';

export const SAVED_EXAMPLE_LABEL = SAVED_EXAMPLES[0].label;

export function matchesSampleInputs(room, request) {
  const sample = SAMPLE_REQUEST;
  return !!room && !!request && room.widthCm === sample.room.widthCm && room.lengthCm === sample.room.lengthCm
    && room.heightCm === sample.room.heightCm && request.category === sample.request.category
    && typeof request.description === 'string' && request.description.trim().toLowerCase() === sample.request.description;
}

export function isSamplePhoto(photo) {
  return photo?.source === 'sample' && photo.photoId === SAMPLE_PHOTO_ID;
}

/**
 * @param {{ candidates: object[], imageSources: Record<string, unknown> }} options
 *   candidates: the checked sample recommendations; imageSources: optionId -> bundled image source.
 */
export function createSavedExampleService({ candidates, imageSources }) {
  // Only offer candidates that actually have a saved illustration (never duplicate one as another option).
  const available = candidates.filter((c) => SAVED_EXAMPLES.some((e) => e.optionId === c.id) && imageSources[c.id]);
  const images = Object.fromEntries(available.map((c) => [c.id, { imageBase64: '', mimeType: 'image/jpeg' }]));
  const fixture = createFixtureService({ candidates: available, images });

  return {
    mode: 'saved_demo',
    getRecommendations: (room, request) => fixture.getRecommendations(room, request),
    async generatePreview(input) {
      if (input.signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      // The signal is checked here instead of inside the shared service, because
      // AbortSignal.throwIfAborted is not guaranteed in React Native.
      const { signal: _signal, ...rest } = input;
      const response = await fixture.generatePreview(rest);
      return { ...response, imageBase64: undefined, imageSource: imageSources[response.optionId] };
    },
  };
}
