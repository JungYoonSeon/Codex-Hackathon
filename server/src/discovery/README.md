# Retailer data and connectors (Korea market)

Owner: Anna. Status as of 2026-11-27. **The contract below is a DRAFT (0.1) pending agreement with 윤선.**

## What is here

| Path | Purpose |
|---|---|
| `../../../shared/discovery.ts` | `DiscoveryProduct` plus draft additive fields (all optional; existing fields and IDs unchanged) |
| `records/ikea-kr-verified.json` | Two reviewed IKEA Korea product records (verified snapshots) |
| `verifiedRecords.ts` | Validating loader (`loadVerifiedRecords()`), with no network access |
| `ikea/pageTransport.ts` → `ikea/pageParser.ts` → `ikea/normalize.ts` | IKEA product-page detail lookup: transport, parsing, normalization + evidence |
| `ikea/snapshot.ts` | CLI that produces one record for review |
| `coupang.ts` | Coupang boundary: explicit not-configured / not-verified states, sends no requests |
| `providers.ts` | Existing Amazon (Creators API) / eBay / IKEA-feed connectors, now with typed errors |
| `router.ts` | `GET /products`: partial success per retailer, typed `reason`, dedupe by `id` |
| `../../../mobile/product-search/productDisplay.js` | Display helpers used by `mobile/FurnitureDiscovery.js` |

## Retailer status

| Retailer | Access method | Configured? | Live request attempted? | Search | Detail | Field coverage | Blocker |
|---|---|---|---|---|---|---|---|
| IKEA KR | No public product API. One public product page (`/p/`, allowed by robots.txt) read via schema.org JSON-LD + embedded product data | No keys needed | Yes: 1 live detail request (GLOSTAD) on 2026-11-27, normalized output identical to the committed record | **Not available** (search URLs are disallowed by robots.txt; not attempted) | **Works** for a given product URL (snapshot tool) | Price/KRW, assembled W×D(×H), detailed seat/arm sizes, ground clearance, packages + count + weight, materials, care, ships-to country | No official API or feed; terms for automated use not confirmed. Delivery cost/time not on page |
| Coupang | Coupang Partners Open API (affiliate, HMAC keys), as described by third-party sources only | No (`COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` absent) | No | Blocked | Blocked | Unknown. Official docs returned HTTP 403 to automated reads | Approved Partners account + keys, and someone with access must confirm the official endpoint/signing/response/display rules. No page scraping (robots.txt returned 403) |
| Amazon | Creators API (existing `searchAmazon`) | No (`AMAZON_CLIENT_ID/SECRET/PARTNER_TAG` absent) | No | Blocked | Blocked (GetItems not wired) | Title, brand, features, image, price. Dimension fields not confirmed in Creators API docs | **No Korean marketplace** in the Creators API (22 locales, none KR). Associates final acceptance + 10 qualifying sales/30 days. Prices would be US/UK/JP market |

Levels reached:
- **Configured adapter:** none of the three has credentials.
- **Mocked tests passing:** IKEA parser, normalizer and transport; router partial failure, auth, rate-limit and timeout; Coupang states.
- **Successful live fetch:** IKEA detail only.
- **Normalization with evidence:** IKEA, 2 records.
- **Rendering in the app:** wired, but not yet verified on a phone.

## Draft contract (additive to `DiscoveryProduct`)

- **Identity.** `id` is stable and never derived from title, price or position. Existing formats are unchanged (`demo:x`, `amazon:ASIN`, `ebay:itemId`, `ikea:<feedId>`). New records use `<retailer>:<market>:<retailerProductId>`, e.g. `ikea:kr:10489009` or `ikea:kr:s49010615`, where the `s` prefix marks an IKEA combination. Every colour/cover variant has its own product number and therefore its own `id`; `identity.variant` describes it.
- **Sizes.** `dimensions` holds assembled size in cm. `detailedDimensions` holds seat/arm/back sizes. `packages[]` holds shipping boxes, each with `{articleNumber?, description?, quantity, widthCm?, heightCm?, lengthCm?, weightKg?}`, plus `packageCount`. Package values are never filled from assembled size or vice versa.
- **Money.** `price` is `{amount, currency}`; both or neither. Prices are valid for `identity.market` at `retrievedAt` only.
- **Brand vs seller.** `brand` is the product brand. `seller: {name, isBrandOwner}` is who sells the offer.
- **Delivery.** `delivery.status` is `not_checked`, `destination_required` or `quoted`. A quote is valid only for the stated `destination` and `checkedAt`. Unknown delivery is `not_checked`, never "unavailable".
- **Missing values.** The field is **omitted** (never 0, `''` or a guess) **and** listed in `missingFields[]` as `{field, reason}`, with reason `not_published`, `not_applicable`, `destination_required`, `access_blocked`, `conflicting_sources` or `not_extracted`. Consumers must treat absence as "needs confirmation", not false. This matches current consumers, which already treat these fields as optional.
- **Evidence.** `evidence[]` has one or more entries per important field: `{field, status, method, sourceUrl, retrievedAt, market, variantId, sourceLabel, originalValue, derivedFrom?, note?}`.
  - `status` is `retailer_reported`, `independently_checked`, `derived` or `unverified`. `retailer_reported` means published by the retailer, not measured by us.
  - Unit conversions are `derived`, keep `originalValue`, and name their source.
