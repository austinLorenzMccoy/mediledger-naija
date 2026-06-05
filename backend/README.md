# MediLedger Nigeria — Backend

Every server-side component: Supabase database layer, six NestJS microservices (including ZK Vault), a Python AI service, three Solidity smart contracts plus a Groth16 verifier, and three Circom ZK circuits — all running on Hedera Hashgraph testnet/mainnet.

---

## Directory Overview

```
backend/
├── supabase/
│   ├── migrations/         PostgreSQL migrations (001 → 007)
│   └── functions/          Deno Edge Functions (Supabase serverless)
│
├── services/
│   ├── api-gateway/        :3000  NestJS — public entry point, auth guard, USSD
│   ├── auth-service/       :3001  NestJS — Hedera wallet auth, custodial wallets
│   ├── claims-service/     :3004  NestJS — on-chain claim submission
│   ├── token-service/      :3006  NestJS — HTS HEAL token transfers
│   ├── emergency-service/  :3011  NestJS — sub-300 ms emergency data cache
│   ├── zk-vault/           :3012  NestJS — ZK proof generation & verification
│   └── ai-service/         :3008  Python FastAPI — AI inference + federated learning
│
├── circuits/               Circom 2.1.8 ZK circuits (Groth16, BN254 curve)
│   ├── vault_integrity.circom      Vault commitment + Merkle root of 8 records
│   ├── condition_proof.circom      Condition value without revealing health record
│   ├── consent_scope.circom        Scope membership without revealing scope list
│   ├── build/                      Compiled .r1cs + .wasm + .sym artifacts
│   ├── keys/                       .zkey proving keys + verification_key_*.json
│   ├── test/                       Mocha + circom_tester specs (11 tests)
│   └── scripts/
│       ├── setup-circuits.sh       Full trusted setup (one-time, ~2 minutes)
│       └── download-ptau.sh        Powers of Tau file download
│
├── contracts/
│   ├── src/
│   │   ├── ConsentRegistry.sol           Privacy-preserving consent (hashed IDs)
│   │   ├── ClaimsProcessor.sol           3-of-3 multisig claims workflow
│   │   ├── EnrollmentVerifier.sol        NHIA enrollment status on-chain
│   │   ├── VaultIntegrityVerifier.sol    Groth16 verifier (exported by snarkjs)
│   │   └── VaultAwareConsentRegistry.sol ZK-gated consent (Phase 2)
│   ├── test/                       Hardhat/Chai tests (27 tests)
│   ├── hardhat.config.js           Hardhat — hedera_testnet (296) + mainnet (295)
│   └── scripts/
│       ├── deploy.js
│       ├── deploy-verifier.js
│       ├── create-heal-token.js
│       └── create-hcs-topics.js
│
├── shared/
│   ├── types/database.types.ts
│   ├── utils/supabase-admin.ts
│   └── middleware/internal-key.guard.ts
│
├── docker-compose.yml
└── .env.example
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| Python | ≥ 3.11 | [python.org](https://python.org) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker + Compose | ≥ 24 | [docker.com](https://docker.com) |
| Supabase CLI | latest | `npm install -g supabase` |
| circom | 2.1.8 | Download binary from [iden3/circom releases](https://github.com/iden3/circom/releases/tag/v2.1.8) |

---

## Supabase

### Self-hosted deployment (production)

MediLedger Nigeria runs Supabase on `aws:af-south-1` (Cape Town) to satisfy the Nigeria Data Protection Act 2023 data residency requirement. The project URL is configured in `backend/.env`.

```bash
# Local development (Docker required)
cd backend/supabase
supabase start
# Outputs API URL, anon key, service_role key — copy to backend/.env

