"""Water feature generation for terrain (coastlines, rivers, lakes)."""

from typing import Any

import numpy as np
from numpy.typing import NDArray
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

from city_worker.terrain.types import TerrainFeature


def extract_coastlines(
    heightfield: NDArray[np.float64],
    water_level: float,
    tile_x: int,
    tile_y: int,
    tile_size: float,
    smoothing_iterations: int = 3,
) -> list[TerrainFeature]:
    """Extract coastline polygons from heightfield.

    Args:
        heightfield: 2D height array normalized to [0, 1]
        water_level: Threshold below which is water
        tile_x, tile_y: Tile coordinates for world positioning
        tile_size: Size of tile in world units
        smoothing_iterations: Number of smoothing passes

    Returns:
        List of coastline polygon features
    """
    h, w = heightfield.shape
    cell_size = tile_size / w

    # Create binary land/water mask
    land_mask = heightfield >= water_level

    # Find land cells and convert to polygons
    land_polygons = []
    visited = np.zeros_like(land_mask, dtype=bool)

    for i in range(h):
        for j in range(w):
            if land_mask[i, j] and not visited[i, j]:
                # Flood fill to find connected land region
                region_cells = _flood_fill(land_mask, visited, i, j)
                if len(region_cells) >= 4:  # Minimum size for a polygon
                    poly = _cells_to_polygon(region_cells, tile_x, tile_y, tile_size, cell_size, w)
                    if poly is not None and poly.is_valid:
                        land_polygons.append(poly)

    if not land_polygons:
        return []

    # Merge overlapping polygons and simplify
    merged = unary_union(land_polygons)
    if merged.is_empty:
        return []

    # Smooth coastlines
    smoothed = merged.simplify(cell_size * 2, preserve_topology=True)

    # Convert to features
    features = []
    if isinstance(smoothed, Polygon):
        features.append(_polygon_to_feature(smoothed, "coastline"))
    elif isinstance(smoothed, MultiPolygon):
        for poly in smoothed.geoms:
            features.append(_polygon_to_feature(poly, "coastline"))

    return features


def _flood_fill(
    mask: NDArray[np.bool_],
    visited: NDArray[np.bool_],
    start_i: int,
    start_j: int,
) -> list[tuple[int, int]]:
    """Flood fill to find connected region."""
    h, w = mask.shape
    stack = [(start_i, start_j)]
    cells = []

    while stack:
        i, j = stack.pop()
        if i < 0 or i >= h or j < 0 or j >= w:
            continue
        if visited[i, j] or not mask[i, j]:
            continue

        visited[i, j] = True
        cells.append((i, j))

        # 4-connectivity
        stack.extend([(i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)])

    return cells


def _cells_to_polygon(
    cells: list[tuple[int, int]],
    tile_x: int,
    tile_y: int,
    tile_size: float,
    cell_size: float,
    resolution: int,
) -> Polygon | None:
    """Convert grid cells to a polygon using marching squares-like approach."""
    if len(cells) < 3:
        return None

    # Create a mini-grid for this region (bounds used for potential future expansion)
    _min_i = min(c[0] for c in cells)
    _max_i = max(c[0] for c in cells)
    _min_j = min(c[1] for c in cells)
    _max_j = max(c[1] for c in cells)

    # Build boundary by finding edge cells
    cell_set = set(cells)
    boundary_points = []

    for i, j in cells:
        # Check if this is an edge cell (has non-land neighbor)
        is_edge = False
        for di, dj in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ni, nj = i + di, j + dj
            if (ni, nj) not in cell_set:
                is_edge = True
                break

        if is_edge:
            # Convert to world coordinates
            world_x = tile_x * tile_size + (j + 0.5) * cell_size
            world_y = tile_y * tile_size + (i + 0.5) * cell_size
            boundary_points.append((world_x, world_y))

    if len(boundary_points) < 2:
        return None

    try:
        from shapely.geometry import MultiPoint

        mp = MultiPoint(boundary_points)
        hull = mp.convex_hull

        if isinstance(hull, Polygon) and hull.is_valid:
            return hull
        elif hasattr(hull, "buffer"):
            # For thin/linear regions, the convex hull might be a line
            # Buffer it slightly to create a polygon
            buffered = hull.buffer(cell_size * 0.5)
            if isinstance(buffered, Polygon) and buffered.is_valid:
                return buffered
        return None
    except Exception:
        return None


