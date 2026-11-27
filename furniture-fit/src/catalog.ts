import type { Furniture } from './types.ts';

// Fictional dimensions and illustrative clearance, deliberately not retailer claims.
const item = (id: string, name: string, category: Furniture['category'], width: number,
  depth: number, height: number, bottom = 0, top = 0, left = 0, right = 0): Furniture => ({
  id, name, category, width, depth, height,
  clearance: { top, right, bottom, left }, dimensionSource: 'fictional-demo',
  schematicAsset: `assets/${id}.svg`,
});
export const sampleCatalog: Furniture[] = [
  item('desk-compact', 'Compact desk', 'desk', 120, 60, 75, 75),
  item('desk-wide', 'Wide desk', 'desk', 160, 75, 75, 75),
  item('chair-task', 'Task chair', 'chair', 60, 60, 95),
  item('sofa-two', 'Two-seat sofa', 'sofa', 170, 85, 80, 45),
  item('table-coffee', 'Coffee table', 'table', 90, 50, 40),
  item('bed-single', 'Single bed frame', 'bed', 105, 205, 90, 45, 0, 45),
  item('cabinet-low', 'Low cabinet', 'storage', 80, 40, 90, 60),
  item('table-side', 'Side table', 'table', 40, 40, 50),
];