# Apply all migrations
supabase db push
```

### Migration sequence

| File | Contents |
|---|---|
| `001_core_schema.sql` | 7 core tables: `user_roles`, `patients`, `health_records`, `consent_agreements`, `insurance_claims`, `token_transactions`, `notification_log` |
| `002_enable_rls.sql` | Enables Row Level Security on all tables |
| `003_rls_policies.sql` | Full policy set: patients see own data; providers need active consent; NHIA reads all; Storage bucket policies |
| `004_enable_realtime.sql` | Realtime on `insurance_claims`, `consent_agreements`, `token_transactions`, `health_records` |
| `005_functions_triggers.sql` | `updated_at` auto-stamp · HEAL balance sync · SLA deadline setter · SLA breach checker · Consent auto-expiry · 3-of-3 multisig auto-approve · 50 HEAL onboarding bonus |
| `006_storage_buckets.sql` | Private `medical-records` bucket, 50 MB per file |
| `007_custodial_wallets.sql` | `patient_custodial_wallets` + `hcs_audit_log` tables |

### Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `consent-granted` | `consent_agreements` INSERT | SMS to patient via Africa's Talking |
| `claim-status-update` | `insurance_claims` UPDATE | SMS + web push on status change |
| `emergency-access-alert` | Called by emergency-service | SMS alert to patient after emergency data access |
| `task-completion-notification` | HEAL payment confirmed | SMS + NHIA Slack webhook + HCS audit log entry |

```bash
supabase functions deploy          # Deploy all
supabase functions deploy consent-granted  # Deploy one
```

Required secrets (set via `supabase secrets set`):

```
AT_API_KEY, AT_USERNAME, NHIA_SLACK_WEBHOOK,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_KEY
```

---

## ZK Vault Service `:3012`

The ZK Vault service generates and verifies Groth16 proofs using three Circom 2.1.8 circuits over the BN254 curve.

### Circuits

| Circuit | Constraints | Private inputs | Public inputs | Purpose |
|---|---|---|---|---|
| `vault_integrity` | 1,984 | vaultKey, recordHashes[8], patientNhiaIdHash | vaultCommitment, recordRoot, timestamp | Seals a vault on record upload |
| `condition_proof` | 240 | conditionValue, recordHash, vaultKey | conditionCode, conditionThreshold, recordRoot, vaultCommitment | Proves condition ∈ record without revealing record |
| `consent_scope` | 28 | scopeItems[10] | requestedType, vaultCommitment, scopeMerkleRoot | Proves requested type is within granted scope |

### Trusted setup (run once)

```bash
cd backend/circuits
npm install

# Option A: download Hermez ptau (production — multi-party trust)
bash scripts/download-ptau.sh

# Option B: generate local ptau (dev/testing)
SNARKJS=./node_modules/.bin/snarkjs
$SNARKJS powersoftau new bn128 12 pot12_0000.ptau
$SNARKJS powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="local" -e="entropy"
$SNARKJS powersoftau prepare phase2 pot12_0001.ptau hermez_final_11.ptau

# Run setup for all three circuits
bash scripts/setup-circuits.sh
```

Outputs: `keys/vault_integrity.zkey`, `keys/condition_proof.zkey`, `keys/consent_scope.zkey`, `keys/verification_key_*.json`, and a fresh `contracts/src/VaultIntegrityVerifier.sol`.

### Proof lifecycle

```
Record uploaded
  │
  └─► seal-vault  → vault_integrity proof  → Redis 24h cache
                                           → Supabase patients.zk_proof_hash

Inference request
  │
  ├─► get_vault_proof()   (Redis hit: <1ms)
  ├─► verify_zk_proof()   → reject if invalid
  └─► continue inference pipeline

Emergency access
  │
  └─► condition_proof pre-generated (Redis 48h, sub-10ms retrieval)
```

### Running circuit tests

```bash
cd backend/circuits
npm test     # 11 tests: 8 witness checks + 3 Groth16 end-to-end
```

---

## NestJS Microservices

All NestJS services follow: `src/main.ts` (port, helmet) → `src/app.module.ts` → `src/modules/` (feature modules).

### Running with Docker Compose

```bash
cd backend
docker compose up --build

