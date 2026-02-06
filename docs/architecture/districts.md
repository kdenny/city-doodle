# District System Architecture

This document describes how districts are generated, sized, and persisted in City Doodle.

## Overview

Districts are the fundamental building blocks of cities. Each district contains a street grid and can be of various types (residential, downtown, commercial, industrial, etc.).

## District Types

The following district types are supported:
- **residential**: Low to medium density housing
- **downtown**: Dense urban core with tall buildings
- **commercial**: Retail and office areas
- **industrial**: Warehouses and factories
- **hospital**: Medical campus
- **university**: College/university campus
- **k12**: Schools and educational facilities
- **park**: Green spaces and recreation
- **airport**: Aviation facilities

Each type has default density and height settings defined in `DISTRICT_TYPE_DEFAULTS`.

## Generation Flow

1. **Seed Placement**: User places a district seed via the placement palette
2. **Geometry Generation**: `generateDistrictGeometry()` creates the district polygon
3. **Water Clipping**: `clipAndValidateDistrict()` clips district against water features (CITY-141)
4. **Street Grid**: `regenerateStreetGridForClippedDistrict()` generates internal roads (CITY-142)
5. **Inter-District Roads**: `generateInterDistrictRoads()` connects to adjacent districts (CITY-144)
6. **Persistence**: District is saved to backend via `createDistrictMutation`

## Sizing System (CITY-189, CITY-130, CITY-203)

Districts use world settings for sizing:

```typescript
// World settings
block_size_meters: 50-300 (default 100)
district_size_meters: 200-1000 (default 500)
```

The `metersToWorldUnits()` function converts meters to canvas coordinates.

City scale presets provide quick configuration:
- **Manhattan**: Small blocks (80m), compact districts (300m)
- **Portland**: Small walkable blocks (60m), medium districts (400m)
- **Houston**: Large sprawling blocks (200m), large districts (800m)
- **European**: Irregular small blocks (70m), compact districts (350m)

## Personality Settings

Each district has personality sliders that affect generation:

```typescript
interface DistrictPersonality {
  grid_organic: number;      // 0 = strict grid, 1 = organic streets
  sprawl_compact: number;    // 0 = sprawling, 1 = dense urban
  transit_car: number;       // 0 = transit-oriented, 1 = car-dependent
  era_year: number;          // Architectural era (1200-2024)
  density?: number;          // Block density 0-10
}
```

## Grid Orientation (CITY-151)

Districts have a `gridAngle` property that controls street orientation. This can be edited in the inspector panel and regenerates the street grid when changed.

## Persistence (CITY-135, CITY-137, CITY-202)

Districts are stored in PostgreSQL with GeoJSON geometry:

```sql
CREATE TABLE districts (
  id UUID PRIMARY KEY,
  world_id UUID REFERENCES worlds(id),
  type district_type NOT NULL,  -- PostgreSQL ENUM
  name TEXT,
  geometry JSONB NOT NULL,
  density FLOAT DEFAULT 5.0,
  max_height INTEGER DEFAULT 15,
  transit_access BOOLEAN DEFAULT FALSE,
  historic BOOLEAN DEFAULT FALSE
);
```

**Important**: The district type uses a PostgreSQL native ENUM with lowercase values. SQLAlchemy must use `create_type=False` to avoid case mismatch issues.

## Frontend-Backend Conversion

- Frontend uses `polygon.points[]` format
- Backend uses GeoJSON `Polygon` format
- Conversion functions: `toGeoJsonGeometry()` and `fromGeoJsonGeometry()`

## Related Tickets

- CITY-135: Districts database schema
- CITY-137: District persistence on placement
- CITY-139: Inspector panel edits
- CITY-141: Water clipping
- CITY-142: Street grid generation
- CITY-144: Inter-district roads
- CITY-151: Grid orientation editing
- CITY-156: District type changing
- CITY-157: Density configuration
- CITY-189: District sizing fix
- CITY-202: ENUM case fix
- CITY-203: World settings for sizing
