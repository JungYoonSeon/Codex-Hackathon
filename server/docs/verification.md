# Verification record — 2026-11-27

## Completed locally

- Node 24.12.0; Express server and OpenAI SDK installed with a checked-in lockfile.
- `npm test`: 32 tests passed, covering matching, endpoint behavior, provider request shape, fixture identity, and error paths.
- `npm run typecheck`: passed, including shared contracts and fixture adapter.
- `GET http://127.0.0.1:3001/health`: HTTP 200, `status: ok`, `liveConfigured: false`.
- Server started locally on port 3001; it must be restarted after editing provider configuration.
- Mocked SDK transport verifies original room first, catalog image second, exactly one requested output, and no automatic retry after a provider failure. These are not paid/live provider calls.
- Four original vector furniture references rasterized to PNG; one illustrated room and two visibly labeled saved examples generated locally. One saved example was visually inspected for layout and label readability.
- `server/.env` prepared locally with a generated restricted demo-session token and blank provider credentials. Ignored by Git; no secret values printed.

## Intentionally pending

The user will add provider credentials after implementation.

- Live model/billing access and one successful real edit: **NOT VERIFIED**.
- Two live options, actual latency, room preservation and product likeness: **NOT VERIFIED**.
- Real room photograph quality: **NOT VERIFIED** (bundled sample is an illustration).
- Phone-reachable HTTPS origin, Expo app integration and device accessibility: **NOT VERIFIED**; no mobile baseline exists in this local checkout.
- Reviewed saved AI outputs: **NOT AVAILABLE YET**; bundled examples are explicit illustrated fixtures.

`npm run smoke` without credentials exits with a clear “Live check NOT RUN” message and makes no paid call. After credentials are set, run one edit, then two, inspect artifacts, and update this record. Do not use fixture test success as a substitute for these gates.

## Device/live run record to complete

- Device / OS:
- Expo runtime:
- Backend HTTPS origin:
- Enabled image model:
- Option A elapsed ms:
- Option B elapsed ms:
- Total elapsed ms:
- Viewpoint / walls / windows / doors / lighting preserved:
- Product likeness and unintended-object review:
- Partial failure and explicit retry:
- Stale responses after input changes:
- Reviewer and time:
