# Lo-Fi City Builder - V1 & V2 Ticket Breakdown

> Each ticket is scoped to be ~1 prompt, ~1 PR. Dependencies noted with `blocked_by`.

---

## Epic: Project Setup (M0)

### SETUP-001: Initialize monorepo structure
**Type:** Task
**Priority:** P0
**Description:**
Create the monorepo structure with:
- `/apps/web` - React + TypeScript + Vite
- `/apps/api` - FastAPI Python app
- `/apps/worker` - Python worker process
- `/packages/shared` - Shared TypeScript types + Python schemas

Include:
- Root `package.json` with workspaces
- Root `pyproject.toml` with workspace config
- Basic README with architecture overview
- `.gitignore` for Python + Node

**Acceptance Criteria:**
- [ ] All directories exist with placeholder files
- [ ] `npm install` works from root
- [ ] `pip install -e .` works for Python packages
- [ ] Can run basic hello-world in each app

---

### SETUP-002: Configure CI pipeline (lint + type checking)
**Type:** Task
**Priority:** P0
**Blocked By:** SETUP-001
**Description:**
Set up GitHub Actions CI with:
- Python: ruff (lint) + mypy (types)
- TypeScript: eslint + tsc
- Run on PR and push to main

**Acceptance Criteria:**
- [ ] CI runs on every PR
- [ ] Lint failures block merge
- [ ] Type errors block merge

---

### SETUP-003: Set up testing infrastructure
**Type:** Task
**Priority:** P1
**Blocked By:** SETUP-001
**Description:**
Configure testing frameworks:
- Python: pytest with pytest-asyncio
- Web: Vitest for unit tests
- E2E: Playwright (basic setup, tests come later)

Add to CI pipeline.

**Acceptance Criteria:**
- [ ] `pytest` runs from `/apps/api` and `/apps/worker`
- [ ] `npm test` runs Vitest in `/apps/web`
- [ ] `npm run test:e2e` runs Playwright
- [ ] All test commands in CI

---

### SETUP-004: Define OpenAPI spec + Pydantic models
**Type:** Task
**Priority:** P0
**Blocked By:** SETUP-001
**Description:**
Create core data models:

```python
# Core entities
World(id, name, seed, created_at, settings)
Tile(id, world_id, tx, ty, terrain_data, features, created_at, updated_at)
TileLock(tile_id, user_id, locked_at, expires_at)
Job(id, type, status, tile_id, params, result, created_at, started_at, completed_at)
District(id, tile_id, type, geometry, properties, historic)
```

Generate OpenAPI spec from FastAPI routes.

**Acceptance Criteria:**
- [ ] All models defined with Pydantic
- [ ] TypeScript types generated/mirrored in `/packages/shared`
- [ ] OpenAPI spec accessible at `/docs`

---

### SETUP-005: Configure deployment infrastructure
**Type:** Task
**Priority:** P0
**Blocked By:** SETUP-001
**Description:**
Set up deployment configs:
- `/apps/web`: Vercel config (`vercel.json`)
- `/apps/api`: Fly.io config (`fly.toml`)
- `/apps/worker`: Fly.io config (separate app)
- Environment variable templates

**Acceptance Criteria:**
- [ ] `vercel.json` configured for web app
- [ ] `fly.toml` for API with health check
- [ ] `fly.toml` for worker
- [ ] `.env.example` files in each app
- [ ] Deploy scripts or docs

---

## Epic: Database & Core API (M1)

### API-001: Set up Postgres schema + migrations
**Type:** Task
**Priority:** P0
**Blocked By:** SETUP-004
**Description:**
Create Postgres schema for Neon:

```sql
-- Tables
worlds (id, name, seed, settings, created_at)
tiles (id, world_id, tx, ty, terrain_data, features, version, created_at, updated_at)
tile_locks (tile_id PK, session_id, locked_at, expires_at)
jobs (id, type, status, tile_id, params, result, error, created_at, claimed_at, completed_at)
users (id, email, password_hash, created_at)  -- for auth
sessions (id, user_id, expires_at, created_at)
```

