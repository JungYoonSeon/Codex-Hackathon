# Connected room journey

The root `App.js` now mounts `RoomJourney` on `feature/home-fit-comparison`. The latest modular homepage from `origin/main` is incorporated on this feature branch; main is not changed by this work.

## User flow

- Home has independent persisted rooms, initially Home Office and Bedroom. Create, rename, change type/style, or delete rooms. Deleting a room preserves explicitly saved history snapshots until separately deleted.
- Continue opens the room photo with whole-room, corner, or wall-specific shooting guidance. The sample is clearly labeled as an illustration. A new room can be saved without measurements, photos, or furniture.
- Photo Continue opens the visualization workspace, not the legacy illustrative planner. Add room candidates, inspect fit reasons, enter measured placements, compare two products, or request previews.
- Furniture for you and Explore use the active room's mood/color, local catalog tag matching, and optional explicit OpenAI selection. Switching rooms restores their own preferences.
- Measurements & lifestyle opens the fit profile editor. Candidate actions open the existing fit checks, placement editor, and comparison directly. No second unrelated home profile needs to be created.
- Drafts contains rooms and attempted arrangements. Placements/measurement saves and preview requests are recorded. Completed preview outcomes update their request snapshot, including failures. Restore creates a separate copy of the room instead of overwriting current work.

## Data and product boundaries

`projectStore.js` owns versioned room projects and history. Native builds use the Expo FileSystem module included by the current Expo SDK; original photos are copied to persistent app documents and generated base64 previews become local image files. Web uses IndexedDB and durable data URLs. Tokens remain in memory and are not written to project storage. Storage failures remain visible with a retry action. There is no account sync or cloud backup; uninstalling the app/browser-data clearing removes this data.

Retailer code remains in `mobile/FurnitureDiscovery.js`, `shared/discovery.ts`, and `server/src/discovery/`. Those files are unmodified. `FurnitureForYou` consumes the existing authenticated `GET /products` endpoint; Search all stores opens the existing teammate screen. Only the current returned catalog page is ranked. Live errors are shown rather than replaced with fake live results; local sample catalogs are labeled.

Photo visualization now accepts any product returned by the registered retailer catalog. Select up to two candidates, tap each furniture base target on the room photo, and generate independently from the same original image. The server retrieves the registered retailer reference from approved image hosts; a user-uploaded product photo can replace missing/unavailable references. The new `/product-preview` route supports all product categories, image-based target points and rotation. Images remain approximate; measured fit checks are separate. The older saved sofa illustrations remain available via an explicit no-API button.

## OpenAI style selection

`POST /style-recommendations`, with the same Bearer demo token as `/products`:

```json
{
  "mood": "natural",
  "color": "wood",
  "products": [{"id":"catalog-id","name":"Oak chair","category":"chair","description":"Oak finish","tags":["oak","natural"]}]
}
```

Response: `{ "mode": "openai", "items": [{ "id": "catalog-id", "reason": "..." }] }`.

The server requires `OPENAI_API_KEY`. Optional `RECOMMENDATION_MODEL` defaults to `gpt-4o-mini`; use a model supporting Responses API structured outputs. The image provider continues to use `IMAGE_MODEL` separately. The client never receives the provider key. A connected API origin and session token can be entered in Search all stores → connection settings.

Requests accept at most 40 products, return at most 8 unique IDs from that list, time out after 25 seconds server-side / 30 seconds client-side, and have no automatic paid retries. Structured outputs and runtime validation reject unknown/duplicate IDs. A shared session allows one concurrent selection and 60 attempts/hour. Style reasoning does not assert dimensions, safety, delivery, or physical fit. A failure leaves catalog tag ordering clearly labeled.

OpenAI implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs

## Integration notes

Modified integration files: root App, HomeScreen, RoomCard, shared UI palette, photo/dimensions/request/results flow screens, preview live upload adapter, server app/index. Added room and style feature modules and the style endpoint. Retailer provider and product-search files are not edited, so the retailer-data branch can be merged independently; still review the common server app/index entry points when integrating other work.

No new automated test files were added. Use the actual sample path to review the entire frontend without paid generation. Native device storage/camera and real OpenAI generation still require a target-device/live-credentials check.

## Retailer branch merge

`origin/feature/retailer-data` is merged into this feature branch. `retailerEvidence.ts` bridges its evidence arrays, shipping length/quantity/count, materials and care into the evaluator. Conflicting package facts remain confirmation-needed. Destination-dependent delivery stays unknown. IKEA records are verified snapshots, not live search or preview-enabled products. Main remains unchanged.

`IMAGE_MODEL` defaults to `gpt-image-1.5` when not configured. Product image uploads and generation use the existing session token and shared preview rate/concurrency limits. Product IDs must exist in the server catalog; arbitrary client image URLs are not accepted.
