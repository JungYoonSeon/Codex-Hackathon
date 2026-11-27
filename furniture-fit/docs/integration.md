# Integration contract

## Minimal input flow

1. Upload a room photo in the app. This module never receives or stores it.
2. Choose a catalog product; dimensions come from the catalog.
3. Enter the available rectangular area's width and depth in centimeters and confirm measurement. Photo markings alone are not metric measurements.
4. Use the top-down diagram to place and rotate the furniture. Keep photo placement controls independent of metric placement.
5. Optionally mark nearby fixed obstacles and door-clearance rectangles. Mark only the portion inside the measured area. A rectangle is conservative user-specified reserved space, not an automatically inferred door swing.
6. Render the physical-fit result, usage-fit result, findings, and limitations together.

No photo analysis is required. No global room dimensions are inferred. Changing measurements must represent an actual user measurement, never an automatic adjustment to make a result pass.

## Geometry

- All dimensions and coordinates are centimeters. Convert other units before calling.
- Space origin is top-left, x increases right, y increases down.
- Placement x/y is the top-left of the footprint AFTER rotation. Rotation is clockwise, 0 or 90 degrees. Toggling rotation preserves that anchor unless the UI explicitly computes a new one.
- Width/depth swap at 90°. Original bottom clearance moves to the left.
- Footprint geometry is authoritative. Photo cutout drag/resize is visual only.
- For a diagram drawn at `scale` pixels per cm, metric position is `(pointer - diagramOrigin) / scale`; account for drag offset. Do not use this conversion on a perspective room photograph.
- Catalog IDs are unique. Placement IDs and reserved-zone IDs share a unique scene-ID namespace.
- `checkFit` expects the declared typed structure. Validate arbitrary JSON shapes at your API/storage boundary; its internal checks handle invalid numeric values and references, not arbitrary absent containers.
- Catalog schematic paths are relative to this module. Copy assets to the app's public directory or resolve through its bundler; adjust URLs accordingly.

## Rules and result rendering

| Rule | Behavior |
| --- | --- |
| Unconfirmed/invalid space | `not-checked`; no green pass |
| Invalid item/placement/zone | `not-checked`; correct data before checking |
| Outside measured rectangle | Physical failure |
| Furniture footprint overlap | Physical failure, one finding per pair |
| Footprint inside marked obstacle/door rectangle | Physical failure |
| Usage envelope outside space or intersects another footprint/zone | Usage warning |
| 2 cm or less total spare space along either axis | Remeasurement warning |

Contact at an edge is allowed. Numerical epsilon is 0.000001 cm, solely to absorb floating-point rounding. It is not a safety allowance. Two empty usage envelopes may overlap: the MVP assumes activities can happen at different times. Footprints cannot overlap, even for items that could physically nest, such as a chair under a desk. This conservative limitation should be stated if offering such layouts.

`status` is `does-not-fit` for physical errors, `needs-review` for warnings, `fits` when checks pass, and `not-checked` for incomplete/invalid input. `usageFit` is `not-checked` when physical fit fails. When surroundings have not been reviewed, a physical pass applies only to the marked space: keep that limitation visible. No result checks height, walkways, delivery access, or unmarked room features.

Suggested UI headings:
- fits: “Fits within your measured space”
- needs-review: “Footprint fits — review the warnings”
- does-not-fit: “Placement conflicts with your measured layout”
- not-checked: “Fit not checked yet”

Use text and icons as well as color. Findings contain ready-to-use `message`, `action`, and IDs to highlight. Recompute after every metric placement, rotation, measurement, or zone update. Treat results as derived state to avoid stale warnings. The checker does not mutate input.

## Product data and future extension

All eight products are fictional demonstration items. Usage allowances are illustrative, not manufacturer requirements or accessibility standards. The compact desk includes 75 cm behind its front edge for chair use; do not also treat an explicit chair in that same area as automatically permitted. For now, demo the desk allowance without adding a chair footprint.

To adopt real products, expand `dimensionSource` to explicit verified provenance and add source URL/model/SKU metadata. Supply actual cutouts or 3D assets separately. Arbitrary-angle rotation, irregular rooms, door arcs, vertical clearance, furniture nesting, and automatic photo-to-floorplan mapping are outside this version.
