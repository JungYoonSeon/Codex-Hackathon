import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conflictNotes, dataBadge, formatDimensions, formatPackages, formatPrice, missingSummary, provenanceNote } from '../productDisplay.js';

const records = JSON.parse(readFileSync(new URL('../../../server/src/discovery/records/ikea-kr-verified.json', import.meta.url), 'utf8')).records;
const [glostad, klippan] = records;

test('verified snapshots are labelled with their date, never as live search', () => {
  assert.equal(dataBadge(glostad), '검증 스냅샷 · 2026-11-27');
  assert.equal(dataBadge({ dataMode: 'live' }), '실시간 검색');
  assert.match(provenanceNote(glostad), /직접 측정한 값이 아니에요/);
  assert.equal(provenanceNote({ dataMode: 'live' }), null);
});

test('price keeps its currency; missing price is shown as missing', () => {
  assert.equal(formatPrice(glostad), '150,000원');
  assert.equal(formatPrice({ price: { amount: 19.5, currency: 'USD' } }), 'USD 19.50');
  assert.equal(formatPrice({ dataMode: 'live' }), '가격 미확인 · 판매처에서 확인');
});

test('missing height is shown as missing, not as 0 or "?" alone', () => {
  assert.equal(formatDimensions(glostad), '121 × 78 × 높이 미제공 cm (가로 × 깊이 × 높이, 조립 기준)');
  assert.equal(formatDimensions({}), '치수 미제공 · 판매처에서 확인');
  assert.ok(missingSummary(glostad).includes('높이: 판매처 미기재'));
});

test('packages are listed separately, including multi-package combinations', () => {
  assert.deepEqual(formatPackages(klippan), [
    '총 2개 포장',
    '1. KLIPPAN 클리판 2인용 소파 프레임 (101.605.35): 89 × 35 × 181 cm, 45.44 kg',
    '2. KLIPPAN 클리판 2인용소파커버 (002.788.56): 37 × 4 × 57 cm, 2.18 kg',
  ]);
  assert.deepEqual(formatPackages({ missingFields: [{ field: 'packages', reason: 'not_published' }] }), ['포장 크기 미기재']);
  assert.match(conflictNotes(glostad)[0], /^포장 크기: 115 cm, 65 cm, 20 kg vs /);
});
