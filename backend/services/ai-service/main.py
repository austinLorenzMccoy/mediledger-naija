"""
MediLedger Nigeria — AI Service Entry Point
FastAPI application on port 3008
Internal-only; mTLS enforced at the api-gateway level
"""
import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router, load_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MediLedger AI Service",
    description="AI Health Guardian — Federated learning & diagnostic inference",
    version="1.0.0",
    docs_url=None,       # Disable Swagger in production
    redoc_url=None,
)

# Only allow internal service-mesh traffic
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://api-gateway:3000")],
    allow_methods=["POST", "GET"],
    allow_headers=["x-internal-key", "content-type"],
)

app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Load model weights on startup."""
    weights_path = os.environ.get("MODEL_WEIGHTS_PATH")
    model_version = os.environ.get("MODEL_VERSION", "v1.0.0")
    load_model(weights_path=weights_path, version=model_version)
    logger.info(f"AI service started — model version: {model_version}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3008,
        workers=2,
        log_level="info",
    )
