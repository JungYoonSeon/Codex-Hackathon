/** All geometry is centimeters, in a top-down view. +x right, +y down. */
export interface Rect { x: number; y: number; width: number; depth: number }
export interface Clearance { top: number; right: number; bottom: number; left: number }
export interface Furniture {
  id: string;
  name: string;
  category: 'desk' | 'chair' | 'sofa' | 'table' | 'bed' | 'storage';
  width: number;
  depth: number;
  height: number;
  /** Illustrative use-space, not a certified accessibility standard. */
  clearance: Clearance;
  dimensionSource: 'fictional-demo';
  /** Top-down schematic; not a product photo or photorealistic cutout. */
  schematicAsset: string;
}
export interface Placement {
  id: string;
  furnitureId: string;
  /** Top-left corner of the footprint AFTER rotation; never photo pixels. */
  x: number;
  y: number;
  rotation: 0 | 90;
}
export interface ReservedZone extends Rect {
  id: string;
  kind: 'obstacle' | 'door-clearance';
  label: string;
}
export interface AvailableSpace {
  width: number | null;
  depth: number | null;
  measurementStatus: 'confirmed' | 'estimated' | 'missing';
  /** Entire rectangular zones, not computed door swing arcs. */
  zones: ReservedZone[];
  /** Unmarked obstacles/doors cannot be checked. */
  surroundingsReviewed: boolean;
}
export interface FitInput { space: AvailableSpace; placements: Placement[]; catalog: Furniture[] }
export type RuleId = 'invalid-input' | 'measurements-unconfirmed' | 'outside-space' |
  'overlap' | 'obstacle' | 'door-clearance' | 'usage-clearance' | 'tight-fit';
export interface Finding {
  rule: RuleId;
  severity: 'error' | 'warning' | 'info';
  objectIds: string[];
  message: string;
  action: string;
}
export interface FitResult {
  status: 'fits' | 'needs-review' | 'does-not-fit' | 'not-checked';
  physicalFit: 'pass' | 'fail' | 'not-checked';
  usageFit: 'pass' | 'review' | 'not-checked';
  findings: Finding[];
  /** Always show these limits next to the result. */
  limitations: string[];
  footprints: Array<Rect & { placementId: string }>;
}
