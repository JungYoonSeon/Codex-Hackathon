import type { Clearance, Finding, FitInput, FitResult, Furniture, Placement, Rect } from './types.ts';

const EPS = 1e-6; // Floating-point tolerance only, not measurement uncertainty.
export const TIGHT_FIT_CM = 2;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const positive = (n: unknown): n is number => finite(n) && n > 0;
const validRect = (r: Rect) => finite(r.x) && finite(r.y) && positive(r.width) && positive(r.depth);
export function overlaps(a: Rect, b: Rect): boolean {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS &&
    Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y) > EPS;
}
function inside(r: Rect, width: number, depth: number): boolean {
  return r.x >= -EPS && r.y >= -EPS && r.x + r.width <= width + EPS && r.y + r.depth <= depth + EPS;
}
export function footprint(item: Furniture, p: Placement): Rect {
  return { x: p.x, y: p.y, width: p.rotation === 90 ? item.depth : item.width,
    depth: p.rotation === 90 ? item.width : item.depth };
}
function rotatedClearance(c: Clearance, rotation: 0 | 90): Clearance {
  return rotation === 0 ? c : { top: c.left, right: c.top, bottom: c.right, left: c.bottom };
}
function usageEnvelope(r: Rect, c: Clearance): Rect {
  return { x: r.x - c.left, y: r.y - c.top,
    width: r.width + c.left + c.right, depth: r.depth + c.top + c.bottom };
}

/** Pure function. UI positions must be converted to cm before calling.
 * Typed API: parse/validate arbitrary HTTP JSON before constructing FitInput.
 * Deterministic dimension/reference validation is also performed here.
 */
export function checkFit(input: FitInput): FitResult {
  const { space, placements, catalog } = input;
  const findings: Finding[] = [];
  const limitations = [
    'Based on entered measurements and catalog dimensions; not a guarantee of real-world fit.',
    'Does not check height, delivery access, walking routes, or unmarked obstacles.',
    'Usage clearances are illustrative product allowances, not accessibility certification.',
    'Photo preview size and perspective are not used for fit calculations.',
  ];
  if (!space.surroundingsReviewed) limitations.push('Nearby doors and obstacles have not been reviewed.');
  const add = (rule: Finding['rule'], severity: Finding['severity'], objectIds: string[], message: string, action: string) =>
    findings.push({ rule, severity, objectIds, message, action });
  const unchecked = (): FitResult => ({ status: 'not-checked', physicalFit: 'not-checked',
    usageFit: 'not-checked', findings, limitations, footprints: [] });
  if (!positive(space.width) || !positive(space.depth) || space.measurementStatus !== 'confirmed') {
    add('measurements-unconfirmed', 'info', [], 'Fit not checked. Confirm the available width and depth.', 'Enter positive measurements in centimeters and confirm them.');
    return unchecked();
  }
  const ids = new Set<string>();
  for (const item of catalog) {
    if (!item.id || ids.has(item.id) || ![item.width, item.depth, item.height].every(positive) ||
      !item.clearance || !['top', 'right', 'bottom', 'left'].every(k => {
        const n = item.clearance[k as keyof Clearance]; return finite(n) && n >= 0;
      })) add('invalid-input', 'error', [item.id], 'Catalog dimensions, clearances, or IDs are invalid.', 'Correct the catalog data.');
    ids.add(item.id);
  }
  const byId = new Map(catalog.map(i => [i.id, i]));
  const sceneIds = new Set<string>();
  for (const p of placements) {
    if (!p.id || sceneIds.has(p.id) || !byId.has(p.furnitureId) || !finite(p.x) || !finite(p.y) ||
      (p.rotation !== 0 && p.rotation !== 90))
      add('invalid-input', 'error', [p.id], 'A placement has an invalid position, rotation, ID, or product reference.', 'Use unique IDs, known products, finite coordinates, and 0° or 90° rotation.');
    sceneIds.add(p.id);
  }
  for (const zone of space.zones) {
    if (!zone.id || sceneIds.has(zone.id) || !validRect(zone) ||
      !['obstacle', 'door-clearance'].includes(zone.kind) || !inside(zone, space.width, space.depth))
      add('invalid-input', 'error', [zone.id], 'A reserved zone is invalid or outside the measured space.', 'Keep reserved rectangles inside the space and use unique scene IDs.');
    sceneIds.add(zone.id);
  }
  if (!placements.length) add('invalid-input', 'info', [], 'Select furniture to check fit.', 'Add at least one item.');
  if (findings.length) return unchecked();
  const shapes = placements.map(p => ({ p, item: byId.get(p.furnitureId)!, rect: footprint(byId.get(p.furnitureId)!, p) }));
  for (let i = 0; i < shapes.length; i++) {
    const { p, item, rect } = shapes[i];
    if (!inside(rect, space.width, space.depth)) {
      add('outside-space', 'error', [p.id], `${item.name} extends beyond the measured space.`, 'Move, rotate, or choose a smaller item.');
    } else if (Math.min(space.width - rect.width, space.depth - rect.depth) <= TIGHT_FIT_CM + EPS) {
      add('tight-fit', 'warning', [p.id], `${item.name} has 2 cm or less total spare space along at least one axis.`, 'Remeasure and allow for trim, product variation, and measurement error.');
    }
    for (let j = i + 1; j < shapes.length; j++) {
      if (overlaps(rect, shapes[j].rect)) add('overlap', 'error', [p.id, shapes[j].p.id],
        `${item.name} overlaps ${shapes[j].item.name}.`, 'Move either item to create space.');
    }
    for (const zone of space.zones) {
      if (overlaps(rect, zone)) add(zone.kind === 'door-clearance' ? 'door-clearance' : 'obstacle', 'error', [p.id, zone.id],
        zone.kind === 'door-clearance' ? `${item.name} enters the marked door clearance area.` : `${item.name} overlaps ${zone.label}.`,
        'Move the furniture outside the highlighted area.');
    }
    const c = rotatedClearance(item.clearance, p.rotation);
    if (Object.values(c).some(n => n > 0)) {
      const envelope = usageEnvelope(rect, c);
      const blockers = [...shapes.filter(s => s.p.id !== p.id && overlaps(envelope, s.rect)).map(s => s.p.id),
        ...space.zones.filter(z => overlaps(envelope, z)).map(z => z.id)];
      if (!inside(envelope, space.width, space.depth) || blockers.length)
        add('usage-clearance', 'warning', [p.id, ...blockers], `${item.name} may not have enough room to use comfortably.`,
          'Leave the highlighted usage area free, or confirm a larger available space.');
    }
  }
  const failed = findings.some(f => f.severity === 'error');
  const usageReview = findings.some(f => f.rule === 'usage-clearance');
  return { status: failed ? 'does-not-fit' : findings.length ? 'needs-review' : 'fits',
    physicalFit: failed ? 'fail' : 'pass', usageFit: failed ? 'not-checked' : usageReview ? 'review' : 'pass',
    findings, limitations, footprints: shapes.map(s => ({ ...s.rect, placementId: s.p.id })) };
}
