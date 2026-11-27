# Codex-Hackathon

Native Expo furniture visualization hackathon project.

## Current sprint: photo → curated candidates → edited-room alternatives

- **Josephine:** native app flow, measurements, request form and integration (`mobile/`, to be supplied).
- **Anna:** photo preparation, result cards, comparison and generation controller (`mobile/`, to be supplied).
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
