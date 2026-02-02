# V2 Improvements — Expanded Roadmap (with 3D/Street View)

All V2 work assumes V1’s Python backend + worker + Postgres foundation.

---

## V2 Milestone 1 — City Needs System (soft constraints)
Needs:
- Healthcare access
- Education access
- Park access
- Transit access

Behavior:
- Needs generate warnings + suggestions (no hard failure by default)
- Growth heuristics prefer satisfying unmet needs
- Optional difficulty toggle later

---

## V2 Milestone 2 — Transportation realism
- Congestion proxy (edge load → travel time)
- Capacity limits by road class
- Mode choice refinement (logit)
- Stop spacing rules by rail/subway type
- Service quality assumptions (headways) for better ridership

---

## V2 Milestone 3 — Network editing tools (V1.5→V2)
- Draw arterials/local roads with snapping + auto intersections
- Draw rail/subway lines with stop placement tools
- Auto‑fill local streets inside a district boundary after arterials

---

## V2 Milestone 4 — Mock 3D View (stylized)
Goal: a satisfying “city model” view derived from 2D data.

- Generate building footprints inside district polygons
- Extrude buildings by density + transit proximity + downtown distance
- Isometric camera and simple lighting/shadows (fake)
- Toggle 2D ↔ 3D; keep it fast and deterministic

---

## V2 Milestone 5 — Mock Street View (stylized)
Goal: click a road segment and get a coherent streetscape.

- Select road segment → compute context (road class, adjacent district types, density, landmarks)
- Procedurally assemble a streetscape scene (buildings, trees, sidewalks, signage)
- Render a static first‑person frame + pan left/right
- Add “mood” toggles (time of day / weather) without simulation complexity

---

## V2 Milestone 6 — Soft failure states (optional)
- Gridlock spiral (if enabled)
- Flood risk warnings near rivers/coast
- Heat island proxy (low canopy + high density)
- Pollution/health impacts as overlays

---

## V2 Milestone 7 — Multiplayer depth beyond tile locking
- Review/merge workflow for tile changes
- Comments/annotations
- Presence indicators (viewers, last editor)
- If needed later: op‑based merges for sub‑tile edits

---

## V2 Milestone 8 — Visual + export upgrades
- Paper texture overlay + ink jitter presets
- Better label collision avoidance and style packs
- Multi‑tile “poster export” (PNG) with title block, legend, scale bar
- Optional “print layouts”

---

## V2 Milestone 9 — LLM augmentations (bounded)
LLMs should not generate core geometry. Use them for:
- Naming neighborhoods/parks/stations
- “Planner notes” explaining growth decisions
- Suggestions for next build based on needs/metrics
