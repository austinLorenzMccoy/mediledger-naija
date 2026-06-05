"""
MediLedger Nigeria — AI Service FastAPI Routes
Port 3008 — internal access only (mTLS from other services)
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from inference.engine import DiagnosticResult, Insight, run_inference
from models.disease_detector import MediLedgerDiagnosticModel

logger = logging.getLogger(__name__)
router = APIRouter()

# Module-level model instance (loaded once at startup)
_model: Optional[MediLedgerDiagnosticModel] = None
_model_version: str = "unloaded"


def get_model() -> MediLedgerDiagnosticModel:
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    return _model


# ── Auth: internal key guard ──────────────────────────────────────────────────
def verify_internal_key(x_internal_key: str = Header(default="")):
    if x_internal_key != os.environ.get("INTERNAL_API_KEY", ""):
        raise HTTPException(status_code=401, detail="Invalid internal API key")


# ── Inference endpoints ───────────────────────────────────────────────────────

class InferenceResponse(BaseModel):
    patient_nhia_id: str
    inference_at: str
    model_version: str
    insights: list[dict]
    privacy_guarantee: dict
    hcs_audit_ref: str


@router.post("/ai/infer/{patient_nhia_id}", response_model=InferenceResponse)
async def infer(
    patient_nhia_id: str,
    model: MediLedgerDiagnosticModel = Depends(get_model),
    _: None = Depends(verify_internal_key),
):
    """Run full diagnostic inference on a patient vault."""
    try:
        result = await run_inference(patient_nhia_id, model, _model_version)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return InferenceResponse(
        patient_nhia_id=result.patient_nhia_id,
        inference_at=result.inference_at,
        model_version=result.model_version,
        insights=[vars(i) for i in result.insights],
        privacy_guarantee=result.privacy_guarantee,
        hcs_audit_ref=result.hcs_audit_ref,
    )


@router.get("/ai/insights/{patient_nhia_id}")
async def get_cached_insights(
    patient_nhia_id: str,
    _: None = Depends(verify_internal_key),
):
    """Return cached insights (1-hour TTL). Triggers inference if cache miss."""
    import redis as _redis
    r = _redis.Redis(host=os.environ.get("REDIS_HOST", "localhost"), port=6379, decode_responses=True)
    cache_key = f"insights:{patient_nhia_id}"
    cached = r.get(cache_key)
    if cached:
        import json
        return json.loads(cached)

    model = get_model()
    result = await run_inference(patient_nhia_id, model, _model_version)
    serialized = [vars(i) for i in result.insights]

    import json
    r.setex(cache_key, 3600, json.dumps(serialized))
    return serialized


# ── Drug interaction check ────────────────────────────────────────────────────

class InteractionCheckRequest(BaseModel):
    rxnorm_codes: list[str]
    patient_nhia_id: Optional[str] = None


class InteractionResult(BaseModel):
    drug_a: str
    drug_b: str
    severity: str
    mechanism: str
    recommendation: str


@router.post("/ai/interactions/check")
async def check_interactions(
    req: InteractionCheckRequest,
    _: None = Depends(verify_internal_key),
):
    """Check drug-drug interactions for a given set of RxNorm codes."""
    # Rule engine — in production backed by WHO Essential Medicines DB in PostgreSQL
    interactions: list[InteractionResult] = []
    codes = req.rxnorm_codes

    # Placeholder: return empty for now; populate with full WHO interaction rules
    known_pairs = {
        ("203164", "744842"): InteractionResult(
            drug_a="Artemether",
            drug_b="Efavirenz",
            severity="major",
            mechanism="CYP3A4 induction reduces artemether plasma levels",
            recommendation="Consider alternative antimalarial or adjust dose with specialist guidance",
        ),
    }

    for i in range(len(codes)):
        for j in range(i + 1, len(codes)):
            pair = (codes[i], codes[j])
            rev_pair = (codes[j], codes[i])
            hit = known_pairs.get(pair) or known_pairs.get(rev_pair)
            if hit:
                interactions.append(hit)

    return {"interactions": [vars(r) for r in interactions], "checked_pairs": len(codes) * (len(codes) - 1) // 2}


# ── Federated round management ────────────────────────────────────────────────

class FederatedRoundRequest(BaseModel):
    round_id: str


@router.post("/ai/federated/start-round")
async def start_federated_round(
    req: FederatedRoundRequest,
    _: None = Depends(verify_internal_key),
):
    """Initiate a federated learning round (non-blocking — runs in background)."""
    from federated.server import start_federated_server
    asyncio.create_task(asyncio.to_thread(start_federated_server, req.round_id))
    return {"round_id": req.round_id, "status": "started", "started_at": datetime.now(timezone.utc).isoformat()}


@router.get("/ai/model/metadata")
async def get_model_metadata(_: None = Depends(verify_internal_key)):
    """Return current global model version and capabilities."""
    return {
        "model_version": _model_version,
        "loaded": _model is not None,
        "n_features": 42,
        "n_classes": 15,
        "architecture": "TabNet",
        "privacy_budget": {"epsilon": 1.0, "delta": 1e-5},
        "inference_threshold": 0.65,
    }


# ── Model loading (called on startup) ────────────────────────────────────────

def load_model(weights_path: Optional[str] = None, version: str = "v1.0.0") -> None:
    """Load model weights into the module-level instance."""
    global _model, _model_version
    _model = MediLedgerDiagnosticModel()
    if weights_path and os.path.exists(weights_path):
        import numpy as np
        weights = list(np.load(weights_path, allow_pickle=True).values())
        _model.set_weights(weights)
        logger.info(f"Loaded model weights from {weights_path}")
    else:
        logger.warning("No weights file found — model will require a federated round before inference")
    _model_version = version
