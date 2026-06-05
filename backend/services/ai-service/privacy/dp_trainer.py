"""
MediLedger Nigeria — Differential Privacy Training Utilities
Wraps Opacus PrivacyEngine around local hospital training loops.
Target privacy budget: ε ≤ 1.0, δ = 1e-5 (Gaussian mechanism)
"""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from opacus import PrivacyEngine
from opacus.validators import ModuleValidator

TARGET_EPSILON = 1.0
TARGET_DELTA = 1e-5
MAX_GRAD_NORM = 1.0  # Gradient clipping L2 norm


def train_with_dp(
    model: nn.Module,
    X_train: np.ndarray,
    y_train: np.ndarray,
    epochs: int = 5,
    batch_size: int = 64,
) -> tuple[list[np.ndarray], int, dict]:
    """
    Train model with differential privacy using Opacus.
    Returns (updated_weights, n_samples, metrics).
    """
    n_samples = len(X_train)
    X_tensor = torch.FloatTensor(X_train)
    y_tensor = torch.LongTensor(y_train)
    dataset = TensorDataset(X_tensor, y_tensor)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, drop_last=True)

    # Ensure model is compatible with Opacus (replaces BatchNorm with GroupNorm)
    model = ModuleValidator.fix(model)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    privacy_engine = PrivacyEngine()
    model, optimizer, loader = privacy_engine.make_private_with_epsilon(
        module=model,
        optimizer=optimizer,
        data_loader=loader,
        epochs=epochs,
        target_epsilon=TARGET_EPSILON,
        target_delta=TARGET_DELTA,
        max_grad_norm=MAX_GRAD_NORM,
    )

    model.train()
    total_loss = 0.0
    for _epoch in range(epochs):
        for X_batch, y_batch in loader:
            optimizer.zero_grad()
            output = model(X_batch)
            loss = criterion(output, y_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

    epsilon_spent = privacy_engine.get_epsilon(delta=TARGET_DELTA)
    avg_loss = total_loss / (epochs * len(loader))

    # Extract weight tensors for federated aggregation
    weights = [p.data.cpu().numpy().copy() for p in model.parameters()]

    metrics = {
        "loss": avg_loss,
        "epsilon_spent": epsilon_spent,
        "delta": TARGET_DELTA,
        "n_samples": n_samples,
    }

    return weights, n_samples, metrics


def compute_weight_delta(
    local_weights: list[np.ndarray],
    global_weights: list[np.ndarray],
) -> list[np.ndarray]:
    """Compute Δw = w_local - w_global for transmission to HCS aggregator."""
    return [lw - gw for lw, gw in zip(local_weights, global_weights)]


def apply_fedavg(
    weight_deltas: list[list[np.ndarray]],
    n_samples: list[int],
    global_weights: list[np.ndarray],
) -> list[np.ndarray]:
    """
    Federated Averaging: w_global_new = w_global + Σ(n_k/n_total × Δw_k)
    """
    n_total = sum(n_samples)
    new_weights = [gw.copy() for gw in global_weights]

    for delta, n_k in zip(weight_deltas, n_samples):
        factor = n_k / n_total
        for i, dw in enumerate(delta):
            new_weights[i] += factor * dw

    return new_weights
