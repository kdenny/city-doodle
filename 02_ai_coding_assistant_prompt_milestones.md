# AI Coding Assistant Prompt — Lo‑Fi Vector City Builder (Python / Server‑Side Gen)

You are an expert engineer. Build a web prototype for a “lo‑fi vector city builder” that is a lightweight planning sim with VMT‑lite in V1. **All generation runs server‑side**. Use **Python** for the backend and worker.

## Non‑negotiables
- Backend: **FastAPI (Python)**
- Heavy generation: **separate worker process** (Python) from day 1
- Persistence: **Postgres**
- Generation: terrain 3×3, districts, growth, VMT‑lite all run on worker
- Editing: “edit locally and push changes” + server‑side tile lock
- Rendering: React + TypeScript + PixiJS (WebGL) clean vector layers
- Handwritten font labels everywhere (deterministic placement)
- Replay timelapse + export GIF
- Historic districts halt redevelopment during growth

---

## Deployment target (explicit)
- Web app: **Vercel**
- API + Worker: **Fly.io** (recommended) or Render (acceptable)
- Postgres: **Neon** (recommended) or Fly Postgres/Supabase
- Start without Redis; use DB‑backed job queue. Add Upstash Redis later if needed.

---

# Milestone plan (parallelizable)

## Milestone 0 — Repo + scaffolding
- Create monorepo:
  - /apps/web (React TS)
  - /apps/api (FastAPI)
  - /apps/worker (Python worker)
  - /packages/shared (shared types + geometry schemas)
- Add CI (lint + unit tests)
- Define OpenAPI + pydantic models for World/Tile/Jobs/Locks

## Milestone 1 — Core API + DB schema (Backend)
- Postgres schema:
  - worlds
  - tiles
  - tile_locks
  - jobs (DB‑backed queue)
  - ops (optional)
- FastAPI endpoints:
  - POST /worlds, GET /worlds/{id}
  - GET /worlds/{id}/tiles?tx=&ty=
  - GET /tiles/{tile_id}
  - POST /tiles/{tile_id}/lock, POST /tiles/{tile_id}/unlock, GET /tiles/{tile_id}/lock
  - POST /tiles/{tile_id} (push changes; requires lock)
- Job endpoints:
  - POST /tiles/{tile_id}/generate_terrain
  - POST /tiles/{tile_id}/place_seed
  - POST /tiles/{tile_id}/grow
  - GET /jobs/{job_id}

## Milestone 2 — Worker + job runner (Generation/Infra)
- Worker polls DB jobs table, claims jobs with FOR UPDATE SKIP LOCKED
- Executes job types:
  - generate_terrain_3x3
  - place_seed
  - grow
  - recompute_metrics (VMT‑lite)
- Writes results back to tiles table; marks job succeeded/failed with logs
- Determinism rules:
  - world_seed + tile coords + parameters → deterministic outputs

## Milestone 3 — Web app shell + tile browser (Frontend)
- World create/open UI
- Tile navigator (tx, ty)
- Viewport with pan/zoom + tile grid + neighbor tiles rendered as outlines
- Lock UX:
  - Enter edit mode → request lock
  - If locked by other: show read‑only state

## Milestone 4 — Terrain generation (Server) + rendering (Web)
- Worker: generate heightfield in world space, slice 3×3
- Derive vector features: coastline, rivers, lakes, optional contours
- Web: Pixi layers for water/coast/rivers/contours + tile borders
- Layer toggles

## Milestone 5 — Snap‑to‑geometry engine (Web)
- Build spatial index for rendered geometry
- Snap point to nearest eligible feature within threshold
- Visual snap indicator

## Milestone 6 — Seed placement + district/POI generation (Server) + UI
- Placeable types:
  - Residential (density + mix)
  - Downtown
  - Shopping district
  - Hospital
  - University
  - Industrial
  - K12 school
  - Park
  - Trail
  - Train stations (intercity/local hub/regional rail) + line stub
  - Subway stop + line stub
  - Airport (simple runway orientation)
- Historic district flagging:
  - Toggle district.historic = true
- Web palette + inspector panel

## Milestone 7 — Organic Growth (Server) + changelog (Web)
- Growth stepper 1/5/10 years
- Respects terrain and historic districts
- Produces a structured changelog of ops for replay

## Milestone 8 — VMT‑lite (Server) + metrics UI (Web)
- District stats: population + jobs estimates
- Gravity OD matrix (district centroid ↔ centroid)
- Route car trips on road graph → compute VMT
- Transit access reduces car share deterministically (simple rule)
- Display metrics:
  - VMT, VMT/capita, ridership proxy

## Milestone 9 — Replay timeline + GIF export (Web)
- Timeline model: sequence of growth ops
- Render timelapse playback (map redraw frames)
- Export GIF client‑side

## Milestone 10 — Late V1 fun features
- Personality sliders impact generation weights
- Regional flavor presets (Rust Belt / Sunbelt / Mountain / River port)
- Better handwritten labels: jitter, rotation, collision avoidance

---

## Notes on Vercel compatibility
- Vercel hosts the web app.
- The API/worker must run on a platform that supports long‑running processes (Fly/Render).
- The web app calls API via HTTPS; use CORS and environment variables.

---

## Acceptance criteria (V1)
- Server‑side terrain generation produces seamless 3×3 tiles
- Locking prevents concurrent edits; push changes persists state
- Seed placement generates plausible districts + networks
- Organic growth expands city and can be replayed and exported to GIF
- VMT‑lite metrics exist and respond plausibly
