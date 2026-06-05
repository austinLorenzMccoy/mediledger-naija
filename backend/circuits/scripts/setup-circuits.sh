#!/usr/bin/env bash
# Full trusted setup for all three MediLedger ZK circuits.
# Run ONCE before production deployment. Outputs committed to repo via Git LFS.
#
# Prerequisites:
#   npm install -g circom snarkjs
#   npm install          (installs circomlib)
#   bash scripts/download-ptau.sh

set -euo pipefail
cd "$(dirname "$0")/.."

SNARKJS="./node_modules/.bin/snarkjs"
PTAU="hermez_final_11.ptau"
CIRCUITS=("vault_integrity" "condition_proof" "consent_scope")

if [ ! -f "$PTAU" ]; then
  echo "ERROR: $PTAU not found. Run 'bash scripts/download-ptau.sh' first."
  exit 1
fi

mkdir -p build keys

for CIRCUIT in "${CIRCUITS[@]}"; do
  echo ""
  echo "══════════════════════════════════════════════"
  echo " Setting up: $CIRCUIT"
  echo "══════════════════════════════════════════════"

  # 1. Compile circuit
  echo "▶ Compiling $CIRCUIT.circom..."
  circom "${CIRCUIT}.circom" --r1cs --wasm --sym -o build/
  $SNARKJS r1cs info "build/${CIRCUIT}.r1cs"

  # 2. Phase 2 setup (circuit-specific proving key)
  echo "▶ Generating proving key (phase 2 setup)..."
  $SNARKJS groth16 setup \
    "build/${CIRCUIT}.r1cs" \
    "$PTAU" \
    "keys/${CIRCUIT}_0.zkey"

  # 3. Contribute randomness (MediLedger entropy contribution)
  echo "▶ Contributing randomness..."
  echo "MediLedger-Nigeria-$(date +%s)-$(openssl rand -hex 8)" | \
    $SNARKJS zkey contribute \
      "keys/${CIRCUIT}_0.zkey" \
      "keys/${CIRCUIT}_1.zkey" \
      --name="MediLedger Nigeria Production Contribution" -v

  # 4. Export final proving key (used at runtime)
  cp "keys/${CIRCUIT}_1.zkey" "keys/${CIRCUIT}.zkey"

  # 5. Export verification key (used for off-chain verify calls)
  $SNARKJS zkey export verificationkey \
    "keys/${CIRCUIT}.zkey" \
    "keys/verification_key_${CIRCUIT}.json"

  echo "✓ $CIRCUIT setup complete."
  echo "  Proving key:      keys/${CIRCUIT}.zkey"
  echo "  Verification key: keys/verification_key_${CIRCUIT}.json"
done

# Generate Solidity verifier for VaultIntegrity (deployed to Hedera HSCS)
echo ""
echo "▶ Generating VaultIntegrityVerifier.sol..."
$SNARKJS zkey export solidityverifier \
  "keys/vault_integrity.zkey" \
  "../contracts/VaultIntegrityVerifier.sol"

echo ""
echo "══════════════════════════════════════════════"
echo " All circuits set up successfully."
echo " Next: git lfs track '*.zkey' && git add keys/"
echo " Then: npx hardhat run ../contracts/scripts/deploy-verifier.js --network hedera_testnet"
echo "══════════════════════════════════════════════"
