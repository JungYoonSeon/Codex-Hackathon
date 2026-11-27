// Retailer-data tests. Pages below are SYNTHETIC (built here to mimic the structure of IKEA product
// pages); no retailer page copy is stored. Passing tests do not prove current live retailer access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { readFileSync } from 'node:fs';
import { parseIkeaProductPage } from '../src/discovery/ikea/pageParser.ts';
import { normalizeIkeaProduct } from '../src/discovery/ikea/normalize.ts';
import { fetchIkeaProductPage, parseIkeaProductUrl } from '../src/discovery/ikea/pageTransport.ts';
import { parseLengthCm, parseMoney, parseWeightKg } from '../src/discovery/units.ts';
import { loadVerifiedRecords, parseVerifiedRecords, VERIFIED_RECORDS_FILE } from '../src/discovery/verifiedRecords.ts';
import { createDiscoveryRouter, type DiscoveryDeps } from '../src/discovery/router.ts';
import { ConnectorError } from '../src/discovery/errors.ts';
import { searchCoupang } from '../src/discovery/coupang.ts';
import type { DiscoveryProduct } from '../../shared/discovery.ts';

const URL_A = 'https://www.ikea.com/kr/ko/p/test-sofa-grey-12345678/';
const URL_S = 'https://www.ikea.com/kr/ko/p/test-combo-sofa-s87654321/';
const AT = '2026-11-27T06:29:07Z';

