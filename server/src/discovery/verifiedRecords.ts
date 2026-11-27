// Loads and validates reviewed retailer snapshots (draft contract 0.1).
// Validation enforces the missing-value convention: no empty strings, zeros or negatives standing in
// for unknown sizes/prices, packages kept separate, evidence present for every record.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { DiscoveryProduct } from '../../../shared/discovery.ts';
import { productCategories } from '../../../shared/discovery.ts';

const text = z.string().trim().min(1);
const cm = z.number().positive().max(10_000);
const money = z.object({ amount: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
const evidence = z.object({
  field: text, status: z.enum(['retailer_reported', 'independently_checked', 'derived', 'unverified']),
  method: z.enum(['official_api', 'authorized_feed', 'public_page_structured_data', 'manual_entry', 'derived']),
  sourceUrl: z.string().url(), retrievedAt: z.string().datetime(), market: text.optional(), variantId: text.optional(),
  sourceLabel: text.optional(), originalValue: text.optional(), derivedFrom: z.array(text).optional(), note: text.optional(),
}).strict().refine((e) => e.status !== 'derived' || (e.derivedFrom?.length ?? 0) > 0, 'derived evidence must name its sources');
const categories = productCategories.filter((c) => c.id !== 'all').map((c) => c.id) as [string, ...string[]];

export const verifiedProductSchema = z.object({
  id: z.string().regex(/^[a-z]+:[a-z]{2}:[A-Za-z0-9._-]+$/, 'new retailer ids are <retailer>:<market>:<retailerProductId>'),
  name: text, brand: text.optional(), category: z.enum(categories),
  source: z.enum(['ikea', 'amazon', 'coupang', 'ebay']), sourceLabel: text, dataMode: z.literal('verified_snapshot'),
  description: z.string(), tags: z.array(text), imageUrl: z.string().url().optional(), productUrl: z.string().url(),
  price: money.optional(),
  dimensions: z.object({ widthCm: cm.optional(), depthCm: cm.optional(), heightCm: cm.optional() }).strict().optional(),
  identity: z.object({
    retailer: z.enum(['ikea', 'amazon', 'coupang', 'ebay']), market: z.string().regex(/^[A-Z]{2}$/), retailerProductId: text,
    articleNumber: text.optional(), itemType: text.optional(), variant: z.record(z.string(), text).optional(),
  }).strict(),
  seller: z.object({ name: text, isBrandOwner: z.boolean().optional() }).strict().optional(),
  detailedDimensions: z.record(z.string(), cm).optional(),
  packages: z.array(z.object({
    articleNumber: text.optional(), description: text.optional(), quantity: z.number().int().positive(),
    widthCm: cm.optional(), heightCm: cm.optional(), lengthCm: cm.optional(), weightKg: z.number().positive().optional(),
  }).strict()).optional(),
  packageCount: z.number().int().positive().optional(),
  delivery: z.object({
    status: z.enum(['not_checked', 'destination_required', 'quoted']), shipsToCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
    destination: z.object({ country: text, postalCode: text.optional() }).optional(), checkedAt: z.string().datetime().optional(),
    options: z.array(z.object({ method: text, price: money.optional(), estimate: text.optional() })).optional(),
  }).strict().optional(),
  materials: z.array(z.object({ part: text.optional(), material: text }).strict()).optional(),
  care: z.array(z.object({ part: text.optional(), instructions: z.array(text).min(1) }).strict()).optional(),
  groundClearanceCm: z.number().nonnegative().optional(),
  storageCapacityLiters: z.number().positive().optional(),
  evidence: z.array(evidence).min(1),
  conflicts: z.array(z.object({ field: text, values: z.array(z.object({ value: text, sourceLabel: text, sourceUrl: z.string().url() }).strict()).min(2), note: text.optional() }).strict()).optional(),
  missingFields: z.array(z.object({
    field: text, reason: z.enum(['not_published', 'not_applicable', 'destination_required', 'access_blocked', 'conflicting_sources', 'not_extracted']), note: text.optional(),
  }).strict()),
  retrievedAt: z.string().datetime(),
}).strict().superRefine((p, ctx) => {
  if (p.identity.retailer !== p.source) ctx.addIssue({ code: 'custom', message: 'identity.retailer must equal source' });
  const missing = new Set(p.missingFields.map((m) => m.field));
  for (const f of ['widthCm', 'depthCm', 'heightCm'] as const) {
    if (p.dimensions?.[f] === undefined && !missing.has(`dimensions.${f}`)) ctx.addIssue({ code: 'custom', message: `dimensions.${f} is absent but not listed in missingFields` });
  }
  if (!p.price && !missing.has('price')) ctx.addIssue({ code: 'custom', message: 'price is absent but not listed in missingFields' });
  if (!p.packages?.length && !missing.has('packages')) ctx.addIssue({ code: 'custom', message: 'packages are absent but not listed in missingFields' });
});

export const VERIFIED_RECORDS_FILE = new URL('./records/ikea-kr-verified.json', import.meta.url);

export function parseVerifiedRecords(json: unknown): DiscoveryProduct[] {
  const file = z.object({ schema: z.literal('roomready.discovery-product/0.1-draft'), note: text, records: z.array(z.unknown()) }).parse(json);
  const records = file.records.map((r) => verifiedProductSchema.parse(r) as unknown as DiscoveryProduct);
  const ids = new Set<string>();
  for (const r of records) { if (ids.has(r.id)) throw new Error(`Duplicate verified record id ${r.id}`); ids.add(r.id); }
  return records;
}

let cache: DiscoveryProduct[] | undefined;
/** Reviewed snapshots bundled with the server. Evaluators can import this instead of fetching retailers. */
export function loadVerifiedRecords(): DiscoveryProduct[] {
  cache ??= parseVerifiedRecords(JSON.parse(readFileSync(VERIFIED_RECORDS_FILE, 'utf8')));
  return cache;
}