Use Alembic for migrations.

**Acceptance Criteria:**
- [ ] All tables created via migration
- [ ] Migrations run against Neon
- [ ] Indexes on frequently queried columns
- [ ] `alembic upgrade head` works

---

### API-002: Implement user auth endpoints
**Type:** Task
**Priority:** P1
**Blocked By:** API-001
**Description:**
Basic auth with Postgres session storage:
- `POST /auth/register` - email + password
- `POST /auth/login` - returns session token
- `POST /auth/logout` - invalidates session
- `GET /auth/me` - returns current user

Password hashing with bcrypt. Session tokens stored in DB.

**Acceptance Criteria:**
- [ ] Can register new user
- [ ] Can login and receive session token
- [ ] Protected routes reject invalid tokens
- [ ] Sessions expire after 7 days

---

### API-003: Implement World CRUD endpoints
**Type:** Task
**Priority:** P0
**Blocked By:** API-001, API-002
**Description:**
- `POST /worlds` - create world (name, seed optional → generate)
- `GET /worlds` - list user's worlds
- `GET /worlds/{id}` - get world details
- `DELETE /worlds/{id}` - soft delete world

**Acceptance Criteria:**
- [ ] World creation generates deterministic seed if not provided
- [ ] Worlds scoped to authenticated user
- [ ] Proper error responses (404, 403)

---

### API-004: Implement Tile endpoints
**Type:** Task
**Priority:** P0
**Blocked By:** API-003
**Description:**
- `GET /worlds/{id}/tiles` - list tiles (with optional bbox filter)
- `GET /worlds/{id}/tiles?tx={tx}&ty={ty}` - get specific tile
- `GET /tiles/{tile_id}` - get tile by ID
- `POST /tiles/{tile_id}` - update tile (requires lock)

**Acceptance Criteria:**
- [ ] Can query tiles by coordinates
- [ ] Tile updates require valid lock
- [ ] Tile updates increment version
- [ ] Returns terrain + features as GeoJSON

---

### API-005: Implement Tile locking endpoints
**Type:** Task
**Priority:** P0
**Blocked By:** API-004
**Description:**
- `POST /tiles/{tile_id}/lock` - acquire lock (fails if locked by other)
- `POST /tiles/{tile_id}/unlock` - release lock
- `GET /tiles/{tile_id}/lock` - check lock status

Lock expires after 5 minutes of inactivity. Heartbeat endpoint to extend.

**Acceptance Criteria:**
- [ ] Only one session can hold lock
- [ ] Lock auto-expires
- [ ] Can check who holds lock
- [ ] Proper conflict responses

---

### API-006: Implement Job endpoints
**Type:** Task
**Priority:** P0
**Blocked By:** API-004
**Description:**
- `POST /tiles/{tile_id}/jobs/generate_terrain` - queue terrain generation
- `POST /tiles/{tile_id}/jobs/place_seed` - queue seed placement
- `POST /tiles/{tile_id}/jobs/grow` - queue growth simulation
- `GET /jobs/{job_id}` - get job status + result

Jobs stored in DB with status: pending → running → completed/failed

**Acceptance Criteria:**
- [ ] Jobs created with pending status
- [ ] Job status queryable
- [ ] Job results stored when complete
- [ ] Proper error handling for failed jobs

---

## Epic: Worker & Generation (M2)

### WORKER-001: Implement job runner infrastructure
**Type:** Task
**Priority:** P0
**Blocked By:** API-006
**Description:**
Worker process that:
- Polls `jobs` table for pending jobs
- Claims jobs with `FOR UPDATE SKIP LOCKED`
- Executes job based on type
- Writes result or error back to DB
- Handles graceful shutdown

**Acceptance Criteria:**
- [ ] Worker starts and polls for jobs
- [ ] Concurrent workers don't claim same job
- [ ] Job status updates correctly
- [ ] Worker recovers from crashes

---

