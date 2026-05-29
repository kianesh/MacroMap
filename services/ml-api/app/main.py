"""FastAPI entrypoint for the MacroMap ML service."""
from fastapi import FastAPI

from .routes.forecast import router as forecast_router

app = FastAPI(title="MacroMap ML API", version="1.0.0")


@app.get("/health")
def health() -> dict:
    """Liveness probe used by Railway's healthcheck."""
    return {"status": "ok"}


app.include_router(forecast_router)
