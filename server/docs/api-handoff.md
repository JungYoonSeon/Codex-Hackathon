# Exact handoff to Josephine and Anna

## Authentication and endpoint origins

Public `GET /health`; `POST /recommendations` and `POST /preview` require `Authorization: Bearer <DEMO_SESSION_TOKEN>`. Ask the operator for the restricted session token, not the provider key. The demo token must be entered at runtime or distributed privately; it is not a production identity system. The mobile origin is `EXPO_PUBLIC_API_URL`. Do not manually set multipart Content-Type: fetch supplies its boundary.

## Matching

`POST /recommendations`, `Content-Type: application/json`:

```json
{"room":{"widthCm":400,"lengthCm":300,"heightCm":260},"request":{"category":"sofa","description":"compact beige"}}
```

Response: `{"candidates":[Candidate, Candidate],"notice":"..."}`. See sample-recommendations.json for the actual checked response. Return zero, one, or two candidates; do not assume two. No photo is sent for matching. No-match returns 200 with `candidates: []` and a useful notice. A clear category conflict is a 400 `CATEGORY_CONFLICT`.

Category is authoritative. Dimensions accept either orientation and known heights. Recognized English color/style tags refine ranking; unknown/negated preferences fall back to category/dimensions. This is deliberately not full natural-language understanding. Equal scores use catalog order. This check rejects obviously oversized products only, not existing furniture, access routes, exact placement, or fit.

## Native photo upload

`POST /preview`: exactly two multipart parts: `metadata` (JSON string) and `photo` (JPEG bytes).

Metadata:

```json
{"requestId":"attempt-A-1","inputVersion":3,"room":{"widthCm":400,"lengthCm":300,"heightCm":260},"request":{"category":"sofa","description":"compact beige"},"optionId":"sofa-linen"}
```

React Native upload shape (adapt the token source to session state):

```ts
const form = new FormData();
form.append('metadata', JSON.stringify({ requestId, inputVersion, room, request, optionId: candidate.id }));
// React Native's native FormData accepts a URI-backed file descriptor.
form.append('photo', { uri: photo.uri, type: 'image/jpeg', name: 'room.jpg' } as unknown as Blob);
const response = await fetch(`${apiOrigin}/preview`, {
  method: 'POST', headers: { Authorization: `Bearer ${demoToken}` }, body: form, signal,
});
```

Sending `{uri:'file://...'}` as JSON does not upload image bytes. Normalize orientation/JPEG in Anna's photo module first. The backend decodes and normalizes again for defense against malformed input. Reference files always come from the server catalog; client URL/file path fields are rejected.

Success response:

```json
{"requestId":"attempt-A-1","inputVersion":3,"optionId":"sofa-linen","imageBase64":"<actual image bytes as base64>","mimeType":"image/jpeg","mode":"live"}
```

MIME may also be PNG/WebP if the actual provider output uses those formats. Render `data:${mimeType};base64,${imageBase64}`. Do not put it in route parameters or logs. Always send the original photo for option B, never option A's generated output.

## Response/state expectations

- Render candidate cards immediately after recommendations.
- Generate sequentially; A can fail and B can still proceed.
- Per attempt: unique requestId, captured inputVersion, current optionId.
- Reject responses with mismatched requestId/inputVersion/optionId before updating UI.
- Input edits/reset invalidate results and abort client fetches. Provider work/cost may continue after cancellation.
- No automatic retries: explicit Retry creates a fresh requestId; successful sibling options stay visible.
- Server does not persist images or re-deliver an earlier result. A duplicate attempt returns 409.
- Progress is waiting/generating/ready/failed, never invented percentages.

## Errors

All server errors use `{code,message,retryable}`. Do not assume all 4xx are unretryable.

| Status | Codes | UI action |
|---|---|---|
| 400 | INVALID_INPUT, CATEGORY_CONFLICT, NO_MATCH | Correct inputs; rematch as appropriate |
| 401 | UNAUTHORIZED | Enter current demo token |
| 409 | DUPLICATE_REQUEST | Explicit retry with new attempt ID |
| 413 | UPLOAD_TOO_LARGE | Resize/reselect photo |
| 429 | BUSY, RATE_LIMITED | Keep cards visible; allow later explicit retry |
| 502 | PROVIDER_FAILURE, INVALID_OUTPUT | Show actionable message and retry when permitted |
| 503 | LIVE_UNAVAILABLE | Explain live setup unavailable; offer sample mode explicitly |
| 504 | PROVIDER_TIMEOUT | Keep other successes; offer explicit retry |
| 500 | INTERNAL_ERROR | Recoverable generic error; no internal details |

## Fixture mode

Copy room.jpg and the two labeled sample outputs into mobile assets; use `SAMPLE_PHOTO_ID` and apply `SAMPLE_REQUEST.room` only after user confirmation. `createFixtureService` accepts the candidate list and an imageBase64 map loaded by the client. It matches source, photo ID, dimensions and request, and returns `saved_demo`. Never call it as an automatic fallback for a user photo. These assets are illustrated UI fixtures, not proof of image-edit feasibility. Replace them with visually reviewed live sample outputs after the smoke test, retaining the saved-example UI label.