### WORKER-002: Implement terrain generation (3x3)
**Type:** Task
**Priority:** P0
**Blocked By:** WORKER-001
**Description:**
Generate terrain for center tile + 8 neighbors:
- Use Simplex noise for base heightfield
- Apply erosion for realistic features
- Generate coastlines (smooth, realistic curves)
- Generate rivers (flow downhill, realistic paths)
- Generate lakes (in basins)
- Output as vector features (GeoJSON)

Deterministic: same seed + coords = same output.

**Acceptance Criteria:**
- [ ] Terrain generated for 3x3 grid
- [ ] Borders align seamlessly between tiles
- [ ] Coastlines look natural (not jagged)
- [ ] Rivers flow logically downhill
- [ ] Output stored as GeoJSON in tiles table

---

### WORKER-003: Implement seed placement job
**Type:** Task
**Priority:** P1
**Blocked By:** WORKER-002
**Description:**
Handle `place_seed` job:
- Input: seed type, location, parameters
- Generate district polygon respecting terrain
- Generate initial road network for district
- Generate POIs based on district type

Seed types from spec: Residential, Downtown, Shopping, Hospital, University, Industrial, K12, Park, Trail, Transit stations, Airport.

**Acceptance Criteria:**
- [ ] Districts placed with plausible geometry
- [ ] Roads connect to existing network
- [ ] POIs appropriate to district type
- [ ] Respects water/terrain constraints

---

### WORKER-004: Implement growth simulation job
**Type:** Task
**Priority:** P1
**Blocked By:** WORKER-003
**Description:**
Handle `grow` job for 1/5/10 year steps:
- Infill development in existing districts
- Expansion at district edges
- New road connections
- New supporting POIs
- Respect historic district flag (no changes)

Output structured changelog for replay.

**Acceptance Criteria:**
- [ ] City grows plausibly over time steps
- [ ] Historic districts unchanged
- [ ] Growth respects terrain
- [ ] Changelog captures all changes

---

### WORKER-005: Implement VMT-lite metrics job
**Type:** Task
**Priority:** P1
**Blocked By:** WORKER-003
**Description:**
Calculate transportation metrics:
- Build road graph from tile features
- Estimate population/jobs per district
- Generate OD matrix (gravity model)
- Route trips on road graph (shortest path)
- Calculate: Total VMT, VMT per capita
- Transit ridership proxy (access-based)

**Acceptance Criteria:**
- [ ] Metrics compute without error
- [ ] VMT changes plausibly with edits
- [ ] Transit access reduces car trips
- [ ] Results stored in tile/world metadata

---

## Epic: Web App Foundation (M3)

### WEB-001: Set up React + TypeScript + Vite app
**Type:** Task
**Priority:** P0
**Blocked By:** SETUP-001
**Description:**
Initialize web app with:
- React 18 + TypeScript
- Vite for bundling
- TailwindCSS for styling
- React Query for API calls
- React Router for navigation

**Acceptance Criteria:**
- [ ] App runs with `npm run dev`
- [ ] TypeScript strict mode enabled
- [ ] Tailwind configured
- [ ] Basic routing works

---

### WEB-002: Implement API client
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-001, API-003
**Description:**
Create typed API client:
- Auto-generated from OpenAPI spec (or manually typed)
- Handles auth token in headers
- React Query hooks for each endpoint
- Error handling utilities

**Acceptance Criteria:**
- [ ] All API endpoints have typed client methods
- [ ] Auth token automatically included
- [ ] Errors surfaced to UI appropriately

---

### WEB-003: Implement auth UI
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-002, API-002
**Description:**
Auth pages:
- Login page
- Register page
- Auth state management (context/store)
- Protected route wrapper
- Logout functionality

**Acceptance Criteria:**
- [ ] Can register new account
- [ ] Can login
- [ ] Protected routes redirect to login
- [ ] Session persists across refresh

---

### WEB-004: Implement world list + create UI
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-003
**Description:**
World management:
- List user's worlds (cards/list view)
- Create world modal (name, optional seed)
- Delete world confirmation
- Navigate to world editor

