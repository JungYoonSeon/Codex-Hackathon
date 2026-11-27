# Home fit and comparison handoff

Branch: `feature/home-fit-comparison`. This module deliberately does not edit the root app/navigation, retailer adapters, discovery UI, package manifests at the repository root, or existing shared discovery types. The integrator owns mounting the screen in the baseline.

## Run independently

From the repository root, with existing dependencies installed:

```sh
cd src/features/home-profile/demo
npm start
```

Open in Expo Go. Choose “가상 예시 측정값으로 둘러보기” to load explicitly fictional measurements and two fictional sofas. This runs a separate entry point; the baseline app is unchanged.

## Mount in the baseline

```jsx
import HomeFitWorkspace from './src/features/home-profile/HomeFitWorkspace';
import { adaptDiscoveryProduct } from './src/features/product-evaluation/adaptProduct';

<HomeFitWorkspace
  products={discoveryProducts.map(adaptDiscoveryProduct)}
  onBack={() => setScreen('previous-screen')}
  roomPhoto={{ photoId: roomPhotoId, source: { uri: roomPhotoUri } }}
  previewImages={{
    [candidateAId]: {
      photoId: roomPhotoId,
      source: { uri: candidateAImageUri },
      mode: 'live',
    },
    [candidateBId]: {
      photoId: roomPhotoId,
      source: { uri: candidateBImageUri },
      mode: 'live',
    },
  }}
/>
```

Photo props are optional. `source` accepts React Native Image sources. Each generated preview must have the original photo's stable `photoId` and be keyed by the matching product ID. Use `saved_demo` for canned imagery. Mismatching photos are not displayed. The module consumes preview images; it does not call the generation server.

## Data boundary with the retailer teammate

`shared/home-profile.ts` and `shared/product-evaluation.ts` are additive contracts. `adaptDiscoveryProduct` reads existing discovery records without changing their contract. Alternatively provide normalized `EvaluationProduct[]` directly.

Optional enrichment fields on discovery records:

- `dimensions: { widthCm, depthCm, heightCm }` (or current top-level dimensions), `packages: [{ id, name, widthCm, depthCm, heightCm }]`, `packagesComplete`.
- `price: { amount, currency }`; `delivery: { fee, tax, available, region, service, days }`. Fee/tax use the same money shape. Service is `doorstep`, `room`, or `assembly`.
- `materials: string[]`, `careInstructions`, `careDifficulty: low | moderate | high`, `washableCovers`, `scratchResistant`, `roundedEdges`, `requiresAnchoring`, `groundClearanceCm`, `storageCapacityLiters`.
- `evidence` keyed by field path, for example `dimensions.widthCm`, `packages.0.widthCm`, `packagesComplete`, `price`, `delivery.fee`, `washableCovers`. Each entry may contain `source`, `sourceUrl`, `checkedAt`, and `note`.

```js
evidence: {
  'dimensions.widthCm': {
    source: 'supplier',
    sourceUrl: 'https://retailer.example/product',
    checkedAt: '2026-11-27T00:00:00Z',
  },
}
```

Use supplier evidence only for facts actually supplied by that source. Missing facts stay unknown. Values without field provenance are user-reported and cannot establish a confirmed fit. Demo records remain demo evidence. Do not substitute assembled furniture dimensions for package dimensions or assume missing shipping/tax is zero.

## Features

- Reusable local room profiles, measurement provenance, door-swing/obstacle rectangles, complete-route flags, delivery segments, and per-product placements.
- Room bounds, height, obstacle/door-swing overlap, and a straight walkway strip on the selected side.
- Delivery screening for each package through doors/corridors/elevators/stairs, including clearance allowance. Turns/stairs require further confirmation.
- Neutral within-category sorting by conflicts and missing evidence, lifestyle compatibility, then known comparable total cost. No brand or store weighting; no currency conversion.
- Preferences for budget, delivery region/service/time, pets, washable covers, scratching, children, anchoring, robot clearance, storage volume, and care.
- Evidence and recommendation reasons; two-candidate room diagrams, original/A/B photos when provided, cost/material/care/delivery comparison, saved comparison pairs.

Profiles and comparison IDs persist locally; photos and historical product prices do not. Native storage uses the FileSystem native module provided by the current Expo environment. Web uses localStorage. An integrator can supply `store={createHomeProfileStore(keyValueAdapter)}` with async `getItem`/`setItem` methods for another storage backend. Device persistence still needs verification on the target app build.

## Ownership and integration

This branch owns only `shared/home-profile.ts`, `shared/product-evaluation.ts`, `src/features/home-profile/`, `src/features/product-evaluation/`, `src/features/comparison/`, and `src/storage/homeProfiles.js`. Retailer imports/search and root navigation remain the teammate/integrator's responsibility. Root dependency files were not changed.

Measurements use centimeters, top-left room origin, x rightwards/y downwards, and 0/90-degree placements. Photos are visual previews, not a source of accurate measurements. Door-swing rectangles are conservative user-entered areas. Walkway checks do not prove a connected walking route. Package checks do not solve continuous 3D movement, diagonal rotations, stairs or turns, elevator weight limits, or delivery-service guarantees. Unchecked geometry and missing evidence remain “확인 필요”.

## Short demo script

1. Load the fictional example profile; show room measurements, delivery route, and pet/robot/budget preferences.
2. Compare the two sofas: A has a 140 cm straight walkway and KRW 420,000 known total; B has 120 cm and KRW 770,000.
3. Open B's explanation: its shipping box conflicts with entered doorway dimensions; budget, room-delivery preference, washable cover, and robot clearance also differ.
4. Show that A still requires confirmation for the elevator turn. Neither candidate gets an invented confidence percentage.
5. Edit a candidate placement to demonstrate a room/door-swing conflict, then restore it.
6. Save the comparison and reopen it using the saved room profile. With actual image props wired by the integrator, switch original/A/B for the same photo.

Validation: root TypeScript check and standalone iOS Metro export pass. The sample evaluation was executed directly. No new test files were added; no on-device UI/persistence verification has been completed.
