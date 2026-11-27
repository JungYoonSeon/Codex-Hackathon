# 90-second demo — 윤선 narration

## Before judging

Start the backend; confirm /health from the actual phone. Keep the last working Expo app open. Have a known sample photo/request and reviewed saved outputs ready. Current bundled outputs are illustrated placeholders, visibly labeled as such; use them only to demonstrate UI states, not to claim AI editing worked. Complete the live smoke test and visual review before calling the live route proven.

## Script

**0–15 seconds — Josephine operates, 윤선 narrates**
“Buying furniture is hard when you can’t picture it in your room. We start with room measurements—four meters by three meters.”

**15–30 seconds**
“Choose your room photo, then ask for a sofa. Alex prefers something compact and beige.”
Show the photo-sharing explanation naming OpenAI. If using the sample, announce it and apply its dimensions.

**30–50 seconds**
“We filter a small demo catalog by category and dimensions, including rotated orientation, and rank recognized preferences. The app returns two alternatives and creates them one at a time.”
Candidate cards appear immediately. Say “Creating option one of two”; do not promise that generation fits this presentation slot.

**50–75 seconds — Anna demonstrates comparison**
“Each option starts from the same original room photo. Compare the original and furnished versions here.”
Toggle using buttons. If one fails, keep the other visible and demonstrate explicit Retry. If generation is still running, announce exactly which saved example you switch to; never silently replace the personal room.

**75–90 seconds — limitations**
“The measurements reject obviously oversized candidates. The image is illustrative: it does not certify exact product likeness, placement, doorway clearance or physical fit.”

## Fallback wording

Without live API access: “This is a saved illustrated example showing the flow; live personalized generation is not configured yet.”
With reviewed saved AI outputs: “These are previously generated results for this exact sample room, shown to avoid waiting during the presentation.”

## Handoff questions

- No trained vision model: the server calls an existing image-edit service with room and product references.
- Keys remain on the server; the phone has only the API origin and restricted demo-session authorization.
- Exactly four fictional products, two chairs and two sofas; no retailer/inventory claim.
- Existing objects and room geometry are not measured by the recommendation filter.
- Phone and real image-edit quality are acceptance gates, separate from automated server tests.