Wire-frame quality UI (design ticket is blocker for polish).

**Acceptance Criteria:**
- [ ] Can see list of worlds
- [ ] Can create new world
- [ ] Can navigate into world editor
- [ ] Basic loading/error states

---

### DESIGN-001: Create Figma designs for core UI
**Type:** Design
**Priority:** P1
**Assignee:** @kevindenny
**Description:**
Create Figma designs for:
- World list page
- World editor (map view + panels)
- Placement palette
- Inspector panel
- Metrics display
- Export dialogs

Define:
- Color palette
- Typography (including handwritten font selection)
- Component library basics

**Acceptance Criteria:**
- [ ] All core screens designed
- [ ] Handwritten font selected
- [ ] Color palette defined
- [ ] Ready for implementation

---

### CHORE-001: Select handwritten font
**Type:** Chore
**Priority:** P2
**Assignee:** @kevindenny
**Description:**
The app needs a handwritten-style font for map labels. Current placeholder: [TBD - will use open source option].

Evaluate options considering:
- Readability at small sizes
- Character coverage (including numbers)
- License (open source preferred)
- Aesthetic fit with lo-fi map style

Options to consider:
- Caveat
- Patrick Hand
- Indie Flower
- Architects Daughter
- Kalam

**Acceptance Criteria:**
- [ ] Font selected and documented
- [ ] Font files added to repo or CDN reference

---

## Epic: Map Rendering (M4)

### WEB-005: Set up PixiJS canvas + viewport
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-004
**Description:**
Initialize PixiJS rendering:
- Canvas fills editor area
- Viewport with pan (drag) and zoom (scroll)
- Coordinate system: world coords → screen coords
- Tile grid overlay
- Basic performance (culling off-screen)

**Acceptance Criteria:**
- [ ] Canvas renders
- [ ] Can pan and zoom smoothly
- [ ] Tile grid visible
- [ ] 60fps on reasonable hardware

---

### WEB-006: Render terrain layers
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-005, WORKER-002
**Description:**
Render terrain features from tile data:
- Water (ocean/lakes) as filled polygons
- Coastlines as styled lines
- Rivers as styled lines (width varies)
- Contour lines (optional toggle)
- Tile borders

Layer toggle controls.

**Acceptance Criteria:**
- [ ] All terrain features render correctly
- [ ] Layers can be toggled
- [ ] Seamless across tile boundaries
- [ ] Appropriate styling (colors, line weights)

---

### WEB-007: Render districts + roads + POIs
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-006, WORKER-003
**Description:**
Render placed features:
- District polygons (color by type)
- District labels (handwritten font)
- Road network (styled by class)
- POI icons/markers
- Historic district indicator

**Acceptance Criteria:**
- [ ] Districts render with appropriate colors
- [ ] Roads render with proper hierarchy
- [ ] Labels use handwritten font
- [ ] POIs visible and identifiable

---

### WEB-008: Implement handwritten labels
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-007, CHORE-001
**Description:**
Label rendering system:
- Load handwritten font
- Deterministic label placement
- Basic collision avoidance
- Slight rotation/jitter for hand-drawn feel
- Labels for: districts, water features, major roads

**Acceptance Criteria:**
- [ ] Labels render in handwritten font
- [ ] No overlapping labels
- [ ] Labels have slight organic variation
- [ ] Deterministic (same seed = same placement)

---

## Epic: Editing & Interaction (M5-M6)

### WEB-009: Implement snap-to-geometry engine
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-006
**Description:**
Snapping system:
- Build spatial index of rendered geometry
- On cursor move, find nearest snap point
- Snap types: vertex, edge midpoint, intersection
- Visual indicator (crosshair/highlight)
- Configurable snap threshold

**Acceptance Criteria:**
- [ ] Cursor snaps to geometry
- [ ] Visual feedback on snap
- [ ] Snapping feels responsive
- [ ] Can snap to: coastline, rivers, roads, district edges

---

