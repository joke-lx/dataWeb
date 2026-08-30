"""``GET /api/download/*`` — synthetic file downloads with HTTP Range support.

Contract
--------
* ``GET /api/download/files?sample=`` → JSON list of ``{file, format,
  size_bytes, description}``.
* ``GET /api/download/file?sample=&file=`` — byte-range streaming:
    - no ``Range`` header → ``200`` with ``Accept-Ranges`` / ``Content-Length``
    - ``Range: bytes=start-end`` → ``206`` with ``Content-Range`` and the sliced
      body (end optional; clamped to size-1)
    - unsatisfiable range (``start >= size``) → ``416`` + ``Content-Range: bytes */size``
    - unknown sample/file → ``404``
* ``HEAD`` mirrors ``GET`` headers without a body (full ``Content-Length``).

The body is generated lazily by ``app.mock.files`` — never materialised whole.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import Response, StreamingResponse

from app.mock.files import file_size, iter_file_bytes, sample_files

router = APIRouter(prefix="/api", tags=["download"])

# bytes=start-end (end optional); whitespace tolerated; single range only.
_RANGE_RE = re.compile(r"^\s*bytes=(\d+)-(\d*)\s*$")


def _attachment_headers(sample_id: str, filename: str) -> dict[str, str]:
    """Common headers for a file download (both GET full and range)."""
    return {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Genomics-Sample": sample_id,
    }


def _parse_range(value: str | None, size: int) -> tuple[int, int] | None:
    """Parse a single byte range → ``(start, end)`` inclusive, or ``None``.

    Returns ``None`` when the header is absent/ignorable. Raises
    ``ValueError`` for an unsatisfiable range (``start >= size``).
    """
    if value is None:
        return None
    match = _RANGE_RE.match(value)
    if not match:
        return None
    start = int(match.group(1))
    end_text = match.group(2)
    end = int(end_text) if end_text else size - 1
    if start >= size:
        raise ValueError("unsatisfiable")
    return start, min(end, size - 1)


def _stream_file(
    sample_id: str,
    filename: str,
    offset: int,
    length: int,
) -> Iterator[bytes]:
    """Lazily yield ``length`` bytes of the synthetic file from ``offset``."""
    return iter_file_bytes(sample_id, filename, offset, length)


@router.get("/download/files")
async def download_files(
    sample: Annotated[str, Query(description="Sample id, e.g. Brain_BF3")],
) -> Response:
    """Return the downloadable file catalog for a sample."""
    files = sample_files(sample)
    if not files:
        return Response(status_code=404, content="sample not found")
    return Response(
        content=json.dumps(files),
        media_type="application/json; charset=utf-8",
    )


@router.get("/download/file")
async def download_file(
    sample: Annotated[str, Query(description="Sample id")],
    file: Annotated[str, Query(description="File name from /download/files")],
    request: Request,
) -> Response:
    """Stream a synthetic file, honouring a single HTTP byte-range."""
    size = file_size(sample, file)
    if size is None:
        return Response(status_code=404, content="file not found")

    range_value = request.headers.get("range")
    try:
        bounds = _parse_range(range_value, size)
    except ValueError:
        return Response(
            status_code=416,
            headers={"Content-Range": f"bytes */{size}"},
        )

    headers = _attachment_headers(sample, file)
    if bounds is None:
        headers["Content-Length"] = str(size)
        return StreamingResponse(
            _stream_file(sample, file, 0, size),
            status_code=200,
            media_type="application/octet-stream",
            headers=headers,
        )

    start, end = bounds
    length = end - start + 1
    headers.update(
        {
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(length),
        }
    )
    return StreamingResponse(
        _stream_file(sample, file, start, length),
        status_code=206,
        media_type="application/octet-stream",
        headers=headers,
    )


@router.head("/download/file")
async def download_file_head(
    sample: Annotated[str, Query(description="Sample id")],
    file: Annotated[str, Query(description="File name")],
) -> Response:
    """Headers-only variant (full ``Content-Length``) for download tooling."""
    size = file_size(sample, file)
    if size is None:
        return Response(status_code=404, content="file not found")
    headers = _attachment_headers(sample, file)
    headers["Content-Length"] = str(size)
    return Response(status_code=200, headers=headers)
