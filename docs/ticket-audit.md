# Ticket Description Audit — CITY-559

**Date:** 2026-02-09
**Auditor:** Claude (AI agent)
**Scope:** All open tickets (Backlog + In Review)

## Summary

- **Total open tickets audited:** 41 (38 Backlog + 3 In Review)
- **Updated directly in Linear:** 34
- **Already had adequate descriptions:** 3 (CITY-556, CITY-543, CITY-471)
- **Need human clarification:** 2
- **Low-quality descriptions flagged:** 1
- **Tickets with <90% confidence (marked with warning):** 3

---

## Section 1: Tickets Needing Human Clarification

These tickets could not be confidently described (<80% confidence). Please review and add context.

### CITY-539: Station hit test returns first match instead of closest station
**Confidence:** 30%
**Issue:** The ticket title suggests the station hit test returns the first match instead of the closest. However, investigation shows that both `RailStationLayer.hitTest()` and `SubwayStationLayer.hitTest()` already iterate all stations and track the closest match by distance. The actual issue may be a cross-layer priority problem: `MapCanvas.tsx` checks rail stations first (lines 1233-1245), and if a rail station is hit it returns immediately without checking if a closer subway station exists at the same position.
**Questions for human:**
- What is the exact reproduction scenario? (dense cluster? transfer stations? specific zoom level?)
- Is this about within-layer hit testing or cross-layer priority?
- Has this been observed recently, or might the `deterministicBridgeId()` fix have resolved it?

### CITY-463: apply_bay_erosion defined but never called — bays are visual-only
**Confidence:** 20%
**Issue:** The ticket title states that `apply_bay_erosion` is defined but never called. However, investigation shows it IS called in `apps/worker/src/city_worker/terrain/generator.py` at lines 153-162. The function is imported at line 8 and called conditionally when bays are detected and `cfg.bay_enabled` is True. This ticket may be outdated or the original issue may have been different (e.g., bays having no *visible* effect on terrain despite the function being called, due to low `erosion_strength`).
**Questions for human:**
- Is this ticket still valid, or was the underlying issue already fixed?
- Was the original problem that `apply_bay_erosion()` was literally uncalled, or that bay erosion has no visible effect?
- Should this ticket be closed?

---

## Section 2: Low-Quality Descriptions

These tickets have descriptions but they're vague or incomplete.

### CITY-516: Build out mobile views
**Current description:** "Make the app optimized for viewing on mobile as well as on desktop. We'll probably need to leverage Figma for this."
**Issues:** No acceptance criteria, no breakpoints defined, no scope (which pages?), no design specs.
**Needs:** Target devices/breakpoints, which views to prioritize, design mockups or Figma reference, responsive vs. separate mobile layout decision.

---

## Section 3: Tickets Updated Directly in Linear

These tickets were updated with descriptions (>=80% confidence). Tickets marked with ⚠️ were <90% confidence and may need additional context.

### Terrain / Water Features

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-553 | River coastline snapping | 92% | `water.py` lines 440-465 |
| CITY-552 | Districts clipped to rivers | 95% | `FeaturesContext.tsx`, `polygonUtils.ts` |
| CITY-551 | Suppress water on inland preset | 90% | `geographic_presets.py`, `geographic_masks.py`, `generator.py` |
| CITY-550 | Chaikin smoothing iterations | 97% | `water.py` lines 321-341, 501-505 |
| ⚠️ CITY-549 | min_area_cells vs noise filter | 88% | `water.py` lines 1009-1093 |
| CITY-548 | Bay erosion depth/width | 93% | `bays.py`, `geographic_presets.py` |
| CITY-547 | Lake beach perimeter cap | 94% | `water.py` lines 757-889 |
| ⚠️ CITY-490 | Water feature realism epic | 85% | `water.py` (multiple sections) |

