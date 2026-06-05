#!/usr/bin/env bash
# Download Hermez Network Powers of Tau (ptau 15 — supports up to 2^15 = 32,768 constraints)
# Using the public Hermez ceremony avoids running a MediLedger-specific setup.
# Security assumption: at least one of ~200 Hermez participants was honest.

set -euo pipefail

PTAU_FILE="hermez_final_11.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/hermez_final_11.ptau"
# ~13 MB — supports up to 2^11 = 2048 constraints.
# vault_integrity has 1984 constraints (largest circuit), so ptau 11 is sufficient.

cd "$(dirname "$0")/.."
SNARKJS="./node_modules/.bin/snarkjs"

if [ -f "$PTAU_FILE" ]; then
  echo "✓ $PTAU_FILE already exists — skipping download."
  echo "  Run 'snarkjs powersoftau verify $PTAU_FILE' to re-verify."
  exit 0
fi

echo "Downloading $PTAU_FILE from Hermez public ceremony..."
curl -L --progress-bar "$PTAU_URL" -o "$PTAU_FILE"

echo "Verifying Powers of Tau file..."
$SNARKJS powersoftau verify "$PTAU_FILE"

echo "✓ $PTAU_FILE downloaded and verified."