# Rebuild one service
docker compose up --build zk-vault
```

### Service reference

#### API Gateway `:3000`
- Global `SupabaseAuthGuard` validates Supabase JWTs
- `@Public()` decorator exempts USSD, healthcheck
- Rate limiting: 100 req/min default · 20 req/min for `/ussd`
- USSD multi-step session handler (Redis TTL: 5 min)

#### Auth Service `:3001`
- Wallet challenge-response: random challenge → ED25519/ECDSA signature → Hedera SDK verify
- Mirror node public key resolution (24-hour Redis cache)
- Custodial wallet creation: generates ED25519 keys, creates Hedera accounts, associates HEAL token
- On success: `supabase.auth.admin.generateLink()` → Supabase-compatible JWT

#### Claims Service `:3004`
- `ClaimsProcessor.sol` via `ContractExecuteTransaction` (submitClaim, signClaim, approveClaim)
- NGN → tinybars conversion for on-chain amount encoding
- Persists Hedera transaction ID to `insurance_claims.hedera_tx_id`

#### Token Service `:3006`
- `TransferTransaction` for HTS HEAL transfers (4 decimal places = divide by 10,000)
- Treasury → patient (consent rewards, 50 HEAL onboarding bonus)
- Patient → treasury (premium payments)
- Every transfer inserts into `token_transactions` and fires the `task-completion-notification` Edge Function

#### Emergency Service `:3011`
- Redis hot cache key: `emergency:${nhia_id}`, 1-hour TTL
- Cache hit path: ~1 ms + HTTP overhead = well under 300 ms
- `triggerAccessAlert()` calls Edge Function as fire-and-forget (does not add to response latency)

#### ZK Vault Service `:3012`
- `sealVault(patientNhiaId, recordHashes, vaultKey)` → generates and caches vault_integrity proof
- `verifyVaultProof(proof, publicSignals)` → boolean (called by AI service before every inference)
- `proveCondition(patientNhiaId, conditionCode)` → generates condition_proof (pre-generated for emergency)
- `getConditionProof(patientNhiaId, conditionCode)` → returns cached proof (Redis 48h)
- All field elements encoded as BN254 prime field elements

---

## Python AI Service `:3008`

Managed by **uv** for fast, reproducible dependency resolution.

### Setup

```bash
cd services/ai-service
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 3008 --reload
```

### Project structure

```
ai-service/
├── main.py                    FastAPI app, providers, lifespan
├── pyproject.toml             uv dependencies
├── api/routes.py              HTTP endpoints
├── models/disease_detector.py TabNet wrapper (42 features → 15 disease classes)
├── inference/engine.py        Inference pipeline (ZK verify → FHIR → predict → HCS log)
├── pipeline/
│   ├── fhir_extractor.py      FHIR R4 → float32[42] feature vector
│   └── zk_client.py           HTTP client for zk-vault-service:3012
├── privacy/dp_trainer.py      Opacus DP training wrapper
├── federated/
│   ├── server.py              Flower FedAvg server (min 5 clients, AUC ≥ 0.80)
│   └── client.py              Hospital-side NumPyClient with DP training
└── modal_federated.py         Modal A10G GPU deployment (Sundays 02:00 WAT)
```

### Inference pipeline

```
Request nhia_id
  │
  ├─ 1. get_vault_proof(nhia_id)    — ZK vault service (Redis hit < 1ms)
  ├─ 2. verify_zk_proof(proof)      — reject if vault tampered or expired
  ├─ 3. Decrypt FHIR bundle         — Supabase Storage AES-256, in-memory only
  ├─ 4. FHIR R4 feature extraction  — (42,) float32 vector
  │      LOINC labs · ICD-10 · RxNorm · CVX · demographics
  ├─ 5. TabNet forward pass         — (15,) probability vector
  ├─ 6. Threshold filter (p ≥ 0.65) — Insight objects with severity + explanation
  └─ 7. Log to hcs_audit_log        — HCS submission handled async by NestJS
```

### Modal GPU deployment (federated learning)

```bash
cd services/ai-service

# Configure secrets (one-time)
modal secret create mediledger-secrets \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... INTERNAL_API_KEY=...

# Deploy — rounds auto-trigger every Sunday 02:00 WAT
modal deploy modal_federated.py

# Manual trigger
modal run modal_federated.py
```

GPU: A10G · Schedule: `0 1 * * 0` (01:00 UTC = 02:00 WAT) · Weights exported to Supabase Storage after each round.

### Privacy guarantees

| Parameter | Value |
|---|---|
| Privacy budget ε | ≤ 1.0 per round |
| Delta δ | 1 × 10⁻⁵ |
| Mechanism | Gaussian (Opacus PrivacyEngine) |
| L2 norm clipping | 1.0 |
| Aggregation | FedAvg (weight deltas, not raw weights) |

---

## Hedera Smart Contracts

### Compile & test

```bash
cd contracts
npm install
npx hardhat compile    # compiles all 5 contracts in src/
npx hardhat test       # 27 tests pass on Hardhat local network
```

### Deploy to testnet

```bash
# Deploy application contracts
npx hardhat run scripts/deploy.js --network hedera_testnet

# Deploy ZK verifier (after running setup-circuits.sh)
npx hardhat run scripts/deploy-verifier.js --network hedera_testnet