### Roads / Bridges

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-556 | Excessive bridges near water features | ✅ | `bridgeDetection.ts` (pre-existing description) |
| CITY-507 | Dashed line per-dash GPU draw calls | 95% | `FeaturesLayer.ts` lines 1142-1183 |
| CITY-488 | Street grid backfill fires multiple times | 90% | `FeaturesContext.tsx` lines 681-808 |
| CITY-487 | Cross-boundary roads stale after reshape | 95% | `FeaturesContext.tsx`, `interDistrictRoads.ts` |
| CITY-486 | Bridge detection drops 3+ crossings | 95% | `bridgeDetection.ts` lines 189-260 |
| CITY-485 | Dual pointInPolygon signatures | 97% | `geometry.ts`, `polygonUtils.ts`, `bridgeDetection.ts`, `interDistrictRoads.ts` |
| CITY-483 | graphToRoads silently drops edges | 95% | `FeaturesContext.tsx` lines 539-574 |
| CITY-478 | Orphaned road nodes after deletion | 95% | `FeaturesContext.tsx` lines 1681-1714, `hooks.ts` |

### Transit

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-542 | Station labels overlap in dense areas | 95% | `RailStationLayer.ts` lines 317-328 |
| CITY-541 | Reverse duplicate segments allowed | 90% | `models/transit.py` line 191, `repositories/transit.py` |
| CITY-540 | Bulk creation bypasses name uniqueness | 95% | `routes/transit.py` lines 272-288 |
| CITY-536 | Transit line name uniqueness (partial) | 98% | `routes/transit.py`, `models/transit.py` |
| CITY-493 | Bridge IDs cause re-renders (appears fixed) | 90% | `bridgeDetection.ts` lines 27-30 |

### Growth Simulation

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-510 | O(n^2) distance checks in growth | 95% | `growth/simulator.py` lines 296-356 |
| CITY-509 | Beach adjacency O(n^2) Python loops | 98% | `water.py` lines 727-743 |
| CITY-484 | Concurrent growth simulations race | 92% | `routes/jobs.py`, `runner.py` |
| CITY-482 | Growth POIs placed outside district | 95% | `growth/simulator.py` lines 603-617 |
| CITY-477 | Growth overwrites concurrent user edits | 93% | `runner.py` lines 369-459, 518-669 |

### POIs

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-476 | POI footprint hit-test area too small | 90% | `FeaturesLayer.ts` lines 1452-1458 |
| CITY-473 | MIN_POI_SPACING too small for footprints | 95% | `poiAutoGenerator.ts` lines 180, 283-287, 324-330 |

### UI Components

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-469 | Establish design tokens system | 90% | `Button.tsx`, `index.css`, no `tailwind.config.ts` |
| CITY-468 | Create shared Input/Select components | 95% | `ui/Input.tsx`, `ui/Select.tsx`, `ui/index.ts` |
| CITY-467 | Create shared Modal wrapper | 95% | `ui/Modal.tsx`, 6 modals with duplicated boilerplate |
| CITY-466 | Create shared Button component | 95% | `ui/Button.tsx`, `ui/index.ts` |
| CITY-543 | Cmd+Z undo support + Delete shortcut | ✅ | `MapCanvas.tsx`, `DrawingContext.tsx` (pre-existing description) |
| ⚠️ CITY-502 | District polygon vertex editing | 85% | `FeaturesLayer.ts`, `RoadEndpointLayer.ts`, `MapCanvas.tsx` |

### Infrastructure / Refactoring

| Ticket | Title | Confidence | Key Files |
|--------|-------|------------|-----------|
| CITY-465 | Inconsistent Point/Position type naming | 95% | `layers/types.ts`, `snap/types.ts`, `api/types.ts` |
| CITY-461 | Shared package never imported (type drift) | 95% | `packages/shared/`, `apps/web/`, `apps/api/` |
| CITY-460 | API client lacks AbortController | 95% | `api/client.ts` lines 104-169 |
| CITY-464 | GET lock endpoint missing ownership check | 98% | `routes/locks.py`, `routes/tiles.py` |
| CITY-471 | Set up production infrastructure | ✅ | N/A — human-only task (pre-existing description, tagged HUMAN) |

---

## Notes

- All descriptions were generated by investigating the actual codebase, not just from ticket titles
- Tickets marked ⚠️ have descriptions that may need refinement — the core issue is identified but some details may be incomplete
- CITY-536 is partially done (DB constraint + single-endpoint validation exist; bulk endpoint validation is tracked separately in CITY-540)
- CITY-493 appears to already be fixed via `deterministicBridgeId()` — may be ready to close after verification
- CITY-463 may be outdated — the function IS called from `generator.py`; needs human review to determine if ticket should be closed
