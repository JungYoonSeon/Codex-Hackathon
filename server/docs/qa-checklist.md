# 윤선 QA checklist

Automated behavior is covered by `npm test`. Device and live-output checks below remain manual until credentials and the native app are ready.

## Persona checks

| Persona | Action | Expected |
|---|---|---|
| First-time shopper | 4 × 3 meters, own photo, Sofa, compact beige | Two distinct sofas; original room remains available |
| Small-room renter | Dimensions allow only the compact sofa | One honest candidate; no unrelated fill-in |
| User with very small area | Neither sofa passes dimensions | No-match copy, no paid API request |
| User correcting a mistake | Select chair then type “a beige sofa” | Correct-category prompt |
| Privacy-conscious user | Chooses sample instead of personal photo | OpenAI disclosure before generation; sample dimensions confirmed |
| Impatient user | Repeated Generate, edit inputs mid-request | No duplicate paid attempt; stale result cannot overwrite new room |
| User on poor network | A succeeds, B times out | A remains visible; B offers explicit retry |
| Screen-reader user | Reads result and toggles original/furnished | Labels and focus verified by Anna on phone |

## Backend checks

- [x] Four distinct demo entries with local reference images.
- [x] Category, both orientations, height, stable ranking, zero/one/two candidates.
- [x] Unauthorized input, malformed JSON/multipart, invalid dimensions, unknown options.
- [x] 5 MiB cap, type spoofing, decoding, multiple files, extra fields.
- [x] Original uploaded image reaches adapter; alternatives use the same original.
- [x] SDK request includes room first, reference second, one output, automatic retries disabled.
- [x] Identity echo, actual MIME, missing/malformed/oversized-output rejection.
- [x] Timeout, busy response, per-session attempt budget, duplicate IDs, provider error mapping.
- [x] No key/image/request-body logging in application handlers; provider errors redacted.
- [x] Saved mode cannot substitute for personal-photo requests.

## Live/phone acceptance — not yet run

- [ ] Add server credentials; run one paid edit and check enabled model/billing.
- [ ] Run two-option smoke test; record A, B, total latency.
- [ ] Review viewpoint, walls, windows, door, lighting, existing objects, unintended objects, item likeness.
- [ ] Reject visually incorrect output; prompt preservation is not guaranteed.
- [ ] Open HTTPS /health from the demo phone, independent of the Expo tunnel.
- [ ] Actual phone photo → two correctly labeled alternatives; original toggle works.
- [ ] Device orientation, picker cancel, replacement, reset, large text, VoiceOver/TalkBack.
- [ ] Edit photo/request during generation; stale responses are discarded.
- [ ] Deliberately interrupt network; verify partial success and retry.
- [ ] Save reviewed results for the exact sample only, labeled saved demo.

Do not tick device/live items based on mocks or illustrative saved assets. Record device, OS, backend origin, model, timings and reviewer in verification.md after running them; never record keys or personal photos in Git.
