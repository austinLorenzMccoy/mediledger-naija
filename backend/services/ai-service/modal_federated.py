"""
MediLedger Nigeria — Modal Federated Learning Deployment
Runs the Flower federated server on Modal with GPU acceleration.

Replaces the current pg_cron → NestJS asyncio.create_task chain with a
first-class scheduled job: GPU access, built-in logging, and auto-scaling.

Real-time inference (/ai/infer) stays in Docker for network-local latency.
This file handles ONLY the weekly training round and post-round weight export.

Deploy:
  modal deploy modal_federated.py

Schedule:
  Runs every Sunday at 02:00 WAT (01:00 UTC) automatically via Modal Cron.
  Can also be triggered manually: modal run modal_federated.py::run_federated_round

Secrets (set once via modal CLI):
  modal secret create mediledger-secrets \
    SUPABASE_URL=... \
    SUPABASE_SERVICE_ROLE_KEY=... \
    INTERNAL_API_KEY=... \
    REDIS_HOST=... \
    REDIS_PASSWORD=...
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import modal

logger = logging.getLogger(__name__)

# ── Modal app definition ──────────────────────────────────────────────────────

app = modal.App("mediledger-federated-learning")

# Persistent volume: stores trained model weights between rounds
# Mounted at /weights inside the container — maps to ai_weights Docker volume equivalent
weights_volume = modal.Volume.from_name("mediledger-model-weights", create_if_missing=True)

# Docker image: same deps as the Docker ai-service, GPU-enabled
federated_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_pyproject_toml("pyproject.toml")
    .copy_local_dir(".", "/app")
)


# ── Federated round function ──────────────────────────────────────────────────

@app.function(
    image=federated_image,
    gpu="A10G",                          # GPU for faster FedAvg aggregation + TabNet
    cpu=4,
    memory=8192,
    timeout=3600,                        # 1-hour max per round
    schedule=modal.Cron("0 1 * * 0"),   # Sunday 01:00 UTC = 02:00 WAT
    volumes={"/weights": weights_volume},
    secrets=[modal.Secret.from_name("mediledger-secrets")],
)
def run_federated_round():
    """
    Weekly federated learning round.
    Flower server collects weight updates from ≥5 hospital clients,
    runs FedAvg, validates AUC ≥ 0.80, and exports weights to /weights.
    """
    import sys
    sys.path.insert(0, "/app")

    from federated.server import start_federated_server

    round_id = f"round_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    logger.info(f"Starting federated round: {round_id}")

    try:
        metrics = start_federated_server(round_id=round_id, weights_dir="/weights")
        logger.info(f"Round {round_id} complete: {metrics}")
        _notify_completion(round_id, metrics)
        return {"round_id": round_id, "status": "success", "metrics": metrics}
    except Exception as exc:
        logger.error(f"Round {round_id} failed: {exc}")
        _notify_failure(round_id, str(exc))
        raise


# ── On-demand inference model reload ─────────────────────────────────────────

@app.function(
    image=federated_image,
    volumes={"/weights": weights_volume},
    secrets=[modal.Secret.from_name("mediledger-secrets")],
    timeout=120,
)
def export_weights_to_supabase(round_id: str):
    """
    After a successful round, push the latest model weights to Supabase Storage
    so the Docker ai-service can hot-reload them without a container restart.
    """
    import sys
    sys.path.insert(0, "/app")

    import glob
    from supabase import create_client

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    weight_files = sorted(glob.glob(f"/weights/model_{round_id}*.npy"))
    if not weight_files:
        logger.warning(f"No weight file found for round {round_id}")
        return

    latest = weight_files[-1]
    dest   = f"model_weights/{round_id}.npy"

    with open(latest, "rb") as f:
        supabase.storage.from_("model-weights").upload(dest, f.read(), {"upsert": "true"})

    logger.info(f"Weights exported to Supabase Storage: {dest}")
    return {"exported": dest}


# ── Private helpers ───────────────────────────────────────────────────────────

def _notify_completion(round_id: str, metrics: dict) -> None:
    """Post round completion to the NestJS API Gateway → NHIA Slack webhook."""
    import httpx
    api_url = os.environ.get("NESTJS_API_URL", "http://localhost:3000")
    try:
        httpx.post(
            f"{api_url}/api/v1/ai/federated/round-complete",
            json={"round_id": round_id, "metrics": metrics},
            headers={"x-internal-key": os.environ.get("INTERNAL_API_KEY", "")},
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"Failed to notify API Gateway of round completion: {e}")


def _notify_failure(round_id: str, error: str) -> None:
    import httpx
    api_url = os.environ.get("NESTJS_API_URL", "http://localhost:3000")
    try:
        httpx.post(
            f"{api_url}/api/v1/ai/federated/round-failed",
            json={"round_id": round_id, "error": error},
            headers={"x-internal-key": os.environ.get("INTERNAL_API_KEY", "")},
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"Failed to notify API Gateway of round failure: {e}")


# ── Local entrypoint for testing ──────────────────────────────────────────────

@app.local_entrypoint()
def main():
    """Run a federated round manually: modal run modal_federated.py"""
    result = run_federated_round.remote()
    print(f"Round result: {result}")