interface PageSpec {
  itemNo: string; type?: string; name?: string; price?: string; currency?: string; mpn?: string; url: string;
  ld?: Record<string, string>; measurements?: [string, string, string][]; packages?: unknown[]; numberOfPackages?: number;
  materials?: unknown[]; care?: unknown[]; paragraphs?: string[]; includeRelated?: boolean;
}
const pkg = (art: string, typeName: string, qty: number | undefined, m: [string, string][]) => ({
  name: 'TEST', typeName, itemNo: art.replace(/\./g, ''), articleNumber: { label: '제품 번호', value: art },
  quantity: qty === undefined ? undefined : { label: '패키지', value: qty },
  measurementGroups: [{ heading: null, measurements: m.map(([type, text]) => ({ label: type, type, text })) }],
});
function page(spec: PageSpec): string {
  const mpn = spec.mpn ?? `${spec.itemNo.slice(0, 3)}.${spec.itemNo.slice(3, 6)}.${spec.itemNo.slice(6)}`;
  const ld = {
    '@context': 'https://schema.org/', '@type': 'Product', name: spec.name ?? 'TEST 테스트 2인용소파 - 테스트 그레이', brand: { '@type': 'Brand', name: 'IKEA' },
    mpn, sku: mpn, color: '그레이', ...spec.ld,
    image: [{ '@type': 'ImageObject', contentUrl: 'https://www.ikea.com/kr/ko/images/products/test.jpg' }],
    offers: { '@type': 'Offer', price: spec.price ?? '150000', priceCurrency: spec.currency ?? 'KRW', seller: { '@type': 'Organization', name: 'IKEA' },
      shippingDetails: { '@type': 'OfferShippingDetails', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' } }, url: spec.url },
  };
  const props = (itemNo: string, extra: object) => ({ loaderData: { pageProps: { product: { itemNo, type: spec.type ?? 'ART', ...extra }, productInformationSectionProps: {
    measurementsProps: { measurements: (spec.measurements ?? []).map(([type, name, measure]) => ({ type, name, measure })) },
    productDetailsProps: { accordionObject: { materialsAndCare: { contentProps: { materials: spec.materials ?? [], careInstructions: spec.care ?? [] } } },
      productDescriptionProps: { paragraphs: spec.paragraphs ?? [] } },
  } } } });
  const hydration: Record<string, unknown> = {
    // Related product embedded BEFORE the real one (seen on a real page: a mattress on a sofa page).
    ...(spec.includeRelated !== false ? { 0: props('80450739', { packaging: { numberOfPackages: 1, packages: [pkg('804.507.39', 'mattress', 1, [['width', '42 cm'], ['height', '42 cm'], ['length', '135 cm'], ['weight', '40.60 kg']])] } }) } : {}),
    1: props(spec.itemNo, { packaging: { numberOfPackages: spec.numberOfPackages, packages: spec.packages ?? [] } }),
  };
  return `<html><head><link rel="canonical" href="${spec.url}"><script type="application/ld+json">${JSON.stringify(ld)}</script></head>
<body><script type="text/hydrate" data-fika-hydration-id="x">${JSON.stringify(hydration)}</script></body></html>`;
}
const MEASURE_A: [string, string, string][] = [['00047', '폭', '121 cm'], ['00044', '깊이', '78 cm'], ['00242', '가구 밑 여유공간', '23 cm'], ['00039', '시트 높이', '41 cm']];
const baseA: PageSpec = { itemNo: '12345678', url: URL_A, ld: { width: '121 cm', depth: '78 cm' }, measurements: MEASURE_A,
  numberOfPackages: 1, packages: [pkg('123.456.78', '2인용소파', 1, [['width', '66 cm'], ['height', '21 cm'], ['length', '118 cm'], ['weight', '20.15 kg']])],
  materials: [{ materials: [{ part: '패브릭:', material: '폴리에스테르 100%' }] }], care: [{ header: '커버', texts: ['진공청소기를 사용하세요.'] }] };
const normalize = (spec: PageSpec) => {
  const ref = parseIkeaProductUrl(spec.url);
  return normalizeIkeaProduct(parseIkeaProductPage(page(spec), ref.retailerProductId), { sourceUrl: spec.url, retrievedAt: AT, category: 'sofa' });
};
const ev = (p: DiscoveryProduct, field: string) => p.evidence!.filter((e) => e.field === field);
const missing = (p: DiscoveryProduct, field: string) => p.missingFields!.find((m) => m.field === field);

// ---------- identity ----------
test('IDs are stable across title and price changes and are market-namespaced', () => {
  const a = normalize(baseA);
  const b = normalize({ ...baseA, name: 'Renamed sofa - 다른 이름', price: '99000' });
  assert.equal(a.id, 'ikea:kr:12345678');
  assert.equal(b.id, a.id);
  assert.notEqual(a.price!.amount, b.price!.amount);
});

test('variants with different product numbers keep distinct identities; combinations keep the s-prefix', () => {
  const grey = normalize(baseA);
  const other = normalize({ ...baseA, itemNo: '22345678', url: 'https://www.ikea.com/kr/ko/p/test-sofa-blue-22345678/', name: 'TEST 2인용소파 - 블루',
    packages: [pkg('223.456.78', '2인용소파', 1, [['width', '66 cm'], ['height', '18 cm'], ['length', '118 cm'], ['weight', '18.30 kg']])] });
  assert.notEqual(grey.id, other.id);
  assert.equal(other.identity!.variant!.description, '블루');
  assert.notDeepEqual(grey.packages, other.packages, 'variant-specific package data is not shared');
  const combo = normalize({ ...baseA, itemNo: '87654321', url: URL_S, type: 'SPR', packages: [] });
  assert.equal(combo.id, 'ikea:kr:s87654321');
  assert.equal(combo.identity!.itemType, 'SPR');
});

test('only the page product is parsed; embedded related products are ignored', () => {
  const p = normalize(baseA);
  assert.equal(p.packages!.length, 1);
  assert.equal(p.packages![0].articleNumber, '123.456.78');
  assert.ok(!JSON.stringify(p).includes('804.507.39'));
});

// ---------- assembled vs package, multiple packages ----------
test('assembled dimensions and shipping packages stay separate; missing height stays missing', () => {
  const p = normalize(baseA);
  assert.deepEqual(p.dimensions, { widthCm: 121, depthCm: 78 });
  assert.equal('heightCm' in p.dimensions!, false);
  assert.equal(missing(p, 'dimensions.heightCm')?.reason, 'not_published');
  assert.deepEqual(p.packages![0], { quantity: 1, articleNumber: '123.456.78', description: 'TEST 2인용소파', widthCm: 66, heightCm: 21, lengthCm: 118, weightKg: 20.15 });
  assert.equal(p.groundClearanceCm, 23);
  assert.equal(p.detailedDimensions!.seatHeightCm, 41);
});

test('combination products keep multiple packages, skip the grouping row, and check the package count', () => {
  const spec: PageSpec = { ...baseA, itemNo: '87654321', url: URL_S, type: 'SPR', numberOfPackages: 2, packages: [
    pkg('876.543.21', '2인용소파', 1, []),
    pkg('101.605.35', '프레임', 1, [['width', '89 cm'], ['height', '35 cm'], ['length', '181 cm'], ['weight', '45.44 kg']]),
    pkg('002.788.56', '커버', 1, [['width', '37 cm'], ['height', '4 cm'], ['length', '57 cm'], ['weight', '2.18 kg']]),
  ] };
  const p = normalize(spec);
  assert.equal(p.packageCount, 2);
  assert.deepEqual(p.packages!.map((x) => x.articleNumber), ['101.605.35', '002.788.56']);
  assert.equal(p.conflicts, undefined);
  const mismatch = normalize({ ...spec, numberOfPackages: 3 });
  assert.equal(mismatch.conflicts?.[0].field, 'packageCount');
  const multiQty = normalize({ ...spec, numberOfPackages: 3, packages: [pkg('101.605.35', '프레임', 2, [['width', '89 cm']]), pkg('002.788.56', '커버', 1, [])] });
  assert.equal(multiQty.packages![0].quantity, 2);
  assert.equal(multiQty.conflicts, undefined, '2 + 1 packages equal the stated count');
  assert.equal(missing(multiQty, 'packages[0].weightKg')?.reason, 'not_published');
  assert.equal(multiQty.packages![1].widthCm, undefined, 'never filled from assembled size');
});

test('no package data is reported as missing, never replaced by assembled size', () => {
  const p = normalize({ ...baseA, packages: [], numberOfPackages: undefined });
  assert.equal(p.packages, undefined);
  assert.equal(missing(p, 'packages')?.reason, 'not_published');
});

// ---------- units, currency, missing values ----------
test('unit and currency normalization keeps the original text as evidence', () => {
  assert.deepEqual(parseLengthCm('1210 mm'), { value: 121, original: '1210 mm', converted: true });
  assert.deepEqual(parseLengthCm('47.5"'), { value: 120.65, original: '47.5"', converted: true });
  assert.equal(parseLengthCm('31 3/4"'), undefined);
  assert.equal(parseLengthCm(''), undefined);
  assert.deepEqual(parseWeightKg('2180 g'), { value: 2.18, original: '2180 g', converted: true });
  assert.deepEqual(parseMoney('150,000', 'krw'), { amount: 150000, currency: 'KRW' });
  assert.equal(parseMoney('150000', undefined), undefined, 'amount without currency is not a price');
  assert.equal(parseMoney('', 'KRW'), undefined);
  assert.equal(parseMoney('-1', 'KRW'), undefined);
  const p = normalize({ ...baseA, measurements: [['00047', '폭', '1210 mm'], ['00044', '깊이', '78 cm']], ld: {} });
  assert.equal(p.dimensions!.widthCm, 121);
  const e = ev(p, 'dimensions.widthCm')[0];
  assert.equal(e.status, 'derived');
  assert.equal(e.originalValue, '1210 mm');
  assert.ok(e.derivedFrom!.length);
});

test('missing or malformed values stay missing (no zeros, empty strings or guesses)', () => {
  const p = normalize({ ...baseA, price: 'call store', measurements: [['00047', '폭', 'about a metre']], ld: {}, materials: [], care: [], packages: [pkg('123.456.78', 'x', 1, [['width', '']])] });
  assert.equal(p.price, undefined);
  assert.equal(missing(p, 'price')?.reason, 'not_extracted');
  assert.equal(p.dimensions, undefined);
  assert.equal(missing(p, 'dimensions.widthCm')?.reason, 'not_extracted');
  assert.equal(missing(p, 'dimensions.depthCm')?.reason, 'not_published');
  assert.equal(p.materials, undefined);
  assert.equal(p.groundClearanceCm, undefined);
  assert.equal(missing(p, 'storageCapacityLiters')?.reason, 'not_published');
  assert.equal(p.delivery!.status, 'not_checked', 'unknown delivery is not "unavailable"');
  const json = JSON.stringify(p);
  assert.ok(!/":\s*""/.test(json.replace(/"description":""/, '')), 'no empty strings as data');
  assert.ok(!/"(widthCm|depthCm|heightCm|weightKg|amount)":0[,}]/.test(json), 'no zero placeholders');
});

// ---------- evidence and conflicts ----------
test('every important value carries field-level evidence with source, time, market and variant', () => {
  const p = normalize(baseA);
  for (const field of ['name', 'price', 'dimensions.widthCm', 'packages[0].weightKg', 'groundClearanceCm', 'materials', 'care', 'seller.name', 'brand']) {
    const [e] = ev(p, field);
    assert.ok(e, `evidence for ${field}`);
    assert.equal(e.sourceUrl, URL_A); assert.equal(e.retrievedAt, AT); assert.equal(e.market, 'KR'); assert.equal(e.variantId, '123.456.78');
    assert.equal(e.method, 'public_page_structured_data');
  }
  assert.equal(ev(p, 'dimensions.widthCm').length, 2, 'both agreeing statements are cited');
  assert.equal(ev(p, 'groundClearanceCm')[0].originalValue, '23 cm');
});

test('conflicting statements are preserved and the value is not silently chosen', () => {
  const p = normalize({ ...baseA, ld: { width: '125 cm', depth: '78 cm' } });
  assert.equal(p.dimensions!.widthCm, undefined);
  assert.equal(missing(p, 'dimensions.widthCm')?.reason, 'conflicting_sources');
  assert.deepEqual(p.conflicts![0].values.map((v) => v.value), ['121 cm', '125 cm']);
  const approx = normalize({ ...baseA, paragraphs: ['패키지는 길이가 약 115cm이고, 폭은 65cm이며, 무게는 20kg이 채 되지 않으니까요.'] });
  assert.equal(approx.conflicts![0].field, 'packages');
  assert.equal(approx.packages![0].lengthCm, 118, 'measurement table kept; conflict recorded');
});

// ---------- malformed / changed sources ----------
test('changed or malformed pages fail with a parse error instead of partial guesses', () => {
  assert.throws(() => parseIkeaProductPage('<html>nothing here</html>', '12345678'), (e: ConnectorError) => e.kind === 'parse');
  assert.throws(() => parseIkeaProductPage(page({ ...baseA, includeRelated: true, itemNo: '99999999' }), '12345678'), (e: ConnectorError) => e.kind === 'parse');
  assert.throws(() => parseIkeaProductPage(page(baseA).replace('"itemNo":"12345678"', '"itemNo":12345678'), '12345678'), (e: ConnectorError) => e.kind === 'parse');
  const noName = page(baseA).replace(/"name":"TEST 테스트 2인용소파 - 테스트 그레이",/, '');
  assert.throws(() => normalize({ ...baseA, name: '' }), (e: ConnectorError) => e.kind === 'parse');
  assert.ok(noName.length > 0);
});

// ---------- transport ----------
test('IKEA transport accepts only product pages and maps HTTP failures', async () => {
  for (const bad of ['https://www.ikea.com/kr/ko/search/?q=sofa', 'http://www.ikea.com/kr/ko/p/x-12345678/', 'https://evil.example/kr/ko/p/x-12345678/', `${URL_A}?x=1`]) {
    assert.throws(() => parseIkeaProductUrl(bad), (e: ConnectorError) => e.kind === 'parse', bad);
  }
  const respond = (status: number, body = '', url = URL_A) => async () =>
    ({ ok: status >= 200 && status < 300, status, url, headers: new Headers(), text: async () => body }) as unknown as Response;
  for (const [status, kind] of [[403, 'access-denied'], [401, 'access-denied'], [429, 'rate-limited'], [503, 'unavailable'], [404, 'no-results']] as const) {
    await assert.rejects(fetchIkeaProductPage(URL_A, { fetchImpl: respond(status) as typeof fetch }), (e: ConnectorError) => e.kind === kind, String(status));
  }
  await assert.rejects(fetchIkeaProductPage(URL_A, { fetchImpl: respond(200, 'x', 'https://www.ikea.com/kr/ko/challenge') as typeof fetch }), (e: ConnectorError) => e.kind === 'access-denied');
  const hang = ((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
  await assert.rejects(fetchIkeaProductPage(URL_A, { fetchImpl: hang, timeoutMs: 20 }), (e: ConnectorError) => e.kind === 'timeout');
  const ok = await fetchIkeaProductPage(URL_A, { fetchImpl: respond(200, page(baseA)) as typeof fetch, now: () => new Date(AT) });
  assert.equal(ok.retrievedAt, '2026-11-27T06:29:07.000Z');
});

// ---------- committed verified records ----------
test('committed verified records validate and keep the agreed semantics', () => {
  const records = loadVerifiedRecords();
  assert.deepEqual(records.map((r) => r.id), ['ikea:kr:10489009', 'ikea:kr:s49010615']);
  const [glostad, klippan] = records;
  assert.equal(glostad.dimensions!.heightCm, undefined);
  assert.equal(missing(glostad, 'dimensions.heightCm')?.reason, 'not_published');
  assert.equal(glostad.packages!.length, 1);
  assert.ok(glostad.conflicts?.some((c) => c.field === 'packages'), 'approximate description kept as conflict');
  assert.equal(klippan.packageCount, 2);
  assert.equal(klippan.packages!.length, 2);
  for (const r of records) {
    assert.equal(r.dataMode, 'verified_snapshot');
    assert.equal(r.price!.currency, 'KRW');
    assert.equal(r.delivery!.status, 'not_checked');
    for (const p of r.packages!) assert.notDeepEqual([p.widthCm, p.lengthCm], [r.dimensions!.widthCm, r.dimensions!.depthCm]);
  }
  const raw = JSON.parse(readFileSync(VERIFIED_RECORDS_FILE, 'utf8'));
  const broken = structuredClone(raw); broken.records[0].dimensions.widthCm = 0;
  assert.throws(() => parseVerifiedRecords(broken), 'zero placeholder rejected');
  const silent = structuredClone(raw); silent.records[0].missingFields = [];
  assert.throws(() => parseVerifiedRecords(silent), 'unlisted missing value rejected');
});

// ---------- router: partial failure, statuses, no silent fixtures ----------
async function serve(t: test.TestContext, deps: Partial<DiscoveryDeps>) {
  const app = express();
  app.use('/products', createDiscoveryRouter(deps));
  app.use(((error, _req, res, _next) => res.status(error.status ?? 500).json(error.body ?? { code: 'INTERNAL_ERROR' })) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }));
  return async (query: string) => (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/products?${query}`)).json();
}
const live = (id: string): DiscoveryProduct => ({ id, name: `Live ${id}`, category: 'sofa', source: 'ebay', sourceLabel: 'eBay', dataMode: 'live', description: '', tags: [], productUrl: 'https://www.ebay.com/itm/1' });
const configuredEnv = { AMAZON_CLIENT_ID: 'id', AMAZON_CLIENT_SECRET: 'secret', AMAZON_PARTNER_TAG: 'tag', EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret' };

test('one retailer failing does not discard others; failures are typed; live failures never return fixtures', async (t) => {
  const get = await serve(t, {
    env: configuredEnv,
    searchAmazon: async () => { throw new ConnectorError('rate-limited', 'limit', true); },
    searchEbay: async () => ({ products: [live('ebay:1'), live('ebay:1'), live('ebay:2')], hasMore: false }),
  });
  const all = await get('q=sofa&source=all');
  const status = Object.fromEntries(all.sources.map((s: any) => [s.source, s]));
  assert.equal(status.amazon.status, 'error'); assert.equal(status.amazon.reason, 'rate-limited');
  assert.equal(status.ebay.status, 'ready');
  assert.equal(status.coupang.status, 'not-configured');
  assert.equal(status.ikea.reason, 'snapshot');
  assert.equal(all.products.filter((p: any) => p.id === 'ebay:1').length, 1, 'deduplicated by stable id');
  assert.ok(all.products.some((p: any) => p.id === 'ikea:kr:10489009'), 'verified snapshot served and labelled');
  const amazonOnly = await get('q=sofa&source=amazon');
  assert.deepEqual(amazonOnly.products, [], 'no demo or snapshot fallback for a failed live source');
});

test('auth failures and timeouts are reported per retailer', async (t) => {
  const get = await serve(t, {
    env: configuredEnv, providerTimeoutMs: 30,
    searchAmazon: async () => { throw new ConnectorError('access-denied', 'denied'); },
    searchEbay: (_i, signal) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' })))),
  });
  const body = await get('source=all');
  const status = Object.fromEntries(body.sources.map((s: any) => [s.source, s]));
  assert.equal(status.amazon.reason, 'access-denied');
  assert.equal(status.ebay.reason, 'timeout');
});

test('unconfigured retailers are explicit and Coupang never sends a request without a verified contract', async (t) => {
  const get = await serve(t, { env: {} });
  const body = await get('source=all');
  const status = Object.fromEntries(body.sources.map((s: any) => [s.source, s]));
  for (const s of ['amazon', 'ebay', 'coupang']) assert.equal(status[s].status, 'not-configured', s);
  await assert.rejects(searchCoupang({}), (e: ConnectorError) => e.kind === 'unavailable');
  await assert.rejects(searchCoupang({ accessKey: 'a', secretKey: 'b' }), (e: ConnectorError) => e.kind === 'unavailable');
  const withKeys = await (await serve(t, { env: { COUPANG_ACCESS_KEY: 'a', COUPANG_SECRET_KEY: 'b' } }))('source=coupang');
  assert.equal(withKeys.sources[0].status, 'error');
  assert.deepEqual(withKeys.products, []);
  assert.ok(body.links.some((l: any) => l.source === 'coupang'), 'outbound link only');
});
