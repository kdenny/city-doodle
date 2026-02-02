"""Tile repository - data access for tiles."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from city_api.schemas import TerrainData, Tile, TileCreate, TileFeatures, TileUpdate


class TileRepository:
    """In-memory tile repository. Will be replaced with database."""

    def __init__(self) -> None:
        self._tiles: dict[UUID, dict] = {}
        # Index by (world_id, tx, ty) for coordinate lookups
        self._coord_index: dict[tuple[UUID, int, int], UUID] = {}

    def create(self, tile_create: TileCreate) -> Tile:
        """Create a new tile."""
        tile_id = uuid4()
        now = datetime.now(UTC)

        tile_data = {
            "id": tile_id,
            "world_id": tile_create.world_id,
            "tx": tile_create.tx,
            "ty": tile_create.ty,
            "terrain_data": TerrainData(),
            "features": TileFeatures(),
            "version": 1,
            "created_at": now,
            "updated_at": now,
        }
        self._tiles[tile_id] = tile_data
        self._coord_index[(tile_create.world_id, tile_create.tx, tile_create.ty)] = tile_id
        return self._to_model(tile_data)

    def get(self, tile_id: UUID) -> dict | None:
        """Get a tile by ID (returns raw data)."""
        return self._tiles.get(tile_id)

    def get_by_id(self, tile_id: UUID) -> Tile | None:
        """Get a tile by ID."""
        tile_data = self.get(tile_id)
        if tile_data is None:
            return None
        return self._to_model(tile_data)

    def get_by_coords(self, world_id: UUID, tx: int, ty: int) -> Tile | None:
        """Get a tile by world and coordinates."""
        tile_id = self._coord_index.get((world_id, tx, ty))
        if tile_id is None:
            return None
        return self.get_by_id(tile_id)

    def list_by_world(
        self,
        world_id: UUID,
        min_tx: int | None = None,
        max_tx: int | None = None,
        min_ty: int | None = None,
        max_ty: int | None = None,
    ) -> list[Tile]:
        """List tiles in a world, optionally filtered by bounding box."""
        tiles = []
        for tile_data in self._tiles.values():
            if tile_data["world_id"] != world_id:
                continue
            # Apply bounding box filter if provided
            if min_tx is not None and tile_data["tx"] < min_tx:
                continue
            if max_tx is not None and tile_data["tx"] > max_tx:
                continue
            if min_ty is not None and tile_data["ty"] < min_ty:
                continue
            if max_ty is not None and tile_data["ty"] > max_ty:
                continue
            tiles.append(self._to_model(tile_data))
        return tiles

    def update(self, tile_id: UUID, tile_update: TileUpdate) -> Tile | None:
        """Update a tile. Returns None if tile not found."""
        tile_data = self.get(tile_id)
        if tile_data is None:
            return None

        now = datetime.now(UTC)
        if tile_update.terrain_data is not None:
            tile_data["terrain_data"] = tile_update.terrain_data
        if tile_update.features is not None:
            tile_data["features"] = tile_update.features
        tile_data["version"] += 1
        tile_data["updated_at"] = now

        return self._to_model(tile_data)

    def get_or_create(self, world_id: UUID, tx: int, ty: int) -> Tile:
        """Get a tile by coordinates, creating it if it doesn't exist."""
        tile = self.get_by_coords(world_id, tx, ty)
        if tile is not None:
            return tile
        return self.create(TileCreate(world_id=world_id, tx=tx, ty=ty))

    def _to_model(self, tile_data: dict) -> Tile:
        """Convert internal data to Tile model."""
        return Tile(
            id=tile_data["id"],
            world_id=tile_data["world_id"],
            tx=tile_data["tx"],
            ty=tile_data["ty"],
            terrain_data=tile_data["terrain_data"],
            features=tile_data["features"],
            created_at=tile_data["created_at"],
            updated_at=tile_data["updated_at"],
        )


# Singleton instance for the application
tile_repository = TileRepository()
