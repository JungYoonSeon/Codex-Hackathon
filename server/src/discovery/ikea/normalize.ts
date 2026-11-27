// IKEA page facts -> DiscoveryProduct (draft retailer-data contract), with field-level evidence.
// Rules: assembled and package sizes stay separate; unknown values are omitted and listed in
// missingFields; disagreeing statements are recorded in conflicts and NOT silently resolved.
import type {
  DiscoveryProduct, DetailedDimensions, FieldConflict, FieldEvidence, MissingField, ProductCategory, ShippingPackage,
} from '../../../../shared/discovery.ts';
import { ConnectorError } from '../errors.ts';
import { parseLengthCm, parseMoney, parseWeightKg, type Normalized } from '../units.ts';
import type { IkeaPageFacts } from './pageParser.ts';
import { parseIkeaProductUrl } from './pageTransport.ts';

// IKEA measurement-type codes (stable across languages) -> record fields.
const MAIN = { '00047': 'widthCm', '00044': 'depthCm', '00041': 'heightCm' } as const;
const DETAIL: Record<string, keyof DetailedDimensions> = {
  '00037': 'seatWidthCm', '00036': 'seatDepthCm', '00039': 'seatHeightCm',
  '00138': 'armrestHeightCm', '00449': 'armrestWidthCm', '00413': 'backrestHeightCm',
};
const GROUND_CLEARANCE = '00242';
const LD_FIELD = { widthCm: 'width', depthCm: 'depth', heightCm: 'height' } as const;

export interface NormalizeContext {
  sourceUrl: string; retrievedAt: string; category: ProductCategory;
  /** Defaults to 'public_page_structured_data' with status 'retailer_reported'. */
  method?: FieldEvidence['method'];
}

