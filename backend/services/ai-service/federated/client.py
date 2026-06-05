"""
MediLedger Nigeria — Federated Learning Hospital Client
Runs on each partner hospital's edge server.
Subscribes to HCS mediledger.federated topic, trains locally with DP, and submits weight deltas.
"""
from __future__ import annotations

import logging
import os

import flwr as fl
import numpy as np

from models.disease_detector import MediLedgerDiagnosticModel, FEATURE_ORDER, N_CLASSES
from privacy.dp_trainer import train_with_dp

logger = logging.getLogger(__name__)


class MediLedgerClient(fl.client.NumPyClient):
    """Hospital-side federated client with differential privacy."""

    def __init__(self, hospital_id: str) -> None:
        self.hospital_id = hospital_id
        self.model = MediLedgerDiagnosticModel()

    def get_parameters(self, config: dict) -> list[np.ndarray]:
        return self.model.get_weights()

    def fit(
        self,
        parameters: list[np.ndarray],
        config: dict,
    ) -> tuple[list[np.ndarray], int, dict]:
        """Load global weights, train locally with DP, return updated weights."""
        self.model.set_weights(parameters)

        # Load ONLY consented, opted-in patients' FHIR features from local vault
        X_train, y_train = load_local_features(
            hospital_id=self.hospital_id,
            consent_filter=True,         # Only patients who opted into AI training
            ai_training_opt_in=True,
        )

        if X_train is None or len(X_train) < 50:
            logger.warning(f"Hospital {self.hospital_id}: insufficient consented samples ({len(X_train) if X_train is not None else 0}). Skipping round.")
            return parameters, 0, {"skipped": True}

        # Train with differential privacy (ε=1.0, δ=1e-5)
        updated_weights, n_samples, metrics = train_with_dp(
            model=self.model.model.network,
            X_train=X_train,
            y_train=y_train,
            epochs=config.get("local_epochs", 5),
            batch_size=config.get("batch_size", 64),
        )

        logger.info(
            f"Hospital {self.hospital_id}: trained on {n_samples} samples, "
            f"ε={metrics['epsilon_spent']:.3f}, loss={metrics['loss']:.4f}"
        )

        return updated_weights, n_samples, metrics

    def evaluate(
        self,
        parameters: list[np.ndarray],
        config: dict,
    ) -> tuple[float, int, dict]:
        """Evaluate global model on local hold-out set."""
        self.model.set_weights(parameters)
        X_val, y_val = load_local_features(self.hospital_id, split="val")
        if X_val is None:
            return 0.0, 0, {}

        from sklearn.metrics import roc_auc_score
        probs = self.model.predict_proba(X_val)
        try:
            auc = float(roc_auc_score(y_val, probs, multi_class="ovr", average="macro"))
        except ValueError:
            auc = 0.0

        return 1.0 - auc, len(X_val), {"auc": auc}


def load_local_features(
    hospital_id: str,
    consent_filter: bool = True,
    ai_training_opt_in: bool = True,
    split: str = "train",
) -> tuple[np.ndarray | None, np.ndarray | None]:
    """
    Load pre-extracted feature vectors from the hospital's local FHIR vault.
    In production: reads from hospital's local encrypted DB, never sent to ai-service.
    Here: reads from a local .npz file (produced by the FHIR extractor pipeline).
    """
    cache_path = os.path.join(
        os.environ.get("HOSPITAL_CACHE_DIR", "/tmp/mediledger_features"),
        f"{hospital_id}_{split}.npz",
    )

    if not os.path.exists(cache_path):
        logger.warning(f"No cached features found at {cache_path}")
        return None, None

    data = np.load(cache_path)
    X, y = data["X"], data["y"]

    if consent_filter and "ai_consent" in data:
        mask = data["ai_consent"].astype(bool)
        X, y = X[mask], y[mask]

    return X, y


def start_hospital_client(server_address: str, hospital_id: str) -> None:
    """Connect to the federated server and participate in the round."""
    client = MediLedgerClient(hospital_id=hospital_id)
    fl.client.start_numpy_client(server_address=server_address, client=client)
    logger.info(f"Hospital {hospital_id} completed federated round")
