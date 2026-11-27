# RoomReady

A React Native + Expo Go app (Expo SDK 54, JavaScript) for previewing curated furniture in a photo of your room.

**Flow:** room dimensions → room photo → furniture request → candidate cards → Original / Furnished previews.

## Status (branch `anna/roomready-preview-integration`)

| Area | Status |
|---|---|
| Saved-example flow (sample room, two saved illustrations) | Implemented; unit-tested; iOS bundle builds. **Physical iPhone testing pending.** |
| Live preview adapter (`/health`, `/recommendations`, `/preview`) | Implemented against `server/docs/api-handoff.md`; tested with controlled fake responses only. **Live end-to-end generation NOT verified** (needs provider credentials, a phone-reachable backend and a device run). |
| Backend (`server/`) | 윤선's implementation; see [server/README.md](server/README.md) and [verification status](server/docs/verification.md). |

Saved illustrations are bundled fixtures, not AI output and not proof that live generation works.

## Run the app on a phone

```sh
npm ci
npx expo start            # LAN; phone and computer on the same network
npx expo start --tunnel   # if the network isolates devices (may ask to install @expo/ngrok)
```

Scan the QR code with the iPhone Camera app (or from Expo Go on Android). The installed Expo Go must support **SDK 54**; if it reports an incompatible SDK, note the exact message before changing versions. An iPhone Personal Hotspot is a simple fallback when campus Wi‑Fi blocks LAN connections.

### Saved-example mode (no backend needed)

Home → **Try the sample room (saved examples)** → confirm the preset inputs (400 × 300 cm, 260 cm ceiling, sofa, “compact beige”) → **Show furniture options**. Two candidates appear with saved illustrations, labelled “Saved illustrated example — not a live AI result”. Saved examples are shown only for the sample photo with exactly those inputs; any edit makes them unavailable (with a “Restore sample inputs” button). They are never used for your own photo.

### Live mode (your own photo)

1. Start the backend (`server/README.md`): `cd server && npm ci && npm start`, with `OPENAI_API_KEY`, `IMAGE_MODEL` and `DEMO_SESSION_TOKEN` in the ignored `server/.env`.
2. Expose it at an origin the phone can reach (team HTTPS deployment or secure tunnel). The Expo tunnel does **not** expose the backend, and `localhost` on the phone means the phone itself.
3. Copy `.env.example` to `.env` at the repo root and set `EXPO_PUBLIC_API_URL` to that origin. Restart `npx expo start` (values are inlined at bundle time).
4. In the app, on the request step, enter the restricted **demo-session token** (kept in memory only) and tap **Check server**.

Never put `OPENAI_API_KEY` or the demo token in any `EXPO_PUBLIC_*` value or in Git.

Live previews send the selected photo (re-encoded as a JPEG, longest edge ≤ 1280 px, ≤ 5 MB) to the RoomReady server and OpenAI. Options are generated one at a time. There are no automatic retries; **Retry** on a failed option starts a new paid attempt.

## Checks

```sh
npm test               # mobile controller/adapters: stale responses, sequencing, partial failure, retry, fixture restrictions, live contract
npm run typecheck      # mobile + shared/ (server/ excluded; it has its own)
npx expo install --check && npx expo-doctor
cd server && npm test && npm run typecheck
```

## Code map

- `App.js`: root navigation and shared inputs (`room`, `photo`, `request`, `inputVersion`), plus the earlier 2D planner prototype.
- `src/features/flow/`: `DimensionsScreen`, `PhotoScreen`, `SampleConfirmScreen`, `RequestScreen`, `ResultsScreen`.
- `src/features/preview/previewController.js`: the single owner of result state (snapshot, sequential generation, stale/mismatch rejection, explicit retry, invalidation).
- `src/features/preview/savedExampleService.js` + `sampleScenario.js`: wrap `shared/fixture-service.ts` with the bundled `assets/sample/*` images.
- `src/features/preview/liveService.js`: the backend adapter. `photo.js`: picker and JPEG preparation (`expo-image-manipulator`).
- `src/features/preview/sampleRecommendations.json`: copy of `server/docs/sample-recommendations.json` (a test fails if they drift).

## iPhone checklist (to run on the device)

- [ ] App opens in Expo Go; home screen shows “Make space for what matters.”
- [ ] Sample flow: confirm inputs → two cards (Demo Compact Linen Sofa, Demo Sage Sofa) → both saved illustrations shown, labelled as saved examples.
- [ ] Original / Furnished switch works on each card; images are not cropped.
- [ ] Edit request → change description → results do not reuse the saved images; “Restore sample inputs” brings them back.
- [ ] Own photo: choose, cancel (photo kept), replace, remove (Continue hidden), take photo; portrait and landscape photos preview upright.
- [ ] Own photo without a backend: “Live preview unavailable” with an explicit sample option, and no fake output.
- [ ] Start again returns to dimensions with empty inputs; no crash.
- [ ] Large text (Settings → Display → Text Size) and VoiceOver labels on the comparison buttons.
- [ ] (When the backend is reachable) `https://<origin>/health` opens in Safari on the phone, then a live run with A/B results and a deliberate retry.

## Team

- **Josephine:** native app flow, measurements, request form, final integration. This branch adds a minimal dimensions/request flow; reconcile it with any of her work.
- **Anna:** photo preparation, result cards and comparison, generation controller (this branch).
- **윤선:** matching/image backend (`server/`) and mobile-safe contracts (`shared/`).

The catalog contains four clearly fictional furniture items. Matching filters out obviously oversized items; it does not certify exact fit.

## Earlier prototypes

The 2D planner is still reachable from the home screen as “Earlier 2D planner prototype”. `furniture-fit/` (measured-space/overlap module and its tests) is retained for reference but is **outside the current sprint**; its collision/exact-fit UI is not connected to this flow.

## Product discovery

The home screen now includes **가구 검색 · 브랜드별로 둘러보기** and **내 방 후보 보기**. Search by product name and brand, browse 12 categories, filter retailers, inspect product details and save candidates during the session. Sixteen clearly labeled demo products are available immediately. IKEA/Amazon/eBay search links open the retailer; Amazon/eBay in-app search needs separate retailer API credentials, and IKEA in-app data uses an authorized feed. Configure connections in the discovery screen and `server/.env`; see the product-discovery section in the backend README. External products are not yet connected to photo generation.

The preview flow and product discovery share one in-memory backend origin and demo-session token. Updating discovery connection settings also updates live previews and invalidates previous preview results. Search and the shortlist support many categories; photo generation still uses only the four supported sample chairs/sofas. Saving a retailer product does not pass it to the preview endpoint.
