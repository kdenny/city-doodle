# City Doodle Architecture Documentation

This directory contains architecture documentation synthesized from completed development tickets.

## Documents

- [Districts](./districts.md) - District generation, sizing, and persistence
- [Roads](./roads.md) - Road network generation and styling
- [Transit](./transit.md) - Subway and rail transit system
- [Terrain](./terrain.md) - Terrain and natural feature generation
- [API Conventions](./api-conventions.md) - Backend API patterns

## Key Concepts

### World Settings

Each world has configurable settings:
- `block_size_meters`: Size of city blocks (50-300m)
- `district_size_meters`: Size of districts (200-1000m)
- `grid_organic`: Street grid regularity (0-1)
- `sprawl_compact`: Urban density (0-1)
- `beach_enabled`: Generate beaches along coastlines
- `beach_width_multiplier`: Beach width scaling

### Seeded Randomness

All procedural generation uses seeded random number generators. Same seed = same results. This enables:
- Reproducible worlds
- "Shuffle" buttons for regeneration
- Consistent behavior across sessions

### Persistence Model

| Feature | Frontend | Backend |
|---------|----------|---------|
| Districts | Polygon + metadata | GeoJSON + ENUM types |
| Roads | Polylines | Graph (nodes + edges) |
| Transit | Stations + lines | Three tables (stations, lines, segments) |
| Terrain | Generated from seed | Not persisted |

### Context Providers

The app uses React contexts for shared state:
- `FeaturesContext`: Districts, roads, POIs
- `TerrainContext`: Water features, elevation
- `TransitContext`: Stations, lines, segments
- `MapCanvasContext`: Canvas operations

## Common Patterns

### Optimistic Updates
UI updates immediately, API call in background. On error, rollback local state.

### Bulk Operations
Use bulk create endpoints for efficiency (e.g., `/districts/bulk`, `/road-nodes/bulk`).

### GeoJSON Geometry
All polygon data uses GeoJSON format in the database for spatial queries.

### PostgreSQL ENUMs
Type fields use PostgreSQL native ENUMs with lowercase values. SQLAlchemy must use `create_type=False`.
