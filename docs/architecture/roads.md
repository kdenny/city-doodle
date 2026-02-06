# Road Network Architecture

This document describes how roads are generated, styled, and persisted in City Doodle.

## Overview

The road network uses a dual representation:
- **Frontend**: Simple polylines (`Road` objects with `line.points[]`)
- **Backend**: Graph model (`RoadNode` for intersections, `RoadEdge` for segments)

## Road Classification (CITY-145, CITY-146)

Roads have a hierarchy that affects styling and routing:

| Class | Speed Limit | Lanes | Visual Style |
|-------|------------|-------|--------------|
| highway | 100 km/h | 4 | Thick yellow lines |
| arterial | 60 km/h | 4 | Medium orange lines |
| collector | 50 km/h | 2 | Medium lines |
| local | 40 km/h | 2 | Thin gray lines |
| alley/trail | 20 km/h | 1 | Very thin lines |

Styling follows Google Maps conventions with distinct colors and widths.

## Generation

### Internal Street Grids (CITY-142)

When a district is placed, a street grid is generated:

1. Calculate grid cell size based on block size settings
2. Apply organic factor for street irregularity
3. Clip roads to district polygon boundary
4. Assign road classes (typically `local` for internal streets)

Key function: `generateStreetGrid()` in `districtGenerator.ts`

### Inter-District Roads (CITY-144)

When a new district is placed, connections to existing districts are generated:

1. Find nearby districts within connection distance
2. Calculate connection points on district boundaries
3. Generate arterial roads avoiding water features
4. Apply A* pathfinding if obstacles exist

Key function: `generateInterDistrictRoads()` in `interDistrictRoads.ts`

## Editing (CITY-146, CITY-147)

### Classification Editing
Users can change road class via the inspector panel:
- Select a road
- Choose new classification from dropdown
- Roads update styling immediately

### Endpoint Dragging
Road endpoints can be dragged with snap indicators:
- Snap to nearby intersections
- Snap to grid alignment
- Visual feedback during drag

## Bridges (CITY-148)

Bridges are auto-detected when roads cross water:

```typescript
interface Bridge {
  id: string;
  roadId: string;
  waterCrossingType: "ocean" | "lake" | "river" | "bay";
  waterFeatureId: string;
  startPoint: Point;
  endPoint: Point;
}
```

The `detectBridges()` function analyzes road-water intersections and generates bridge data.

## Persistence (CITY-204)

### Backend Graph Model

```sql
CREATE TABLE road_nodes (
  id UUID PRIMARY KEY,
  world_id UUID REFERENCES worlds(id),
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  node_type node_type NOT NULL,
  name TEXT
);

CREATE TABLE road_edges (
  id UUID PRIMARY KEY,
  world_id UUID REFERENCES worlds(id),
  from_node_id UUID REFERENCES road_nodes(id),
  to_node_id UUID REFERENCES road_nodes(id),
  road_class road_class NOT NULL,
  geometry JSONB,  -- Intermediate points
  length_meters FLOAT NOT NULL,
  name TEXT,
  is_one_way BOOLEAN DEFAULT FALSE,
  lanes INTEGER DEFAULT 2,
  district_id UUID REFERENCES districts(id)
);
```

### Conversion

When saving roads:
1. Extract endpoints from each road polyline
2. Create nodes at unique positions (merge shared intersections)
3. Create edges between nodes with intermediate geometry

When loading roads:
1. Fetch road network from API
2. Build node lookup map
3. Reconstruct polylines: `from_node → geometry → to_node`

## Frontend Data Model

```typescript
interface Road {
  id: string;
  name?: string;
  roadClass: RoadClass;
  line: Line;  // { points: Point[] }
}

type RoadClass = "highway" | "arterial" | "collector" | "local" | "trail";
```

## Related Tickets

- CITY-142: Street grid generation
- CITY-144: Inter-district connections
- CITY-145: Visual styling
- CITY-146: Classification editing UI
- CITY-147: Endpoint drag-and-drop
- CITY-148: Auto-bridge generation
- CITY-204: Road persistence