def _polygon_to_feature(poly: Polygon, feature_type: str) -> TerrainFeature:
    """Convert a Shapely polygon to a TerrainFeature."""
    coords = list(poly.exterior.coords)
    holes = [list(ring.coords) for ring in poly.interiors]

    geometry: dict[str, Any] = {
        "type": "Polygon",
        "coordinates": [coords] + holes,
    }

    return TerrainFeature(
        type=feature_type,
        geometry=geometry,
        properties={"area": poly.area},
    )


def calculate_flow_accumulation(
    heightfield: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Calculate flow accumulation for river detection.

    Uses D8 flow direction algorithm.
    """
    h, w = heightfield.shape
    flow = np.ones((h, w), dtype=np.float64)

    # Direction offsets (D8)
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    # Sort cells by height (highest first)
    indices = np.argsort(heightfield.ravel())[::-1]

    for idx in indices:
        i, j = idx // w, idx % w
        current_height = heightfield[i, j]

        # Find lowest neighbor
        min_height = current_height
        min_ni, min_nj = -1, -1

        for di, dj in directions:
            ni, nj = i + di, j + dj
            if 0 <= ni < h and 0 <= nj < w:
                if heightfield[ni, nj] < min_height:
                    min_height = heightfield[ni, nj]
                    min_ni, min_nj = ni, nj

        # Transfer flow to lowest neighbor
        if min_ni >= 0:
            flow[min_ni, min_nj] += flow[i, j]

    return flow


def extract_rivers(
    heightfield: NDArray[np.float64],
    water_level: float,
    tile_x: int,
    tile_y: int,
    tile_size: float,
    flow_threshold: float = 100.0,
    min_length: int = 10,
) -> list[TerrainFeature]:
    """Extract river linestrings from heightfield.

    Args:
        heightfield: 2D height array
        water_level: Water level threshold
        tile_x, tile_y: Tile coordinates
        tile_size: Size of tile
        flow_threshold: Minimum flow accumulation for river
        min_length: Minimum river length in cells

    Returns:
        List of river LineString features
    """
    h, w = heightfield.shape
    cell_size = tile_size / w

    # Calculate flow accumulation
    flow = calculate_flow_accumulation(heightfield)

    # Find river cells (high flow, above water level for now)
    river_mask = (flow >= flow_threshold) & (heightfield >= water_level * 0.8)

    # Trace rivers from high points to low
    features = []
    visited = np.zeros_like(river_mask, dtype=bool)
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    # Find starting points (high flow cells with no upstream high-flow neighbor)
    for i in range(h):
        for j in range(w):
            if not river_mask[i, j] or visited[i, j]:
                continue

            # Check if this is a potential starting point
            has_upstream = False
            for di, dj in directions:
                ni, nj = i + di, j + dj
                if 0 <= ni < h and 0 <= nj < w:
                    if river_mask[ni, nj] and heightfield[ni, nj] > heightfield[i, j]:
                        has_upstream = True
                        break

            if has_upstream:
                continue

            # Trace downstream
            path = [(i, j)]
            visited[i, j] = True
            ci, cj = i, j

            while True:
                # Find lowest unvisited neighbor that's part of river
                next_cell = None
                min_h = heightfield[ci, cj]

                for di, dj in directions:
                    ni, nj = ci + di, cj + dj
                    if 0 <= ni < h and 0 <= nj < w:
                        if (
                            river_mask[ni, nj]
                            and not visited[ni, nj]
                            and heightfield[ni, nj] < min_h
                        ):
                            min_h = heightfield[ni, nj]
                            next_cell = (ni, nj)

                if next_cell is None:
                    # Check if we reached water
                    if heightfield[ci, cj] < water_level:
                        break
                    # Look for any lower neighbor
                    for di, dj in directions:
                        ni, nj = ci + di, cj + dj
                        if 0 <= ni < h and 0 <= nj < w:
                            if not visited[ni, nj] and heightfield[ni, nj] < heightfield[ci, cj]:
                                next_cell = (ni, nj)
                                break

                if next_cell is None:
                    break

                ci, cj = next_cell
                visited[ci, cj] = True
                path.append((ci, cj))

            if len(path) >= min_length:
                # Convert to world coordinates
                coords = [
                    (
                        tile_x * tile_size + (j + 0.5) * cell_size,
                        tile_y * tile_size + (i + 0.5) * cell_size,
                    )
                    for i, j in path
                ]

                line = LineString(coords)
                smoothed = line.simplify(cell_size * 2, preserve_topology=True)

                features.append(
                    TerrainFeature(
                        type="river",
                        geometry={
                            "type": "LineString",
                            "coordinates": list(smoothed.coords),
                        },
                        properties={"length": smoothed.length},
                    )
                )

    return features


def _classify_water_body(
    heightfield: NDArray[np.float64],
    water_mask: NDArray[np.bool_],
    beach_cell: tuple[int, int],
    h: int,
    w: int,
) -> str:
    """Classify the type of water body adjacent to a beach cell.

    Args:
        heightfield: 2D height array
        water_mask: Boolean mask of water cells
        beach_cell: (i, j) coordinates of a beach cell
        h, w: Grid dimensions

    Returns:
        Beach type: "ocean", "bay", "lake", or "river"
    """
    i, j = beach_cell

    # Find connected water region adjacent to this beach cell
    water_neighbors = []
    for di in [-1, 0, 1]:
        for dj in [-1, 0, 1]:
            if di == 0 and dj == 0:
                continue
            ni, nj = i + di, j + dj
            if 0 <= ni < h and 0 <= nj < w and water_mask[ni, nj]:
                water_neighbors.append((ni, nj))

    if not water_neighbors:
        return "ocean"  # Default

    # Check if water touches tile edge (likely ocean or large bay)
    visited_water = np.zeros_like(water_mask, dtype=bool)
    water_cells = _flood_fill(water_mask, visited_water, water_neighbors[0][0], water_neighbors[0][1])
    water_cell_count = len(water_cells)

    # Check if water region touches tile edge
    touches_edge = False
    for ci, cj in water_cells:
        if ci == 0 or ci == h - 1 or cj == 0 or cj == w - 1:
            touches_edge = True
            break

    # Calculate aspect ratio to detect rivers (long and thin)
    if water_cells:
        min_i = min(c[0] for c in water_cells)
        max_i = max(c[0] for c in water_cells)
        min_j = min(c[1] for c in water_cells)
        max_j = max(c[1] for c in water_cells)
        height_span = max_i - min_i + 1
        width_span = max_j - min_j + 1
        aspect_ratio = max(height_span, width_span) / max(min(height_span, width_span), 1)
    else:
        aspect_ratio = 1.0

    # Classification logic
    if not touches_edge and water_cell_count < 100:
        return "lake"
    elif aspect_ratio > 5:  # Long and thin
        return "river"
    elif touches_edge and water_cell_count > 500:
        return "ocean"
    elif touches_edge:
        return "bay"
    else:
        return "lake"


def extract_beaches(
    heightfield: NDArray[np.float64],
    water_level: float,
    beach_height_band: float,
    tile_x: int,
    tile_y: int,
    tile_size: float,
    min_length: int = 5,
    max_slope: float = 0.15,
    width_multiplier: float = 1.0,
) -> list[TerrainFeature]:
    """Extract beach regions where land meets water at shallow slopes.

    Beaches form in the narrow transition zone between water and land,
    where the terrain slope is gradual (not cliffs). Beach width varies
    based on slope - more gradual slopes produce wider beaches.

    Args:
        heightfield: 2D height array normalized to [0, 1]
        water_level: Threshold below which is water
        beach_height_band: Height range above water for beaches (e.g., 0.08)
        tile_x, tile_y: Tile coordinates for world positioning
        tile_size: Size of tile in world units
        min_length: Minimum beach segment length in cells
        max_slope: Maximum slope gradient for beach formation
        width_multiplier: Multiplier for beach width (1.0 = normal)

    Returns:
        List of beach polygon features with beach_type property
    """
    h, w = heightfield.shape
    cell_size = tile_size / w

    # Scale beach height band by width multiplier
    effective_beach_band = beach_height_band * width_multiplier

    # Beach zone: cells in the height band just above water
    beach_min = water_level
    beach_max = water_level + effective_beach_band

    # Create beach candidate mask
    beach_mask = (heightfield >= beach_min) & (heightfield < beach_max)

    # Calculate slope (gradient magnitude)
    # Using simple finite differences
    grad_y = np.zeros_like(heightfield)
    grad_x = np.zeros_like(heightfield)
    grad_y[1:-1, :] = (heightfield[2:, :] - heightfield[:-2, :]) / 2
    grad_x[:, 1:-1] = (heightfield[:, 2:] - heightfield[:, :-2]) / 2
    slope = np.sqrt(grad_x**2 + grad_y**2)

    # Only include cells with gentle slopes
    beach_mask = beach_mask & (slope <= max_slope)

    # Beach must be adjacent to water
    water_mask = heightfield < water_level
    adjacent_to_water = np.zeros_like(beach_mask)
    for i in range(h):
        for j in range(w):
            if beach_mask[i, j]:
                # Check 8-connectivity for water adjacency
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        if di == 0 and dj == 0:
                            continue
                        ni, nj = i + di, j + dj
                        if 0 <= ni < h and 0 <= nj < w and water_mask[ni, nj]:
                            adjacent_to_water[i, j] = True
                            break
                    if adjacent_to_water[i, j]:
                        break

    beach_mask = beach_mask & adjacent_to_water

    # Find connected beach regions
    visited = np.zeros_like(beach_mask, dtype=bool)
    features = []

    for i in range(h):
        for j in range(w):
            if beach_mask[i, j] and not visited[i, j]:
                region_cells = _flood_fill(beach_mask, visited, i, j)

                if len(region_cells) >= min_length:
                    # Convert to polygon
                    poly = _cells_to_polygon(
                        region_cells, tile_x, tile_y, tile_size, cell_size, w
                    )
                    if poly is not None and poly.is_valid:
                        # Calculate average width based on region shape
                        area = len(region_cells) * cell_size * cell_size
                        perimeter = poly.length
                        avg_width = 2 * area / perimeter if perimeter > 0 else cell_size

                        # Classify beach type based on adjacent water body
                        beach_type = _classify_water_body(
                            heightfield, water_mask, region_cells[0], h, w
                        )

                        features.append(
                            TerrainFeature(
                                type="beach",
                                geometry={
                                    "type": "Polygon",
                                    "coordinates": [list(poly.exterior.coords)],
                                },
                                properties={
                                    "area": poly.area,
                                    "width": avg_width,
                                    "beach_type": beach_type,
                                },
                            )
                        )

    return features


def extract_lakes(
    heightfield: NDArray[np.float64],
    water_level: float,
    tile_x: int,
    tile_y: int,
    tile_size: float,
    min_area_cells: int = 20,
) -> list[TerrainFeature]:
    """Extract lake polygons from heightfield depressions.

    Lakes form in areas below water level that are surrounded by higher terrain.
    """
    h, w = heightfield.shape
    cell_size = tile_size / w

    # Find cells below water level
    water_mask = heightfield < water_level

    # Find connected water regions
    visited = np.zeros_like(water_mask, dtype=bool)
    features = []

    for i in range(h):
        for j in range(w):
            if water_mask[i, j] and not visited[i, j]:
                # Flood fill to find connected water region
                region_cells = _flood_fill(water_mask, visited, i, j)

                if len(region_cells) >= min_area_cells:
                    # Check if this is landlocked (surrounded by land)
                    is_landlocked = True
                    for ci, cj in region_cells:
                        # Check edges
                        if ci == 0 or ci == h - 1 or cj == 0 or cj == w - 1:
                            is_landlocked = False
                            break

                    if is_landlocked:
                        poly = _cells_to_polygon(
                            region_cells, tile_x, tile_y, tile_size, cell_size, w
                        )
                        if poly is not None and poly.is_valid:
                            features.append(
                                TerrainFeature(
                                    type="lake",
                                    geometry={
                                        "type": "Polygon",
                                        "coordinates": [list(poly.exterior.coords)],
                                    },
                                    properties={"area": poly.area},
                                )
                            )

    return features
