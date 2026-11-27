import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFit, fixtures, sampleCatalog, footprint, overlaps } from '../src/index.ts';
import type { FitInput, Furniture } from '../src/types.ts';

const clone = <T>(value: T): T => structuredClone(value);
const box: Furniture = { id: 'box', name: 'Test item', category: 'table', width: 40, depth: 20,
  height: 50, clearance: { top: 0, right: 0, bottom: 0, left: 0 },
  dimensionSource: 'fictional-demo', schematicAsset: '' };
function scene(): FitInput {
  return { catalog: [clone(box)], space: { width: 100, depth: 100, measurementStatus: 'confirmed',
    surroundingsReviewed: true, zones: [] },
    placements: [{ id: 'a', furnitureId: 'box', x: 10, y: 10, rotation: 0 }] };
}
const has = (input: FitInput, rule: string) => checkFit(input).findings.some(f => f.rule === rule);

test('demo: comfortable desk passes and preserves uncertainty about surroundings', () => {
  const result = checkFit(fixtures.comfortableDesk);
  assert.equal(result.status, 'fits');
  assert.equal(result.physicalFit, 'pass');
  assert.equal(result.usageFit, 'pass');
  assert.ok(result.limitations.some(s => s.includes('not been reviewed')));
});
test('demo: footprint fits but desk chair allowance needs review', () => {
  const result = checkFit(fixtures.chairSpaceMissing);
  assert.equal(result.status, 'needs-review');
  assert.equal(result.physicalFit, 'pass');
  assert.equal(result.usageFit, 'review');
});
test('demo: too-wide desk fails', () => assert.equal(checkFit(fixtures.deskTooWide).status, 'does-not-fit'));
test('demo: marked door zone blocks placement', () => assert.ok(has(fixtures.doorBlocked, 'door-clearance')));
test('missing, estimated, and invalid room dimensions never pass', () => {
  assert.equal(checkFit(fixtures.measurementsMissing).status, 'not-checked');
  for (const width of [null, 0, -1, NaN, Infinity]) {
    const input = scene(); input.space.width = width;
    assert.equal(checkFit(input).physicalFit, 'not-checked');
  }
  const input = scene(); input.space.measurementStatus = 'estimated';
  assert.equal(checkFit(input).status, 'not-checked');
});
test('rotation swaps footprint dimensions and can turn failure into fit', () => {
  const input = scene(); input.space.width = 30; input.placements[0].x = 0;
  assert.equal(checkFit(input).physicalFit, 'fail');
  input.placements[0].rotation = 90;
  assert.deepEqual(footprint(box, input.placements[0]), { x: 0, y: 10, width: 20, depth: 40 });
  assert.equal(checkFit(input).physicalFit, 'pass');
});
test('each overlapping pair is reported once; moving clears stale findings', () => {
  const input = scene();
  input.placements.push({ id: 'b', furnitureId: 'box', x: 30, y: 15, rotation: 0 });
  assert.equal(checkFit(input).findings.filter(f => f.rule === 'overlap').length, 1);
  input.placements[1].x = 60;
  assert.equal(checkFit(input).status, 'fits');
});
test('edge and corner contact are allowed; actual penetration is blocked', () => {
  const a = { x: 0, y: 0, width: 20, depth: 20 };
  assert.equal(overlaps(a, { ...a, x: 20 }), false);
  assert.equal(overlaps(a, { ...a, x: 20, y: 20 }), false);
  assert.equal(overlaps(a, { ...a, x: 19.99 }), true);
});
test('all four boundaries reject furniture extending outside', () => {
  for (const [x, y] of [[-1, 10], [10, -1], [61, 10], [10, 81]]) {
    const input = scene(); Object.assign(input.placements[0], { x, y });
    assert.ok(has(input, 'outside-space'));
  }
});
test('exact fit is physical pass with remeasurement warning', () => {
  const input = scene(); Object.assign(input.space, { width: 40, depth: 20 });
  Object.assign(input.placements[0], { x: 0, y: 0 });
  const result = checkFit(input);
  assert.equal(result.physicalFit, 'pass'); assert.equal(result.status, 'needs-review');
  assert.ok(has(input, 'tight-fit'));
});
test('floating point rounding does not create false out-of-bounds failures', () => {
  const input = scene(); input.catalog[0].width = 0.1; input.catalog[0].depth = 0.1;
  input.space.width = 0.3; input.placements[0].x = 0.2;
  assert.equal(checkFit(input).physicalFit, 'pass');
});
test('door and obstacle zones have distinct findings; touching is allowed', () => {
  for (const kind of ['obstacle', 'door-clearance'] as const) {
    const input = scene();
    input.space.zones.push({ id: 'zone', label: 'Existing cabinet', kind, x: 40, y: 10, width: 20, depth: 20 });
    assert.ok(has(input, kind));
    input.space.zones[0].x = 50;
    assert.equal(checkFit(input).physicalFit, 'pass');
  }
});
test('clockwise rotation moves bottom use allowance to the left', () => {
  const input = scene(); input.catalog[0].clearance.bottom = 30;
  assert.equal(checkFit(input).usageFit, 'pass');
  input.placements[0].rotation = 90;
  assert.equal(checkFit(input).usageFit, 'review');
  input.placements[0].x = 40;
  assert.equal(checkFit(input).usageFit, 'pass');
});
test('another footprint can block usage while physical footprints fit', () => {
  const input = scene(); input.catalog[0].clearance.bottom = 25;
  input.placements.push({ id: 'b', furnitureId: 'box', x: 10, y: 40, rotation: 0 });
  assert.equal(checkFit(input).physicalFit, 'pass');
  assert.equal(checkFit(input).usageFit, 'review');
  assert.ok(checkFit(input).findings.some(f => f.rule === 'usage-clearance' && f.objectIds.includes('b')));
});
test('overlapping empty usage allowances alone are permitted', () => {
  const input = scene(); input.catalog[0].clearance.bottom = 15; input.catalog[0].clearance.top = 15;
  input.placements[0].y = 20;
  input.placements.push({ id: 'b', furnitureId: 'box', x: 10, y: 60, rotation: 0 });
  assert.equal(checkFit(input).usageFit, 'pass');
});
test('invalid product references, duplicate IDs, rotations and positions are unchecked', () => {
  const mutations = [
    (s: FitInput) => { s.placements[0].furnitureId = 'unknown'; },
    (s: FitInput) => { s.placements.push(clone(s.placements[0])); },
    (s: FitInput) => { s.placements[0].rotation = 45 as 0; },
    (s: FitInput) => { s.placements[0].x = NaN; },
    (s: FitInput) => { s.catalog.push(clone(s.catalog[0])); },
    (s: FitInput) => { s.catalog[0].depth = -1; },
    (s: FitInput) => { s.catalog[0].clearance.left = Infinity; },
    (s: FitInput) => { s.placements = []; },
    (s: FitInput) => { s.space.zones.push({ id: 'a', kind: 'obstacle', label: 'Conflict', x: 0, y: 0, width: 10, depth: 10 }); },
    (s: FitInput) => { s.space.zones.push({ id: 'z', kind: 'obstacle', label: 'Outside', x: 95, y: 0, width: 10, depth: 10 }); },
  ];
  for (const mutate of mutations) {
    const input = scene(); mutate(input);
    assert.equal(checkFit(input).status, 'not-checked');
  }
});
test('checker does not mutate its input and is deterministic', () => {
  const input = clone(fixtures.comfortableDesk); const before = clone(input);
  assert.deepEqual(checkFit(input), checkFit(input)); assert.deepEqual(input, before);
});
test('catalog has eight unique IDs, dimensions, and explicitly fictional sources', () => {
  assert.equal(sampleCatalog.length, 8); assert.equal(new Set(sampleCatalog.map(i => i.id)).size, 8);
  for (const item of sampleCatalog) {
    assert.ok(item.width > 0 && item.depth > 0 && item.height > 0);
    assert.equal(item.dimensionSource, 'fictional-demo');
  }
});
