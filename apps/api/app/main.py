"""FastAPI application entrypoint for dataWeb backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import bed, bigwig, ctcf, differential, hic, samples, species, sv


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Placeholder for startup/shutdown logic (DB pools, caches, etc.).
    yield


app = FastAPI(
    title="dataWeb API",
    version="0.1.0",
    description="Scaffold for the dataWeb multi-omics browser backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# Mock data routes (Task B + Task J)
app.include_router(species.router)
app.include_router(samples.router)
app.include_router(hic.router)
app.include_router(bigwig.router)
app.include_router(bed.router)
app.include_router(differential.router)
app.include_router(ctcf.router)
app.include_router(sv.router)