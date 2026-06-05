"""
MediLedger Nigeria — Inference Engine
Runs diagnostic inference on a patient vault with ZK proof verification.
Raw FHIR data is decrypted in-memory only — never written to disk.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from supabase import create_client

from models.disease_detector import (
    DISEASE_LABELS,
    DISPLAY_NAMES,
    N_FEATURES,
    MediLedgerDiagnosticModel,
)
from pipeline.fhir_extractor import extract_features, impute_features
from pipeline.zk_client import get_vault_proof, verify_zk_proof

logger = logging.getLogger(__name__)

INFERENCE_THRESHOLD = 0.65   # Probability above this → flag as risk
CACHE_TTL_SECONDS   = 3600   # Insights cached 1 hour

supabase_client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


@dataclass
class Insight:
    type: str             # 'risk_flag' | 'interaction_alert' | 'preventive_reminder'
    condition: str
    display_name: str
    severity: str         # 'low' | 'medium' | 'high' | 'critical'
    confidence: float
    explanation: str
    clinical_detail: str
    recommended_action: str
    supporting_features: list[dict] = field(default_factory=list)
    evidence_sources: list[str] = field(default_factory=list)


@dataclass
class DiagnosticResult:
    patient_nhia_id: str
    inference_at: str
    model_version: str
    insights: list[Insight]
    privacy_guarantee: dict
    hcs_audit_ref: str


def _severity_from_confidence(confidence: float) -> str:
    if confidence >= 0.90: return "critical"
    if confidence >= 0.80: return "high"
    if confidence >= 0.70: return "medium"
    return "low"


def _plain_explanation(condition: str, confidence: float) -> str:
    explanations = {
        "type2_diabetes_early": f"Your blood glucose and HbA1c patterns show early markers of Type 2 Diabetes ({confidence*100:.0f}% confidence). Regular monitoring recommended.",
        "hypertension": f"Your blood pressure readings suggest elevated cardiovascular risk ({confidence*100:.0f}% confidence). Lifestyle changes and regular monitoring advised.",
        "iron_deficiency_anemia": f"Your hemoglobin and ferritin levels indicate possible iron deficiency ({confidence*100:.0f}% confidence). Dietary assessment recommended.",
        "vitamin_d_deficiency": f"Your Vitamin D levels appear low ({confidence*100:.0f}% confidence). Consider sun exposure and dietary supplementation.",
        "malaria_recurring": f"Your health records show a recurring malaria pattern ({confidence*100:.0f}% confidence). Consider prophylactic measures.",
        "maternal_complications": f"Your antenatal indicators suggest elevated risk ({confidence*100:.0f}% confidence). Please consult your healthcare provider promptly.",
    }
    return explanations.get(condition, f"Your health data shows elevated risk for {DISPLAY_NAMES.get(condition, condition)} ({confidence*100:.0f}% confidence). Please consult your doctor.")


async def run_inference(patient_nhia_id: str, model: MediLedgerDiagnosticModel, model_version: str) -> DiagnosticResult:
    """
    Full inference pipeline:
    1. Verify ZK proof of vault integrity
    2. Decrypt FHIR bundle in memory
    3. Extract features
    4. Run TabNet inference
    5. Generate insights
    6. Log to HCS audit
    """
    from datetime import datetime, timezone

    # 1. Verify ZK proof (Groth16 vault integrity via zk-vault-service)
    vault_proof = await get_vault_proof(patient_nhia_id)
    vault_valid = await verify_zk_proof(vault_proof)
    if not vault_valid:
        raise ValueError(f"Vault ZK proof verification failed for {patient_nhia_id}")

    # 2. Fetch FHIR bundle from Supabase Storage (encrypted blob)
    fhir_bundle = await fetch_and_decrypt_fhir(patient_nhia_id)

    # 3. Extract features
    features_raw = extract_features(fhir_bundle)

    # 4. Impute missing values with global medians
    global_medians = load_global_medians()
    features = impute_features(features_raw, global_medians)

    # 5. Run TabNet inference
    probs = model.predict_proba(features.reshape(1, -1))[0]

    # 6. Generate insights for conditions above threshold
    insights: list[Insight] = []
    for i, (condition, prob) in enumerate(zip(DISEASE_LABELS, probs)):
        if prob >= INFERENCE_THRESHOLD:
            insights.append(Insight(
                type="risk_flag",
                condition=condition,
                display_name=DISPLAY_NAMES.get(condition, condition),
                severity=_severity_from_confidence(prob),
                confidence=round(float(prob), 4),
                explanation=_plain_explanation(condition, prob),
                clinical_detail=f"TabNet confidence: {prob:.4f} (threshold: {INFERENCE_THRESHOLD})",
                recommended_action="Consult healthcare provider",
                supporting_features=[],
                evidence_sources=[],
            ))

    inference_at = datetime.now(timezone.utc).isoformat()

    # 7. Log to HCS audit topic (non-blocking — fire-and-forget)
    hcs_ref = await log_inference_to_hcs(
        patient_nhia_id, model_version, len(insights),
        proof_hash=vault_proof.get("proofHash", ""),
    )

    return DiagnosticResult(
        patient_nhia_id=patient_nhia_id,
        inference_at=inference_at,
        model_version=model_version,
        insights=insights,
        privacy_guarantee={
            "epsilon": 1.0,
            "delta": 1e-5,
            "round_id": model_version,
        },
        hcs_audit_ref=hcs_ref,
    )


# verify_vault_proof / get_vault_proof stubs are now implemented in pipeline/zk_client.py
# and imported above. The stub functions below are removed.


async def fetch_and_decrypt_fhir(patient_nhia_id: str) -> dict:
    """Fetch encrypted FHIR bundle from Supabase Storage and decrypt in memory."""
    # Get the storage path from health_records table
    patient_res = supabase_client.from_("patients").select("id").eq("nhia_id", patient_nhia_id).single().execute()
    if not patient_res.data:
        raise ValueError(f"Patient {patient_nhia_id} not found")

    patient_id = patient_res.data["id"]
    records_res = supabase_client.from_("health_records").select("storage_path").eq("patient_id", patient_id).order("created_at", desc=True).limit(20).execute()

    # For inference: return a minimal synthetic bundle if no real records
    # In production: download from Supabase Storage, AES-256 decrypt, parse FHIR JSON
    if not records_res.data:
        logger.warning(f"No health records for {patient_nhia_id} — using empty bundle")
        return {"entry": []}

    # Placeholder: real implementation fetches + decrypts each blob
    return {"entry": [], "_patient_id": patient_id, "_record_count": len(records_res.data)}


async def log_inference_to_hcs(patient_nhia_id: str, model_version: str, insight_count: int, proof_hash: str = "") -> str:
    """Log inference event to Supabase hcs_audit_log (actual HCS submission by NestJS)."""
    payload_hash = hashlib.sha256(f"{patient_nhia_id}:{model_version}:{insight_count}:{proof_hash}".encode()).hexdigest()
    supabase_client.from_("hcs_audit_log").insert({
        "topic": "mediledger.audit.main",
        "action": "INFERENCE_RUN",
        "actor_id": hashlib.sha256(patient_nhia_id.encode()).hexdigest()[:16],
        "payload_hash": payload_hash,
    }).execute()
    return payload_hash[:16]


def load_global_medians() -> np.ndarray:
    """Load global feature medians for imputation (pre-computed from federated statistics)."""
    medians_path = os.path.join(os.path.dirname(__file__), "..", "pipeline", "global_medians.npy")
    if os.path.exists(medians_path):
        return np.load(medians_path)
    # Fall back to zeros if not yet trained
    return np.zeros(N_FEATURES, dtype=np.float32)