### WEB-010: Implement placement palette
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-009, DESIGN-001
**Description:**
Seed placement UI:
- Palette panel with all seed types
- Select seed type → enter placement mode
- Click to place (snaps to geometry)
- Placement preview before confirming
- Sends `place_seed` job to API

Seed types: Residential, Downtown, Shopping, Hospital, University, Industrial, K12, Park, Trail, Train stations, Subway, Airport.

**Acceptance Criteria:**
- [ ] All seed types in palette
- [ ] Can select and place seeds
- [ ] Placement respects snapping
- [ ] Job triggered on confirm

---

### WEB-011: Implement inspector panel
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-010, DESIGN-001
**Description:**
Selection and inspection:
- Click to select district/POI
- Inspector shows properties
- Edit properties (name, density, etc.)
- Toggle historic flag for districts
- Delete/remove option

**Acceptance Criteria:**
- [ ] Can select features
- [ ] Inspector shows relevant info
- [ ] Can edit properties
- [ ] Can toggle historic flag
- [ ] Changes persist via API

---

### WEB-012: Implement edit mode + lock UX
**Type:** Task
**Priority:** P0
**Blocked By:** WEB-011, API-005
**Description:**
Edit flow:
- View mode (read-only) by default
- "Edit" button requests tile lock
- If locked by other: show who, offer retry
- Edit mode: enable placement/modification
- "Save" pushes changes, releases lock
- Auto-release on navigation away

**Acceptance Criteria:**
- [ ] Lock acquired before editing
- [ ] Lock conflicts handled gracefully
- [ ] Changes saved on explicit save
- [ ] Lock released when done

---

## Epic: Growth & Simulation (M7-M8)

### WEB-013: Implement growth controls
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-012, WORKER-004
**Description:**
Growth simulation UI:
- Growth panel with step options (1/5/10 years)
- "Grow" button triggers job
- Progress indicator while running
- Map updates when complete
- Changelog displayed

**Acceptance Criteria:**
- [ ] Can trigger growth simulation
- [ ] Progress shown during job
- [ ] Map reflects growth results
- [ ] Changelog viewable

---

### WEB-014: Implement metrics display
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-013, WORKER-005, DESIGN-001
**Description:**
Metrics panel showing:
- Total VMT
- VMT per capita
- Transit ridership proxy
- Population estimate
- Jobs estimate

Updates after growth or edits.

**Acceptance Criteria:**
- [ ] All metrics displayed
- [ ] Metrics update after changes
- [ ] Clear visualization (numbers + maybe charts)

---

## Epic: Replay & Export (M9)

### WEB-015: Implement replay timeline
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-013
**Description:**
Timeline playback:
- Timeline UI with year markers
- Play/pause/scrub controls
- Playback speed control
- Map re-renders for each frame
- Shows growth progression

**Acceptance Criteria:**
- [ ] Can play through growth history
- [ ] Smooth playback
- [ ] Can scrub to specific year
- [ ] Map accurately reflects each state

---

### WEB-016: Implement PNG export
**Type:** Task
**Priority:** P1
**Blocked By:** WEB-007
**Description:**
Export current view as PNG:
- Export button in toolbar
- Resolution options (1x, 2x, 4x)
- Captures visible map area
- Downloads as file

**Acceptance Criteria:**
- [ ] Can export current view
- [ ] Multiple resolution options
- [ ] High quality output
- [ ] Proper file naming

---

### WEB-017: Implement GIF export
**Type:** Task
**Priority:** P2
**Blocked By:** WEB-015
**Description:**
Export replay as GIF:
- Export GIF button
- Configure frame rate
- Progress indicator during render
- Client-side GIF generation (gif.js or similar)
- Downloads when complete

**Acceptance Criteria:**
- [ ] Can export replay as GIF
- [ ] Reasonable file size
- [ ] Good visual quality
- [ ] Progress feedback

---

## Epic: Polish & Fun (M10)

