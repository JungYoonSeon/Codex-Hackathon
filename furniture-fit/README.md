# Furniture fit kit

Framework-independent TypeScript data and logic for the hackathon's photo-preview + measured-space experience. No runtime packages, model training, API keys, or network calls. The repository contained only its initial README when this module was added; no existing UI was available to wire up.

## Quick start

Requires Node 24+ for running TypeScript directly (type stripping, not type checking).

```sh
cd furniture-fit
npm test
npm run demo
```

From your app, import the module directly:

```ts
import { checkFit, sampleCatalog, fixtures } from './furniture-fit/src/index.ts';
import type { FitInput } from './furniture-fit/src/index.ts';

const state: FitInput = structuredClone(fixtures.comfortableDesk);
const result = checkFit(state);
// result.physicalFit === 'pass'; result.usageFit === 'pass'
// Render findings AND limitations; highlight each finding's objectIds.
```

Adapt the import path to your app. Modern TypeScript bundlers can consume source directly; projects that type-check imports ending in `.ts` need `allowImportingTsExtensions` with `noEmit` (or an equivalent compatible TS configuration). This kit deliberately does not change the application's build configuration or add a root package manifest.

## Files

- `src/types.ts`: shared contract and unit conventions.
- `src/catalog.ts`: eight fictional products, dimensions, illustrative usage allowances.
- `src/fit.ts`: pure geometry checker, findings, and warning copy.
- `src/fixtures.ts`: five deterministic scenes for development and demo.
- `assets/*.svg`: original, schematic top-down product drawings. These are NOT realistic photo overlays.
- `tests/fit.test.ts`: focused behavior tests using Node's built-in runner.
- `docs/integration.md`: UI mapping, rules, and limits.
- `docs/qa-checklist.md`: persona and integration QA.
- `docs/demo-script.md`: two-minute demo and fallback.

## Scope

Checks a measured rectangular area with rectangular footprints, optional obstacles and door-clearance rectangles, and 0°/90° rotation. Pass means “fits in the entered area under these assumptions.” This is not room reconstruction, photorealistic image editing, a delivery-path check, or accessibility certification. Prepare separate furniture photo cutouts for the baseline's photo editor.