- **Conflicts.** `conflicts[]` keeps every disagreeing statement. If two retailer statements of a value disagree, the value is omitted with reason `conflicting_sources`. One exception: approximate wording in a description (e.g. "about 115 cm") is recorded as a conflict, while the measurement-table value is kept.
- **Data mode.** `dataMode: 'verified_snapshot'` means it was read once from a public retailer page and reviewed by a person. It is not live; see `retrievedAt`.
- **Source status.** `SourceStatus.reason` (optional) is `access-denied`, `rate-limited`, `timeout`, `network`, `parse`, `no-results`, `unavailable` or `snapshot`.

### Questions for 윤선
1. Is "omitted + `missingFields`" acceptable for the evaluator, or do you prefer explicit `null`s?
2. Should `checks` cite `evidence` entries (for example by `field`) so that "needs confirmation" can name the missing or conflicting field?
3. Which clearance should be compared against the home profile's doorway/elevator: the largest package (`max(widthCm, heightCm)` across packages) or something else? We provide the raw package boxes only and do not compute fit.
4. Do you need `detailedDimensions` (seat height etc.) in the first evaluator, or can it come later?

## The two records (`records/ikea-kr-verified.json`, retrieved 2026-11-27T06:29:07Z)

| | GLOSTAD 2-seat sofa, Knisa dark grey | KLIPPAN 2-seat sofa, Vissle grey |
|---|---|---|
| id | `ikea:kr:10489009` (ART 104.890.09) | `ikea:kr:s49010615` (SPR 490.106.15) |
| Price | 150,000 KRW | 299,000 KRW |
| Assembled W × D × H | 121 × 78 × **missing** cm | 180 × 88 × 66 cm |
| Packages | 1 package: 66 × 21 × 118 cm, 20.15 kg | 2 packages: frame 89 × 35 × 181 cm, 45.44 kg; cover 37 × 4 × 57 cm, 2.18 kg |
| Ground clearance | 23 cm | 11 cm |
| Materials / care | yes / yes | yes (per component) / yes (frame, removable cover) |
| Missing | overall height (`not_published`), storage capacity, delivery cost/time | storage capacity, delivery cost/time |
| Conflicts | description says the package is "about 115 × 65 cm, under 20 kg"; the table says 118 × 66 cm, 20.15 kg (both kept) | none |

## Using the records in an evaluator (no retailer fetching)

```ts
import { loadVerifiedRecords } from '../server/src/discovery/verifiedRecords.ts'; // or read records/ikea-kr-verified.json
import type { DiscoveryProduct } from '../shared/discovery.ts';

const [glostad, klippan] = loadVerifiedRecords();          // validated, offline
const largestBox = (p: DiscoveryProduct) => p.packages?.map((b) => [b.widthCm, b.heightCm, b.lengthCm]);
const needsConfirmation = (p: DiscoveryProduct, field: string) =>
  p.missingFields?.some((m) => m.field === field) || p.conflicts?.some((c) => c.field === field);
// evaluateProduct(glostad, homeProfile, preferences): the height check -> needs confirmation (dimensions.heightCm is missing)
```

## Commands

```sh
cd server
npm test && npm run typecheck
# Refresh one IKEA record (ONE live request; review the output before replacing the committed record):
node src/discovery/ikea/snapshot.ts https://www.ikea.com/kr/ko/p/glostad-2-seat-sofa-knisa-dark-grey-10489009/ sofa
```

Configuration names (server-only, in the ignored `server/.env`): `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_PARTNER_TAG`, `AMAZON_MARKETPLACE`, `AMAZON_CREDENTIAL_VERSION`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `IKEA_CATALOG_PATH`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`. None of these belong in the app or in `EXPO_PUBLIC_*` variables.

Out of scope here: evaluation, home profiles, saved comparisons, fit/walkway calculation, and image generation for retailer products.