export function normalizeIkeaProduct(facts: IkeaPageFacts, ctx: NormalizeContext): DiscoveryProduct {
  const ref = parseIkeaProductUrl(ctx.sourceUrl);
  const market = ref.country;
  const method = ctx.method ?? 'public_page_structured_data';
  const evidence: FieldEvidence[] = [];
  const missing: MissingField[] = [];
  const conflicts: FieldConflict[] = [];
  const articleNumber = facts.jsonLd.mpn ?? `${facts.itemNo.slice(0, 3)}.${facts.itemNo.slice(3, 6)}.${facts.itemNo.slice(6)}`;
  const base = { sourceUrl: ref.url, retrievedAt: ctx.retrievedAt, market, variantId: articleNumber, method };
  const cite = (field: string, sourceLabel: string, originalValue?: string, extra: Partial<FieldEvidence> = {}) =>
    evidence.push({ field, status: 'retailer_reported', ...base, sourceLabel, ...(originalValue !== undefined ? { originalValue } : {}), ...extra });
  const citeNumber = (field: string, sourceLabel: string, n: Normalized) =>
    cite(field, sourceLabel, n.original, n.converted ? { status: 'derived', derivedFrom: [`${sourceLabel} (${n.original})`], note: 'Unit converted to the canonical unit.' } : {});

  const name = facts.jsonLd.name;
  if (!name) throw new ConnectorError('parse', 'The IKEA page has no product name for this item.');
  cite('name', 'schema.org Product.name', name);

  // Identity: IKEA product number from the URL (variant-specific; 's' prefix = combination).
  const id = `ikea:${market.toLowerCase()}:${ref.retailerProductId}`;
  const variantName = name.includes(' - ') ? name.split(' - ').slice(1).join(' - ').trim() : undefined;
  const variant: Record<string, string> = {};
  if (variantName) variant.description = variantName;
  if (facts.jsonLd.color) variant.color = facts.jsonLd.color;
  cite('identity.articleNumber', 'schema.org Product.mpn', articleNumber);

  // Brand and seller are separate concepts.
  const brand = facts.jsonLd.brand;
  if (brand) cite('brand', 'schema.org Product.brand', brand); else missing.push({ field: 'brand', reason: 'not_published' });
  const sellerName = facts.jsonLd.sellerName;
  if (sellerName) cite('seller.name', 'schema.org Offer.seller', sellerName); else missing.push({ field: 'seller', reason: 'not_published' });

  // Price: amount + currency together, valid only for this market at retrievedAt.
  const price = parseMoney(facts.jsonLd.price, facts.jsonLd.currency);
  if (price) cite('price', 'schema.org Offer.price/priceCurrency', `${facts.jsonLd.price} ${facts.jsonLd.currency}`, { note: `Price in ${market} at retrieval time; may change.` });
  else missing.push({ field: 'price', reason: facts.jsonLd.price ? 'not_extracted' : 'not_published' });

  // Assembled dimensions: measurement table, cross-checked with JSON-LD.
  const table = new Map(facts.measurements.map((m) => [m.code, m]));
  const dimensions: NonNullable<DiscoveryProduct['dimensions']> = {};
  for (const [code, field] of Object.entries(MAIN) as [keyof typeof MAIN, typeof MAIN[keyof typeof MAIN]][]) {
    const row = table.get(code);
    const fromTable = parseLengthCm(row?.text);
    const ldText = facts.jsonLd[LD_FIELD[field]];
    const fromLd = parseLengthCm(ldText);
    const path = `dimensions.${field}`;
    if (fromTable && fromLd && fromTable.value !== fromLd.value) {
      conflicts.push({ field: path, values: [
        { value: fromTable.original, sourceLabel: `measurement table: ${row!.label}`, sourceUrl: ref.url },
        { value: fromLd.original, sourceLabel: `schema.org Product.${LD_FIELD[field]}`, sourceUrl: ref.url },
      ], note: 'Two statements on the same retailer page disagree.' });
      missing.push({ field: path, reason: 'conflicting_sources' });
      continue;
    }
    const chosen = fromTable ?? fromLd;
    if (!chosen) {
      missing.push({ field: path, reason: row || ldText ? 'not_extracted' : 'not_published' });
      continue;
    }
    dimensions[field] = chosen.value;
    if (fromTable) citeNumber(path, row!.label, fromTable);
    if (fromLd) citeNumber(path, `schema.org Product.${LD_FIELD[field]}`, fromLd);
  }

  const detailed: DetailedDimensions = {};
  for (const [code, field] of Object.entries(DETAIL)) {
    const row = table.get(code);
    const parsed = parseLengthCm(row?.text);
    if (row && parsed) { detailed[field] = parsed.value; citeNumber(`detailedDimensions.${field}`, row.label, parsed); }
  }

  let groundClearanceCm: number | undefined;
  const clearance = table.get(GROUND_CLEARANCE);
  const clearanceValue = parseLengthCm(clearance?.text);
  if (clearance && clearanceValue) { groundClearanceCm = clearanceValue.value; citeNumber('groundClearanceCm', clearance.label, clearanceValue); }
  else missing.push({ field: 'groundClearanceCm', reason: clearance ? 'not_extracted' : 'not_published' });

  // Shipping packages: exactly as published; never filled from assembled size.
  const packages: ShippingPackage[] = [];
  const rows = facts.packaging?.packages ?? [];
  for (const row of rows) {
    // Combination products list a grouping row for the product itself, without measurements.
    if (row.measurements.length === 0 && row.articleNumber === articleNumber) continue;
    const index = packages.length;
    const pkg: ShippingPackage = { quantity: row.quantity ?? 1 };
    if (row.articleNumber) pkg.articleNumber = row.articleNumber;
    const description = [row.name, row.typeName].filter(Boolean).join(' ');
    if (description) pkg.description = description;
    if (row.quantity !== undefined) cite(`packages[${index}].quantity`, '포장: 패키지', String(row.quantity));
    else cite(`packages[${index}].quantity`, '포장: 패키지', undefined, { status: 'unverified', note: 'Quantity not stated; one package assumed for this listed row.' });
    const byType = new Map(row.measurements.map((m) => [m.type, m]));
    const lengths: [keyof ShippingPackage, string][] = [['widthCm', 'width'], ['heightCm', 'height'], ['lengthCm', 'length']];
    for (const [field, type] of lengths) {
      const m = byType.get(type); const parsed = parseLengthCm(m?.text);
      if (m && parsed) { (pkg as any)[field] = parsed.value; citeNumber(`packages[${index}].${field}`, `포장: ${m.label}`, parsed); }
      else missing.push({ field: `packages[${index}].${field}`, reason: m ? 'not_extracted' : 'not_published' });
    }
    const w = byType.get('weight'); const weight = parseWeightKg(w?.text);
    if (w && weight) { pkg.weightKg = weight.value; citeNumber(`packages[${index}].weightKg`, `포장: ${w.label}`, weight); }
    else missing.push({ field: `packages[${index}].weightKg`, reason: w ? 'not_extracted' : 'not_published' });
    packages.push(pkg);
  }
  if (!packages.length) missing.push({ field: 'packages', reason: 'not_published' });
  const packageCount = facts.packaging?.numberOfPackages;
  if (packageCount !== undefined) {
    cite('packageCount', '포장: 패키지 수', String(packageCount));
    const summed = packages.reduce((sum, p) => sum + p.quantity, 0);
    if (packages.length && summed !== packageCount) {
      conflicts.push({ field: 'packageCount', values: [
        { value: String(packageCount), sourceLabel: 'packaging.numberOfPackages', sourceUrl: ref.url },
        { value: String(summed), sourceLabel: 'sum of listed package quantities', sourceUrl: ref.url },
      ] });
    }
  } else if (packages.length) missing.push({ field: 'packageCount', reason: 'not_published' });

  // Marketing text sometimes restates package size approximately; keep it visible as a conflict, not a value.
  for (const paragraph of facts.descriptionParagraphs) {
    if (!/(패키지|포장|package)/i.test(paragraph)) continue;
    const stated = [...paragraph.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|kg)/gi)].map((m) => `${m[1]} ${m[2].toLowerCase()}`);
    const tableValues = new Set(packages.flatMap((p) => [p.widthCm, p.heightCm, p.lengthCm].map((v) => `${v} cm`).concat(`${p.weightKg} kg`)));
    if (stated.length && stated.some((v) => !tableValues.has(v))) {
      conflicts.push({ field: 'packages', values: [
        { value: stated.join(', '), sourceLabel: 'product description text (approximate wording)', sourceUrl: ref.url },
        { value: packages.map((p) => [p.widthCm, p.heightCm, p.lengthCm].join('×') + ` cm, ${p.weightKg} kg`).join(' | '), sourceLabel: 'packaging measurement table', sourceUrl: ref.url },
      ], note: 'Description gives approximate package figures; the measurement-table values are kept in packages. Confirm before relying on exact package size.' });
    }
  }

  if (facts.materials.length) cite('materials', '소재 및 관리: 소재', facts.materials.map((m) => `${m.part ?? '(part not labelled)'}: ${m.material}`).join(' / '));
  else missing.push({ field: 'materials', reason: 'not_published' });
  if (facts.care.length) cite('care', '소재 및 관리: 제품관리', facts.care.map((c) => `${c.part ?? ''}: ${c.instructions.join(' ')}`).join(' / '));
  else missing.push({ field: 'care', reason: 'not_published' });

  missing.push({ field: 'storageCapacityLiters', reason: 'not_published', note: 'No storage capacity is stated on the product page.' });

  const shipsTo = facts.jsonLd.shipsToCountry;
  if (shipsTo) cite('delivery.shipsToCountry', 'schema.org OfferShippingDetails.shippingDestination', shipsTo);
  missing.push({ field: 'delivery.options', reason: 'not_published', note: 'Delivery cost and timing are not on the product page and were not checked for any destination.' });

  let productUrl = ref.url;
  if (facts.canonicalUrl) { try { productUrl = parseIkeaProductUrl(facts.canonicalUrl).url; } catch { /* keep request URL */ } }
  let imageUrl: string | undefined;
  try { const u = new URL(facts.jsonLd.image ?? ''); if (u.protocol === 'https:' && (u.hostname === 'www.ikea.com' || u.hostname.endsWith('.ikea.com'))) imageUrl = u.href; } catch { /* no image */ }

  const date = ctx.retrievedAt.slice(0, 10);
  return {
    id, name, ...(brand ? { brand } : {}), category: ctx.category,
    source: 'ikea', sourceLabel: `IKEA ${market} · 검증 스냅샷 ${date}`, dataMode: 'verified_snapshot',
    description: '', tags: facts.jsonLd.color ? [facts.jsonLd.color] : [], productUrl, ...(imageUrl ? { imageUrl } : {}),
    ...(price ? { price } : {}),
    ...(Object.keys(dimensions).length ? { dimensions } : {}),
    identity: { retailer: 'ikea', market, retailerProductId: ref.retailerProductId, articleNumber,
      ...(facts.itemType ? { itemType: facts.itemType } : {}), ...(Object.keys(variant).length ? { variant } : {}) },
    ...(sellerName ? { seller: { name: sellerName, ...(brand ? { isBrandOwner: sellerName === brand } : {}) } } : {}),
    ...(Object.keys(detailed).length ? { detailedDimensions: detailed } : {}),
    ...(packages.length ? { packages } : {}),
    ...(packageCount !== undefined ? { packageCount } : {}),
    delivery: { status: 'not_checked', ...(shipsTo ? { shipsToCountry: shipsTo } : {}) },
    ...(facts.materials.length ? { materials: facts.materials } : {}),
    ...(facts.care.length ? { care: facts.care } : {}),
    ...(groundClearanceCm !== undefined ? { groundClearanceCm } : {}),
    evidence, ...(conflicts.length ? { conflicts } : {}), missingFields: missing,
    retrievedAt: ctx.retrievedAt,
  };
}