# Create HEAL token and HCS topics
node scripts/create-heal-token.js
node scripts/create-hcs-topics.js
```

Copy output IDs to `backend/.env`:
```
CLAIMS_CONTRACT_ID=0.0.XXXXXX
HEAL_TOKEN_ID=0.0.XXXXXX
VAULT_VERIFIER_CONTRACT_ADDRESS=0x...
```

### Hardhat config

Hedera JSON-RPC relay endpoints are used for Hardhat/Ethers.js compatibility:
- **Testnet**: `https://testnet.hashio.io/api` (chain ID 296)
- **Mainnet**: `https://mainnet.hashio.io/api` (chain ID 295)

The operator account must use an **ECDSA key** (not ED25519) for EVM/Solidity compatibility. Set `NHIA_DEPLOYER_PRIVATE_KEY_HEX` in `backend/.env` for deployment.

### Contract reference

#### `ConsentRegistry.sol`
Full consent lifecycle: `grantConsent` → `revokeConsent` → `expireConsents` (batch). All identifiers are `keccak256(nhia_id + salt)` — no raw IDs on-chain. `onlyNHIA` modifier on all write functions; admin transferred via governance timelock.

#### `ClaimsProcessor.sol`
Status: `Draft → Submitted → ProviderSigned → PatientSigned → HMOReview → Approved → Rejected → Paid → Disputed`. Auto-approves at 3-of-3 signatures.

#### `EnrollmentVerifier.sol`
`hasActiveEnrollment(patientHash)` · `batchVerify(patientHashes[])` (up to 100 patients per call).

#### `VaultIntegrityVerifier.sol`
Generated by `snarkjs zkey export solidityverifier`. Verifies Groth16 proofs on-chain (Phase 1 — off-chain verify is also supported via `zk-vault-service`).

#### `VaultAwareConsentRegistry.sol`
Phase 2 wrapper: calls `VaultIntegrityVerifier.verifyProof()` before delegating to `ConsentRegistry.grantConsent()`.

---

## Docker Compose

```bash
docker compose up --build     # Start everything
docker compose up --build zk-vault    # Rebuild one service
docker compose logs -f ai-service     # Stream logs
docker compose down           # Stop all
```

### Container reference

| Container | Port | Technology |
|---|---|---|
| `mediledger-redis` | 6379 | Redis 7.2 |
| `mediledger-api-gateway` | 3000 | NestJS |
| `mediledger-auth-service` | 3001 | NestJS |
| `mediledger-claims-service` | 3004 | NestJS |
| `mediledger-token-service` | 3006 | NestJS |
| `mediledger-emergency-service` | 3011 | NestJS |
| `mediledger-zk-vault` | 3012 | NestJS |
| `mediledger-ai-service` | 3008 | Python FastAPI (uv) |

### Named volumes

| Volume | Contents |
|---|---|
| `redis_data` | Redis persistence |
| `ai_weights` | Serialised TabNet weight files (`.npy`) updated after each federated round |
| `hospital_features` | Pre-extracted FHIR feature cache (`.npz`) for federated clients |
| `zk_circuits` | Compiled circuit artifacts and proving keys (mounted read-only into zk-vault) |

---

## Internal Service Authentication

All service-to-service calls use a shared secret header:

```
x-internal-key: <INTERNAL_API_KEY>
```

Generate with `openssl rand -hex 32`. Never exposed to the frontend.

---

## Environment Variables

See [`backend/.env.example`](../.env.example) for the full list. Key variables:

```bash
# Supabase
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Hedera (ECDSA for EVM compatibility)
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.XXXXXX
HEDERA_OPERATOR_KEY=0x<64-char hex private key>
HEDERA_EVM_ADDRESS=0x<40-char EVM address>
CLAIMS_CONTRACT_ID, HEAL_TOKEN_ID, HEAL_TREASURY_ACCOUNT_ID

# ZK Vault
ZK_VAULT_SERVICE_URL=http://zk-vault-service:3012
CIRCUITS_DIR=/circuits
VAULT_VERIFIER_CONTRACT_ADDRESS=0x...

# Shared secret
INTERNAL_API_KEY=<openssl rand -hex 32>

# Africa's Talking
AT_API_KEY, AT_USERNAME

# AI Service
HOSPITAL_ID=hospital_001
```

---

## Health Checks

Every service exposes `GET /health → { "status": "ok" }`. Docker Compose uses these for `depends_on` conditions. The AI service has a 90-second start grace period for model loading. `zk-vault` starts after Redis is healthy (proof cache dependency).
