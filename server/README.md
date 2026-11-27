# 윤선 — matching and image backend

Node 24+ / Express backend for the native Expo flow. Four fictional catalog products, deterministic matching, multipart photo edits through the OpenAI server SDK, bounded requests, normalized errors, shared contracts, and QA/demo handoff. This supersedes the earlier collision-check approach for the current sprint.

## Run

```sh
cd server
npm ci
# A local ignored .env has been prepared. On a fresh checkout: cp .env.example .env
# Fill OPENAI_API_KEY, IMAGE_MODEL, and a random DEMO_SESSION_TOKEN (32+ characters).
npm test
npm run typecheck
npm start
```

Only put provider credentials in `server/.env`. It is ignored by Git. `IMAGE_MODEL` intentionally has no guessed default: select an image-edit model enabled for the team's account and verify it. If credentials are missing, recommendations and health still work; preview returns `503 LIVE_UNAVAILABLE`. An invalid demo token prevents startup.

`GET http://localhost:3001/health` should return `{"status":"ok","liveConfigured":false,"provider":"OpenAI"}` until keys/model are set. `liveConfigured: true` means configuration exists, NOT that billing/model access has been proved.

Restart the backend after editing `.env`; environment values are read at process startup.

After configuring credentials:

```sh
npm run smoke            # One real paid image edit through a temporary local HTTP server
npm run smoke -- --two   # Two separate paid edits, original room each time, sequentially
```

Smoke tests save images and latency reports under ignored `server/artifacts/`. Inspect the outputs before marking feasibility passed. The supplied sample is an original room illustration, not a real room photograph. Use a team-owned room photograph and rerun through the native app before claiming photographic quality or device completion. No live edit has been run during implementation because the user will add credentials afterward.

## Teammate handoff

- Shared types: `../shared/contracts.ts` (safe for mobile import).
- Exact payloads, authentication, examples: `docs/api-handoff.md` and `docs/sample-recommendations.json`.
- Sample room: `assets/sample/room.jpg`; dimensions 400 × 300 × 260 cm are fictional demo inputs.
- Saved example outputs: `assets/sample/sofa-linen.jpg`, `sofa-sage.jpg`. Both explicitly say illustrated example, not live AI.
- Sample metadata: `../shared/fixtures.ts`; opt-in fixture adapter: `../shared/fixture-service.ts`.
- Persona/device checks: `docs/qa-checklist.md`.
- Demo narration: `docs/demo-script.md`.
- Verification status: `docs/verification.md`.

No mobile screen or navigation was added: Josephine and Anna retain those files. Neither the old `furniture-fit/` catalog nor its exact-fit UI belongs in this revised P0.

## Runtime limits

- One authorized JPEG, maximum 5 MiB; multipart metadata ≤8 KiB; JSON body ≤16 KiB.
- JPEG is decoded, EXIF orientation applied, resized inside 1280 × 1280 without enlarging, and reencoded without metadata. At most 16 million input pixels.
- One active preview/upload at a time, 12 paid attempts per hour per process/session; failed upstream attempts also count. Used request IDs are rejected during the hourly window.
- SDK timeout 165 seconds, application deadline 170 seconds, server duration budget 180 seconds. No automatic paid retries.
- Output ≤8 MiB decoded; actual image MIME is detected and full decoding is checked before sending.
- In-memory processing, no application persistence of user photos or result images. Provider retention is governed separately by OpenAI's policy; do not promise deletion timing.
- No body, image, preference, token, or provider exception logging. Startup logs contain port and configuration status only.

This is a restricted single-process demo server, not a production multi-user authentication or quota system. Limits reset on restart. Keep the session token private and rotate it before sharing a new demo session. A browser CORS policy alone is not access control. Native Expo can use an HTTPS origin without browser CORS.

## Phone/network setup

Keep this persistent process running on the team's machine/runtime and expose it through the team's existing HTTPS deployment or secure tunnel. Set mobile's `EXPO_PUBLIC_API_URL` to that HTTPS origin. `localhost` on the phone is the phone; Expo's app tunnel does not expose this backend. Confirm `/health` from the actual device. Enter the restricted demo-session token at runtime; never put the OpenAI key in the mobile app or any `EXPO_PUBLIC_*` value. Use a host/proxy that allows at least 180 seconds and a response larger than the maximum base64 body (~11.2 MiB). The default listener binds `0.0.0.0`; LAN HTTP can be used only where the device permits it, not assumed as a deployment solution.

## Implementation sources

The provider adapter follows the official [OpenAI image-edit API](https://developers.openai.com/api/reference/resources/images/methods/edit) and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation). Dependencies are locked in `package-lock.json`; an actual enabled model must still be verified by the team.

## Product discovery (new)

The native home screen now opens product discovery: product-name/brand search, 12 categories, retailer filters, product details, retailer links, price sorting within currencies, pagination and a session-only shortlist. The 16 fictional sample products work without backend setup. Real retailer data is never silently replaced with samples.

`GET /products?q=desk&brand=&category=desk&source=all&sort=relevance&page=1` uses the same demo-session Bearer authentication. It returns `products`, per-retailer `sources` connection status, `hasMore`, `page`, and external retailer search `links`. Source values: `all`, `demo`, `amazon`, `ebay`, `ikea`. Shared product schema and categories live in `shared/discovery.ts`. Dimensions and prices are optional: missing data is not inferred.

- **Amazon:** official [Creators API SearchItems](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items), with [OAuth authentication](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl). Add `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_PARTNER_TAG`; set marketplace and credential version as shown in `.env.example`. Account/marketplace API approval is required. Connector implemented; live credentials have not been supplied or validated. This version supports configured US/UK/JP marketplace domains.
- **eBay:** official [Browse API](https://developer.ebay.com/develop/api/buy/browse_api) plus application OAuth. Add `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` for production API access. US marketplace currently. Brand text is included in keyword search, not claimed as a verified brand facet. Connector implemented; live access remains unverified.
- **IKEA:** official-site search links work without a server API key. A public self-service catalog API signup was not confirmed in this research; IKEA's [Knowledge Hub](https://ingress.prod.knowledge.ikea.net/) describes organizational APIs. To use an authorized product feed, set `IKEA_CATALOG_PATH` to an absolute JSON file path. It is a curated feed, not real-time stock. No unofficial IKEA endpoint is called.

In the phone's discovery screen, open **연결 설정** and enter the reachable backend origin and demo-session token. Provider credentials stay server-side. Restart the backend after changing `.env`. Search calls have a 12-second provider budget and 15-second client timeout; one provider's failure does not discard other provider results. Searches are bounded to four simultaneous requests and 60 requests/minute per demo process.

IKEA feed shape (array of records; replace placeholders with verified data you have permission to use):

```json
[{
  "id": "verified-article-id",
  "name": "Verified product name",
  "category": "shelf",
  "description": "Verified description",
  "tags": ["wood"],
  "productUrl": "https://www.ikea.com/kr/ko/p/verified-product-url/"
}]
```

Optional fields: `imageUrl` (IKEA-hosted HTTPS), `dimensions: {widthCm, depthCm, heightCm}`, and `price: {amount, currency}`. Product URLs must be on ikea.com. Do not add guessed prices or dimensions. Prices are current-page listings, grouped by currency without conversion or shipping estimates; confirm them at the retailer.

Discovery/shortlisting does not yet make arbitrary retailer products eligible for the existing image-edit endpoint. That endpoint still uses four owned sample references. External product imagery, measurements and preview eligibility need a separate verified import step before photo generation.
