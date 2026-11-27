import { sampleCatalog } from './catalog.ts';
import type { FitInput } from './types.ts';

function deskSpace(width: number, depth: number): FitInput {
  return { catalog: sampleCatalog,
    space: { width, depth, measurementStatus: 'confirmed', zones: [], surroundingsReviewed: false },
    placements: [{ id: 'desk', furnitureId: 'desk-compact', x: 10, y: 0, rotation: 0 }] };
}
export const fixtures = {
  comfortableDesk: deskSpace(160, 150),
  chairSpaceMissing: deskSpace(160, 90),
  deskTooWide: deskSpace(110, 150),
  doorBlocked: {
    ...deskSpace(200, 160),
    space: { width: 200, depth: 160, measurementStatus: 'confirmed', surroundingsReviewed: true,
      zones: [{ id: 'door-zone', kind: 'door-clearance', label: 'Marked door clearance', x: 0, y: 0, width: 80, depth: 80 }] },
  } as FitInput,
  measurementsMissing: { ...deskSpace(160, 150),
    space: { width: null, depth: null, measurementStatus: 'missing', zones: [], surroundingsReviewed: false } } as FitInput,
};
