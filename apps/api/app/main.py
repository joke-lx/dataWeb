"""FastAPI application entrypoint for dataWeb backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.routes import bed, bigwig, ctcf, ctcf_motif, derived, differential, download, hic, samples, species, sv


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the optional DB engine at startup so misconfiguration fails fast;
    # when DATAWEB_DATABASE_URL is unset the layer stays disabled.
    if db.is_enabled():
        db.ping()
    yield
    db.dispose()


app = FastAPI(
    title="dataWeb API",
    version="0.1.0",
    description="Scaffold for the dataWeb multi-omics browser backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8181"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/health/db")
async def health_db() -> dict:
    """Database connectivity check (best-effort; never raises)."""
    status = db.ping()
    return {"database": status["ok"], "error": status["error"]}


# Mock data routes (Task B + Task J)
app.include_router(species.router)
app.include_router(samples.router)
app.include_router(hic.router)
app.include_router(bigwig.router)
app.include_router(bed.router)
app.include_router(differential.router)
app.include_router(derived.router)
app.include_router(ctcf.router)
app.include_router(ctcf_motif.router)
app.include_router(sv.router)
app.include_router(download.router)
