# dataWeb API — FastAPI backend image
# Build context: repository root (see docker-compose*.yml / CI)
#   docker build -f apps/api/Dockerfile -t dataweb-api .
FROM python:3.11-slim

# pyBigWig (hard dependency in pyproject.toml) compiles native code and needs
# gcc + libcurl + zlib development headers. Remove the toolchain afterwards to
# keep the image small.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATAWEB_DATA_ROOT=/data

WORKDIR /app

# Install build toolchain, install Python deps, then purge the toolchain.
COPY apps/api/pyproject.toml ./
COPY apps/api/app ./app
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        gcc libcurl4-openssl-dev zlib1g-dev libz-dev; \
    pip install --no-cache-dir .; \
    apt-get purge -y --auto-remove gcc; \
    rm -rf /var/lib/apt/lists/*

# Data root is provided at runtime via a (possibly empty) volume; when reads
# fail the app falls back to deterministic mock data.
RUN mkdir -p /data

EXPOSE 8000

# Simple health probe used by compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
