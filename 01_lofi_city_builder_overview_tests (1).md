# Lo‑Fi Vector City Builder — Overview + Testable Functionality (V1 & V2)

## Product intent
A lightweight **planning sim disguised as a map doodle**. You generate believable terrain, place districts and infrastructure, simulate growth over discrete time steps, and export compelling artifacts (PNGs + GIF timelapses).

**Architecture stance (locked in):**
- **Server‑side generation from day 1**
- **Python backend** (FastAPI) as the source of truth for generation + persistence + tile locking
- Web prototype first; design shared logic to keep an iOS path open

---

## Core principles
- Clean vector cartography with **handwritten‑style labels everywhere**
- Procedural generation + user intent (seed placement), not strict zoning
- Deterministic simulation given a world seed + generation parameters
- Metrics that guide (V1), deeper “needs” and constraints (V2)
- Exportable artifacts as first‑class outputs (PNG + GIF)

---

## System overview (V1)

### Services
- **Web app** (React + TS + PixiJS): rendering, UI, local edit buffer, export
- **API** (FastAPI): CRUD, tile locking, orchestration of jobs, auth/session
- **Worker** (Python, same codebase): heavy jobs — terrain (3×3), district placement, growth, VMT‑lite recompute
- **Postgres**: persists world/tile state + op history + lock state
- Optional later: Redis/queue for scaling jobs (can start with DB‑backed job table)

### World model
- Infinite grid of **50mi × 50mi tiles**
- Generating a tile generates the **3×3 neighborhood** (seamless borders)
- Center tile is editable; neighbors visible but locked
- Snap placement to existing geometry (rivers/coast/roads/contours/district boundaries)

### Historic districts
- Districts can be flagged **Historic**
- During growth: historic districts do not redevelop/densify
- Still participate in trips/metrics

### Organic growth
- Discrete simulation steps: **1 / 5 / 10 years**
- Adds: infill, expansion, connectors, supporting POIs
- Respects terrain, water, and historic districts
- Writes a **growth changelog** and a deterministic **replay timeline**

### Transportation + metrics (VMT‑lite in V1)
- Store road/transit as graphs (nodes/edges with geometry + length + class)
- Create OD demand with a gravity model between districts
- Route car trips on the road graph (shortest path)
- Metrics:
  - **Total VMT**
  - **VMT per capita**
  - Transit ridership proxy (access‑based) in V1

### Replay + exports
- Replay growth as timelapse
- Export current map view as **PNG**
- Export replay as **GIF**

### Style & personality
- Handwritten font labels (deterministic placement)
- Personality sliders that bias generation:
  - Grid ↔ Organic (road topology bias)
  - Sprawl ↔ Compact (density + distance decay)
  - Waterfront bias
  - Park priority
- **Regional flavor presets** (late V1)

---

# V1 — Testable functionality (additions + key items)

## Backend / infra
1. API can create/read worlds and tiles.
2. Tile locking works: only one editor at a time.
3. Generation jobs run server‑side and persist results.
4. Jobs are durable: restart API/worker and job state remains consistent.

## Terrain (3×3)
5. Generate terrain for center tile and 8 neighbors; borders align seamlessly.
6. Rivers flow downhill; lakes sit in basins; beaches align to coasts.

## Placement + snapping
7. Seed placement snaps to geometry and produces plausible districts/POIs.
8. Historic flag prevents redevelopment during growth.

## Growth + replay
9. Organic growth (1/5/10) expands city plausibly.
10. Replay timeline renders and exports to GIF.

## Metrics (VMT‑lite)
11. VMT and VMT/capita compute and change plausibly with edits and growth.

## Exports
12. Export PNG at multiple resolutions.
13. Export GIF timelapse.

---

## V2 overview (high‑level)
- “Needs” system (health/education/parks/transit access) and soft constraints
- Better transit rules + mode choice + congestion proxy
- Road/transit drawing tools with snapping (V1.5→V2)
- Mock 3D view + mock street view (stylized)
- Multiplayer depth beyond tile locking
