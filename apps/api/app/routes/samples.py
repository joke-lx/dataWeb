"""``GET /api/species/{species}/samples`` — list samples for a species."""

from __future__ import annotations

from fastapi import APIRouter

from app.mock import SAMPLES

router = APIRouter(prefix="/api", tags=["samples"])


@router.get("/species/{species}/samples")
async def list_samples(species: str) -> list[dict]:
    """Return all mock samples for the requested ``species``."""
    return [s for s in SAMPLES if s.get("species") == species]