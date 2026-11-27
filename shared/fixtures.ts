import type { RecommendationsRequest } from './contracts.ts';
export const SAMPLE_PHOTO_ID = 'sample-room-illustration-v1';
export const SAMPLE_REQUEST: RecommendationsRequest = {
  room: { widthCm: 400, lengthCm: 300, heightCm: 260 },
  request: { category: 'sofa', description: 'compact beige' },
};
// These are original illustrated fixtures, NOT generated photographic results.
// Use only with SAMPLE_PHOTO_ID, matching room/request, and a visible saved-example label.
export const SAVED_EXAMPLES = [
  { optionId: 'sofa-linen', filename: 'sofa-linen.jpg', mode: 'saved_demo', label: 'Saved illustrated example — not a live AI result' },
  { optionId: 'sofa-sage', filename: 'sofa-sage.jpg', mode: 'saved_demo', label: 'Saved illustrated example — not a live AI result' },
] as const;