### WEB-018: Implement personality sliders
**Type:** Task
**Priority:** P2
**Blocked By:** WEB-010, WORKER-003
**Description:**
Generation personality controls:
- Grid ↔ Organic (road topology)
- Sprawl ↔ Compact (density)
- Waterfront bias
- Park priority

Sliders affect generation job parameters.

**Acceptance Criteria:**
- [ ] All sliders implemented
- [ ] Sliders affect generation results
- [ ] Visible difference in output

---

### WEB-019: Implement regional flavor presets
**Type:** Task
**Priority:** P2
**Blocked By:** WEB-018
**Description:**
Preset configurations:
- Rust Belt (grid, industrial, dense)
- Sunbelt (sprawl, organic, car-centric)
- Mountain (topography-following, compact)
- River Port (waterfront-heavy, historic)

Preset applies slider values + additional style hints.

**Acceptance Criteria:**
- [ ] All presets available
- [ ] Presets produce distinct city styles
- [ ] Can customize after applying preset

---

## Epic: Testing & Quality (Ongoing)

### TEST-001: API unit tests
**Type:** Task
**Priority:** P1
**Blocked By:** SETUP-003, API-006
**Description:**
Pytest tests for API:
- All endpoints tested
- Auth flow tested
- Lock behavior tested
- Job creation tested

Use test database (Neon branch or SQLite).

**Acceptance Criteria:**
- [ ] >80% coverage on API code
- [ ] Tests run in CI
- [ ] Tests use isolated DB

---

### TEST-002: Worker unit tests
**Type:** Task
**Priority:** P1
**Blocked By:** SETUP-003, WORKER-005
**Description:**
Pytest tests for worker:
- Job runner logic tested
- Terrain generation tested (determinism)
- Growth simulation tested
- Metrics calculation tested

**Acceptance Criteria:**
- [ ] Core algorithms have tests
- [ ] Determinism verified
- [ ] Tests run in CI

---

### TEST-003: Web component tests
**Type:** Task
**Priority:** P2
**Blocked By:** SETUP-003, WEB-014
**Description:**
Vitest tests for web app:
- Key components have unit tests
- API client mocked
- State management tested

**Acceptance Criteria:**
- [ ] Critical components tested
- [ ] Tests run in CI

---

### TEST-004: E2E tests
**Type:** Task
**Priority:** P2
**Blocked By:** SETUP-003, WEB-014
**Description:**
Playwright E2E tests:
- User registration/login flow
- Create world flow
- Place seed and grow flow
- Export flow

**Acceptance Criteria:**
- [ ] Happy paths covered
- [ ] Tests run in CI (maybe on deploy)
- [ ] Tests reasonably fast

---

---

# V2 Tickets (Future)

## Epic: Needs System (V2-M1)

### V2-NEEDS-001: Implement needs calculation
**Type:** Task
**Priority:** P3
**Blocked By:** V1 Complete
**Description:**
Calculate access metrics:
- Healthcare access
- Education access
- Park access
- Transit access

Generate warnings for unmet needs.

---

### V2-NEEDS-002: Growth respects needs
**Type:** Task
**Priority:** P3
**Blocked By:** V2-NEEDS-001
**Description:**
Growth heuristics prefer satisfying unmet needs.

---

## Epic: Transportation Realism (V2-M2)

### V2-TRANSPORT-001: Congestion proxy
**Type:** Task
**Priority:** P3
**Description:**
Edge load → travel time calculation. Capacity limits by road class.

---

### V2-TRANSPORT-002: Mode choice refinement
**Type:** Task
**Priority:** P3
**Description:**
Logit model for mode choice. Better ridership calculation.

---

## Epic: Network Editing (V2-M3)

### V2-EDIT-001: Road drawing tools
**Type:** Task
**Priority:** P3
**Description:**
Draw arterials/local roads with snapping + auto intersections.

---

### V2-EDIT-002: Transit line tools
**Type:** Task
**Priority:** P3
**Description:**
Draw rail/subway lines with stop placement.

---

## Epic: 3D View (V2-M4)

