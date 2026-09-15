"""Optional relational-database wiring for dataWeb.

Reads the ``DATAWEB_DATABASE_URL`` environment variable (a SQLAlchemy URL,
e.g. ``postgresql+psycopg://user:pass@host:5432/db``). When the variable is
unset — or SQLAlchemy is not installed — the DB layer is disabled and the app
keeps its existing file/mock fallback behavior, exactly as before.

The engine is created lazily on first use; nothing connects at import time.
"""

from __future__ import annotations

import os
from typing import Optional

# SQLAlchemy + psycopg are optional: install with `pip install -e '.[db]'`.
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Engine
    _SQLALCHEMY_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only without extras
    _SQLALCHEMY_AVAILABLE = False

DATABASE_URL = os.environ.get("DATAWEB_DATABASE_URL", "").strip()

_engine: Optional[Engine] = None


def is_enabled() -> bool:
    """True when a DB URL is configured and SQLAlchemy is importable."""
    return bool(DATABASE_URL) and _SQLALCHEMY_AVAILABLE


def get_engine() -> Optional[Engine]:
    """Return the lazily-created engine, or None when DB is disabled."""
    global _engine
    if not is_enabled():
        return None
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)
    return _engine


def ping() -> dict:
    """Probe the database with ``SELECT 1``.

    Returns ``{"ok": bool, "error": str | None}`` — never raises.
    """
    engine = get_engine()
    if engine is None:
        return {"ok": False, "error": "DATAWEB_DATABASE_URL not configured"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "error": None}
    except Exception as exc:  # noqa: BLE001 - surface any connection failure
        return {"ok": False, "error": str(exc)}


def dispose() -> None:
    """Release the engine's pool. Safe to call multiple times / when disabled."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
