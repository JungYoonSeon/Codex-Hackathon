# Two-minute demo: a desk that fits, but needs room to use

## Preparation

Use a team-owned or permissioned room photo. Load the fictional catalog. Prepare the two measured demo areas as saved scenes, clearly labeled fictional examples. Do not imply the photo supplied measurements. Run `npm run demo` as a deterministic fallback if the UI is unavailable.

## Script

**0:00–0:20 — The question**
“Alex wants to buy a desk. Seeing it in a room helps with style, but a desk also needs room for a chair.”
Upload the photo and choose Compact desk (120 × 60 cm). Show the baseline's visual overlay if implemented. Explain that its photo appearance is approximate; the kit's SVG is a top-down schematic, not a realistic product cutout.

**0:20–0:45 — Minimal measurement**
“Alex measures an available nook: 160 cm wide and 90 cm deep.”
Load `chairSpaceMissing`. Confirm the measurements. The desk starts at x=10, y=0. Show that its footprint is inside the area, while the front 75 cm usage allowance extends beyond it.

**0:45–1:10 — Useful warning**
“The desk physically fits. But this measured nook doesn't include enough room for the chair allowance.”
Show `physicalFit: pass` and `usageFit: review`. Highlight the usage warning. This is illustrative clearance, not an accessibility assessment.

**1:10–1:35 — A better location**
“Alex checks a second, larger available area: 160 by 150 cm.”
Load `comfortableDesk`. This is a different premeasured demo area, not an invented enlargement of the first. Show both checks passing and the unreviewed-surroundings limitation.

**1:35–2:00 — Decision and limits**
“Alex can compare the look and check the measured footprint before buying. The app also tells Alex what still needs checking.”
Show original/preview comparison if available. Keep these limits visible: entered measurements, approximate photo preview, unmarked obstacles, height and delivery route not checked.

## Optional extra scenes

- `doorBlocked`: show a footprint entering a manually marked door-clearance rectangle. This is not automatic door detection.
- `deskTooWide`: physical footprint failure.
- `measurementsMissing`: visual preview can remain available, but fit is not checked.

## Honest answers for judges

- “Did you train a vision model?” No. Geometry checks use supplied dimensions; the preview is a separate UI layer.
- “Is the fit exact?” It is a deterministic check against entered rectangular geometry. Measurement error and unmodeled room features remain.
- “Can it detect doors from a photo?” Not in this version. Doors are user-marked reserved rectangles.
- “Are these real products?” No, this catalog uses fictional sample products and illustrative clearances.
