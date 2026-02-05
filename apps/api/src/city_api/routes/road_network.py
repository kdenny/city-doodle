"""Road network CRUD endpoints - nodes and edges for the city road graph."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.database import get_db
from city_api.dependencies import get_current_user
from city_api.repositories import road_network as road_repo
from city_api.repositories import world as world_repo
from city_api.schemas import (
    RoadEdge,
    RoadEdgeBulkCreate,
    RoadEdgeCreate,
    RoadEdgeUpdate,
    RoadNetwork,
    RoadNetworkStats,
    RoadNode,
    RoadNodeBulkCreate,
    RoadNodeCreate,
    RoadNodeUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["road-network"])


async def _verify_world_ownership(db: AsyncSession, world_id: UUID, user_id: UUID) -> None:
    """Verify that the user owns the world. Raises HTTPException if not."""
    world = await world_repo.get_world(db, world_id)
    if world is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"World {world_id} not found",
        )
    if world.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this world",
        )


# ============================================================================
# Road Network Aggregate Endpoints
# ============================================================================


@router.get("/worlds/{world_id}/road-network", response_model=RoadNetwork)
async def get_road_network(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadNetwork:
    """Get the complete road network for a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await road_repo.get_road_network(db, world_id)


@router.get("/worlds/{world_id}/road-network/stats", response_model=RoadNetworkStats)
async def get_road_network_stats(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadNetworkStats:
    """Get statistics about the road network."""
    await _verify_world_ownership(db, world_id, user_id)
    return await road_repo.get_network_stats(db, world_id)


@router.delete("/worlds/{world_id}/road-network", status_code=status.HTTP_204_NO_CONTENT)
async def clear_road_network(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete all road nodes and edges in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    await road_repo.clear_road_network(db, world_id)


# ============================================================================
# Road Node Endpoints
# ============================================================================


@router.get("/worlds/{world_id}/road-nodes", response_model=list[RoadNode])
async def list_road_nodes(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[RoadNode]:
    """List all road nodes in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await road_repo.list_nodes_by_world(db, world_id)


@router.post(
    "/worlds/{world_id}/road-nodes",
    response_model=RoadNode,
    status_code=status.HTTP_201_CREATED,
)
async def create_road_node(
    world_id: UUID,
    node_create: RoadNodeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadNode:
    """Create a new road node (intersection or endpoint)."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    node_create.world_id = world_id
    return await road_repo.create_node(db, node_create)


@router.post(
    "/worlds/{world_id}/road-nodes/bulk",
    response_model=list[RoadNode],
    status_code=status.HTTP_201_CREATED,
)
async def create_road_nodes_bulk(
    world_id: UUID,
    bulk_create: RoadNodeBulkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[RoadNode]:
    """Create multiple road nodes in a single request."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    for node in bulk_create.nodes:
        node.world_id = world_id
    return await road_repo.create_nodes_bulk(db, bulk_create.nodes)


@router.get("/road-nodes/{node_id}", response_model=RoadNode)
async def get_road_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadNode:
    """Get a road node by ID."""
    node = await road_repo.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road node {node_id} not found",
        )
    await _verify_world_ownership(db, node.world_id, user_id)
    return node


@router.patch("/road-nodes/{node_id}", response_model=RoadNode)
async def update_road_node(
    node_id: UUID,
    node_update: RoadNodeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadNode:
    """Update a road node."""
    # First verify the node exists and user owns the world
    node = await road_repo.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road node {node_id} not found",
        )
    await _verify_world_ownership(db, node.world_id, user_id)

    updated = await road_repo.update_node(db, node_id, node_update)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road node {node_id} not found",
        )
    return updated


@router.delete("/road-nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_road_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a road node. Connected edges will also be deleted."""
    node = await road_repo.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road node {node_id} not found",
        )
    await _verify_world_ownership(db, node.world_id, user_id)
    await road_repo.delete_node(db, node_id)


# ============================================================================
# Road Edge Endpoints
# ============================================================================


@router.get("/worlds/{world_id}/road-edges", response_model=list[RoadEdge])
async def list_road_edges(
    world_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[RoadEdge]:
    """List all road edges in a world."""
    await _verify_world_ownership(db, world_id, user_id)
    return await road_repo.list_edges_by_world(db, world_id)


@router.post(
    "/worlds/{world_id}/road-edges",
    response_model=RoadEdge,
    status_code=status.HTTP_201_CREATED,
)
async def create_road_edge(
    world_id: UUID,
    edge_create: RoadEdgeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadEdge:
    """Create a new road edge (road segment between two nodes)."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    edge_create.world_id = world_id

    edge = await road_repo.create_edge(db, edge_create)
    if edge is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or both nodes do not exist",
        )
    return edge


@router.post(
    "/worlds/{world_id}/road-edges/bulk",
    response_model=list[RoadEdge],
    status_code=status.HTTP_201_CREATED,
)
async def create_road_edges_bulk(
    world_id: UUID,
    bulk_create: RoadEdgeBulkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[RoadEdge]:
    """Create multiple road edges in a single request."""
    await _verify_world_ownership(db, world_id, user_id)
    # Override world_id from path
    for edge in bulk_create.edges:
        edge.world_id = world_id
    return await road_repo.create_edges_bulk(db, bulk_create.edges)


@router.get("/road-edges/{edge_id}", response_model=RoadEdge)
async def get_road_edge(
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadEdge:
    """Get a road edge by ID."""
    edge = await road_repo.get_edge(db, edge_id)
    if edge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road edge {edge_id} not found",
        )
    await _verify_world_ownership(db, edge.world_id, user_id)
    return edge


@router.get("/road-nodes/{node_id}/edges", response_model=list[RoadEdge])
async def list_edges_for_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> list[RoadEdge]:
    """List all edges connected to a node."""
    node = await road_repo.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road node {node_id} not found",
        )
    await _verify_world_ownership(db, node.world_id, user_id)
    return await road_repo.list_edges_by_node(db, node_id)


@router.patch("/road-edges/{edge_id}", response_model=RoadEdge)
async def update_road_edge(
    edge_id: UUID,
    edge_update: RoadEdgeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> RoadEdge:
    """Update a road edge."""
    edge = await road_repo.get_edge(db, edge_id)
    if edge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road edge {edge_id} not found",
        )
    await _verify_world_ownership(db, edge.world_id, user_id)

    updated = await road_repo.update_edge(db, edge_id, edge_update)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road edge {edge_id} not found",
        )
    return updated


@router.delete("/road-edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_road_edge(
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user),
) -> None:
    """Delete a road edge."""
    edge = await road_repo.get_edge(db, edge_id)
    if edge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road edge {edge_id} not found",
        )
    await _verify_world_ownership(db, edge.world_id, user_id)
    await road_repo.delete_edge(db, edge_id)
