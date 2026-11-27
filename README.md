# RoomReady

A React Native + Expo Go starter for exploring furniture layouts on a phone.

## Run on a phone

1. Install Node.js (LTS) and Expo Go on your iPhone or Android phone.
2. From this folder, run `npm install`.
3. Run `npx expo start` and scan the QR code with Expo Go. Your phone and computer should be on the same network. If the network blocks device discovery, run `npx expo start --tunnel`.

The room photo picker uses Expo Image Picker. Photos are held in app state as a local device URI and are not uploaded or persisted by this prototype.

## Current starter flow

- Home screen with a one-tap sample-room path.
- Room choice screen with sample room, camera, and photo-library entry points.
- Planner with an illustrative 2D room, demo furniture catalog, add/select/move/remove/reset controls, and an explicit catalog-connection placeholder.
- Furniture products and dimensions are illustrative demo data.

The starter UI and the image-edit backend below are not yet wired together; merging them does not complete native end-to-end integration.

## Current sprint: photo → curated candidates → edited-room alternatives

- **Josephine:** native app flow, measurements, request form and integration (current starter: root `App.js`; integration pending).
- **Anna:** photo preparation, result cards, comparison and generation controller (current starter: root `App.js`; integration pending).
- **윤선:** implemented matching/image backend (`server/`) and mobile-safe contracts (`shared/`).

Start with [the backend README](server/README.md), [API handoff](server/docs/api-handoff.md), and [verification status](server/docs/verification.md).

```sh
cd server
npm ci
# Add OPENAI_API_KEY and IMAGE_MODEL to the ignored .env.
# Fresh checkout: copy .env.example and set a random DEMO_SESSION_TOKEN too.
npm test
npm run typecheck
npm start
```

Run `npm run smoke` after configuring credentials for one paid image-edit feasibility check; `npm run smoke -- --two` checks two sequential options and records timings. This has not been run live yet. Native phone integration and reviewed live sample outputs are separate acceptance gates.

The catalog contains four clearly fictional furniture items. Matching filters obviously oversized items; it does not certify exact fit. Included saved images are labeled illustrated examples, not generated photographs.

## Earlier prototype

`furniture-fit/` contains the earlier measured-space/overlap module and its 18 tests. It is retained for reference but is **outside the revised sprint scope**; do not connect its collision or exact-fit UI to this P0 flow.