### V2-3D-001: Building footprint generation
**Type:** Task
**Priority:** P3
**Description:**
Generate building footprints inside district polygons.

---

### V2-3D-002: Isometric 3D renderer
**Type:** Task
**Priority:** P3
**Description:**
Extrude buildings, isometric camera, simple shadows.

---

## Epic: Street View (V2-M5)

### V2-STREET-001: Streetscape generation
**Type:** Task
**Priority:** P3
**Description:**
Procedural streetscape from road segment context.

---

### V2-STREET-002: Street view renderer
**Type:** Task
**Priority:** P3
**Description:**
First-person view with pan left/right. Time/weather toggles.

---

## Epic: Multiplayer (V2-M7)

### V2-MP-001: Review/merge workflow
**Type:** Task
**Priority:** P3
**Description:**
PR-like workflow for tile changes.

---

### V2-MP-002: Presence + comments
**Type:** Task
**Priority:** P3
**Description:**
Show who's viewing, annotations system.

---

## Epic: Visual Upgrades (V2-M8)

### V2-VIS-001: Paper texture + ink styles
**Type:** Task
**Priority:** P3
**Description:**
Paper overlay, ink jitter presets.

---

### V2-VIS-002: Poster export
**Type:** Task
**Priority:** P3
**Description:**
Multi-tile export with title block, legend, scale bar.

---

## Epic: LLM Features (V2-M9)

### V2-LLM-001: Auto-naming
**Type:** Task
**Priority:** P3
**Description:**
LLM generates neighborhood/park/station names.

---

### V2-LLM-002: Planner notes
**Type:** Task
**Priority:** P3
**Description:**
LLM explains growth decisions, suggests next builds.

---

---

# Dependency Graph (V1 Critical Path)

```
SETUP-001 (monorepo)
    ├── SETUP-002 (CI)
    ├── SETUP-003 (testing) → TEST-*
    ├── SETUP-004 (models) → API-001
    ├── SETUP-005 (deploy)
    └── WEB-001 (React app)

API-001 (DB schema)
    ├── API-002 (auth)
    └── API-003 (worlds) → API-004 (tiles) → API-005 (locks) → API-006 (jobs)

API-006 (jobs) → WORKER-001 (runner) → WORKER-002 (terrain) → WORKER-003 (seeds) → WORKER-004 (growth) → WORKER-005 (metrics)

WEB-001 → WEB-002 (API client) → WEB-003 (auth UI) → WEB-004 (world list)
WEB-004 → WEB-005 (PixiJS) → WEB-006 (terrain render) → WEB-007 (features render) → WEB-008 (labels)
WEB-006 → WEB-009 (snapping) → WEB-010 (palette) → WEB-011 (inspector) → WEB-012 (edit mode)
WEB-012 + WORKER-004 → WEB-013 (growth UI)
WEB-013 + WORKER-005 → WEB-014 (metrics)
WEB-013 → WEB-015 (replay) → WEB-017 (GIF export)
WEB-007 → WEB-016 (PNG export)

DESIGN-001 (Figma) blocks: WEB-010, WEB-011, WEB-014
CHORE-001 (font) blocks: WEB-008
```

---

# First Deployable Milestone

For a meaningful first deploy, I recommend completing:

1. **SETUP-001** - Monorepo structure
2. **SETUP-002** - CI pipeline
3. **SETUP-004** - Data models
4. **SETUP-005** - Deploy configs
5. **API-001** - DB schema
6. **API-002** - Auth
7. **API-003** - World CRUD
8. **API-004** - Tile endpoints
9. **WORKER-001** - Job runner
10. **WORKER-002** - Terrain generation
11. **WEB-001** - React app
12. **WEB-002** - API client
13. **WEB-003** - Auth UI
14. **WEB-004** - World list
15. **WEB-005** - PixiJS viewport
16. **WEB-006** - Terrain rendering

This gives you: **Create account → Create world → Generate terrain → View map with pan/zoom**

~15 tickets, but they're sequential so it's a clear path.
