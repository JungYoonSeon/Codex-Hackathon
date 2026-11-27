# Persona and integration QA

Run the automated suite first. These manual checks require the teammate's UI; they have not been run against an app yet.

| Persona | Scenario | Expected behavior |
| --- | --- | --- |
| First-time user | Uploads photo without measurements | Can preview; fit clearly says not checked |
| Small-space renter | Uses compact desk in 160 × 90 cm area | Physical pass, usage warning for chair space |
| Careful buyer | Chooses an exact-width item | Tight-fit warning and remeasurement action |
| Shopper comparing choices | Switches compact desk to oversized desk | Dimensions and findings update immediately |
| User planning near a door | Marks door rectangle and overlaps it | Door warning identifies both objects |
| User moving furniture | Moves item away from conflict | Old warning disappears |
| User using keyboard/screen reader | Selects item and opens findings | Controls labeled, focus visible, warning text available without color |
| Mobile user | Edits measurements and views result | Units visible, numeric input usable, findings don't hide controls |

## Integration checks

- [ ] Photo resizing never changes actual furniture dimensions or fit result.
- [ ] 0°/90° rotation swaps displayed metric width and depth; usage side rotates too.
- [ ] Unconfirmed measurements, empty catalog selection, and invalid stored data never show pass.
- [ ] Existing items intended for removal are removed from obstacles/placements before checking.
- [ ] Items that stay are represented explicitly as obstacles or placements.
- [ ] Unknown doors remain visibly unchecked; no broad “door-safe” claim.
- [ ] A footprint pass and usage warning are displayed separately.
- [ ] Clicking a warning highlights all available IDs listed in `objectIds`.
- [ ] Unit conversion occurs once; a repeated render does not reconvert centimeters.
- [ ] Fictional catalog and schematic assets are labeled as demo data.
- [ ] App handles portrait photos, large uploads, and failed uploads without losing layout state.
- [ ] Original photo remains available for comparison; delete behavior matches the app's storage policy.

Automated tests cover geometry and data only. Photo realism, uploads, mobile interactions, and accessibility require UI verification.
