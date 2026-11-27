// Bundled sample scenario (윤선's illustrated fixtures, copied from server/assets/sample).
// Static requires only: Metro resolves these at build time.
import { SAMPLE_PHOTO_ID, SAMPLE_REQUEST } from '../../../shared/fixtures.ts';
import sampleRecommendations from './sampleRecommendations.json';
import { createSavedExampleService } from './savedExampleService.js';

export const SAMPLE_ROOM_IMAGE = require('../../../assets/sample/room.jpg');

export const SAMPLE_PHOTO = Object.freeze({
  photoId: SAMPLE_PHOTO_ID,
  uri: 'bundled:assets/sample/room.jpg', // rendered from SAMPLE_ROOM_IMAGE; never uploaded
  mimeType: 'image/jpeg',
  widthPx: 960,
  heightPx: 720,
  source: 'sample',
});

export const SAMPLE_ROOM = SAMPLE_REQUEST.room;
export const SAMPLE_FURNITURE_REQUEST = SAMPLE_REQUEST.request;

export const savedExampleService = createSavedExampleService({
  candidates: sampleRecommendations.candidates,
  imageSources: {
    'sofa-linen': require('../../../assets/sample/sofa-linen.jpg'),
    'sofa-sage': require('../../../assets/sample/sofa-sage.jpg'),
  },
});

export function photoImageSource(photo) {
  if (!photo) return null;
  return photo.source === 'sample' ? SAMPLE_ROOM_IMAGE : { uri: photo.uri };
}
