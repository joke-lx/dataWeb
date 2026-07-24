"""Pytest configuration: ensure the FastAPI `app` package is importable."""

import os
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))


@pytest.fixture(autouse=True)
def _skip_tests_requiring_real_data(request: pytest.FixtureRequest) -> None:
    """Auto-skip ``requires_real_data`` tests when the configured DATA_ROOT
    is missing or empty on disk.

    On the developer's Windows machine ``DATAWEB_DATA_ROOT`` defaults to
    ``D:\\qq\\猪多组学数据\\猪多组学数据`` (which exists), so real-data tests
    run. On CI runners no omics dataset is mounted, so they skip with a
    informative message instead of failing.
    """
    if "requires_real_data" not in request.keywords:
        return
    data_root = Path(os.environ.get("DATAWEB_DATA_ROOT", r"D:\qq\猪多组学数据\猪多组学数据"))
    if not data_root.exists() or not any(data_root.iterdir()):
        pytest.skip(f"requires real omics data at {data_root} (DATAWEB_DATA_ROOT)")

