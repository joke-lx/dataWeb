"""``GET /api/species`` — list the registered species and their assemblies."""

from __future__ import annotations

from fastapi import APIRouter

from app.mock import SPECIES

router = APIRouter(prefix="/api", tags=["species"])


@router.get("/species")
async def list_species() -> list[dict]:
    """Return the registered species metadata."""
    return SPECIES