"""
MediLedger Nigeria — Federated Learning Server
Flower-based server that coordinates weekly training rounds across 47 partner hospitals.
Runs inside ai-service on port 8080.
Logs round results to Hedera HCS topic: mediledger.federated
"""
from __future__ import annotations

import json
import logging
import os
from functools import partial
from typing import Optional

import flwr as fl
import numpy as np
from flwr.server.strategy import FedAvg
from flwr.common import Metrics, NDArrays, Parameters, Scalar
from sklearn.metrics import roc_auc_score

from models.disease_detector import MediLedgerDiagnosticModel, N_CLASSES

logger = logging.getLogger(__name__)

# ── Federated round configuration ────────────────────────────────────────────
MIN_FIT_CLIENTS      = 5    # Minimum hospitals per round
MIN_AVAILABLE_CLIENTS = 5
FRACTION_FIT         = 0.5  # Use 50% of available hospitals per round
AUC_THRESHOLD        = 0.80 # Model must exceed this or round is not published


def get_eval_fn(model: MediLedgerDiagnosticModel):
    """Return server-side evaluation function for validation after each round."""

    def evaluate(server_round: int, parameters: NDArrays, config: dict):
        model.set_weights(parameters)
        # Load synthetic Nigerian hold-out test set (Synthea-generated, stored locally)
        test_data = load_holdout_test_set()
        if test_data is None:
            logger.warning("No hold-out test set found — skipping server-side evaluation")
            return 0.0, {}

        X_test, y_test = test_data
        probs = model.predict_proba(X_test)
        try:
            auc = float(roc_auc_score(y_test, probs, multi_class="ovr", average="macro"))
        except ValueError:
            auc = 0.0

        logger.info(f"Round {server_round} — server-side AUC: {auc:.4f}")

        if auc < AUC_THRESHOLD:
            logger.warning(f"AUC {auc:.4f} below threshold {AUC_THRESHOLD} — model NOT published")

        return 1.0 - auc, {"auc_macro": auc}

    return evaluate


def fit_config(server_round: int) -> dict:
    """Send training config to hospital clients each round."""
    return {
        "server_round": server_round,
        "local_epochs": 5,
        "target_epsilon": 1.0,
        "target_delta": 1e-5,
        "max_grad_norm": 1.0,
        "batch_size": 64,
    }


def weighted_average(metrics: list[tuple[int, Metrics]]) -> Metrics:
    """Aggregate training metrics using sample-weighted average."""
    total = sum(n for n, _ in metrics)
    return {
        "loss": sum(n * m.get("loss", 0) for n, m in metrics) / total,
        "epsilon_spent": max(m.get("epsilon_spent", 0) for _, m in metrics),
    }


def load_holdout_test_set():
    """Load the synthetic Nigerian hold-out test set for server-side validation."""
    test_path = os.path.join(os.path.dirname(__file__), "..", "evaluation", "holdout_test.npz")
    if not os.path.exists(test_path):
        return None
    data = np.load(test_path)
    return data["X"], data["y"]


def start_federated_server(round_id: str) -> None:
    """Start a single federated learning round."""
    model = MediLedgerDiagnosticModel()

    strategy = FedAvg(
        fraction_fit=FRACTION_FIT,
        fraction_evaluate=0.3,
        min_fit_clients=MIN_FIT_CLIENTS,
        min_evaluate_clients=3,
        min_available_clients=MIN_AVAILABLE_CLIENTS,
        evaluate_fn=get_eval_fn(model),
        on_fit_config_fn=fit_config,
        fit_metrics_aggregation_fn=weighted_average,
    )

    logger.info(f"Starting federated round {round_id} — waiting for {MIN_FIT_CLIENTS}+ hospitals")

    fl.server.start_server(
        server_address="0.0.0.0:8080",
        strategy=strategy,
        config=fl.server.ServerConfig(num_rounds=1),  # 1 round per federation event
    )

    logger.info(f"Federated round {round_id} complete")
    # Result logging to Hedera HCS is done by the API layer after this returns
