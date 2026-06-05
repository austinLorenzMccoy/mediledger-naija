<div align="center">

# 🏥 MediLedger Nigeria

**Nigeria's first decentralized health data ecosystem**

*Patient-owned records · Blockchain-anchored consent · Zero-knowledge proof vaults · Federated AI diagnostics*

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)

[![Hedera](https://img.shields.io/badge/Hedera-Testnet_0.0.9115634-8A2BE2?style=for-the-badge&logo=hedera&logoColor=white)](https://hedera.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose_v24-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

[![ZK Circuits](https://img.shields.io/badge/ZK_Circuits-11%2F11_passing-22c55e?style=for-the-badge&logo=checkmarx&logoColor=white)](#-tests)
[![Contract Tests](https://img.shields.io/badge/Contract_Tests-27%2F27_passing-22c55e?style=for-the-badge&logo=checkmarx&logoColor=white)](#-tests)
[![Circom](https://img.shields.io/badge/Circom-2.1.8_Groth16_BN254-f97316?style=for-the-badge)](https://docs.circom.io)
[![Modal GPU](https://img.shields.io/badge/Modal-A10G_GPU_Federated_Rounds-6366f1?style=for-the-badge)](https://modal.com)

[![Node](https://img.shields.io/badge/Node.js-≥20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![uv](https://img.shields.io/badge/uv-Python_package_manager-DE5FE9?style=for-the-badge)](https://astral.sh/uv)
[![Data Residency](https://img.shields.io/badge/AWS-af--south--1_Cape_Town-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](#-data-residency--compliance)
[![License](https://img.shields.io/badge/License-Proprietary-ef4444?style=for-the-badge)](#-license)

</div>

---

## Vision

Healthcare data in Nigeria is fragmented across thousands of disconnected facilities, accessible to neither patients nor the clinicians who need it most. MediLedger Nigeria flips this model: every patient controls a cryptographic health vault sealed with a zero-knowledge proof, every consent is an immutable on-chain agreement, every insurance claim carries tamper-proof multisig, and a privacy-preserving AI engine surfaces early disease risk — all without centralizing raw data.

The system is designed to meet Nigeria's **Data Protection Act 2023**, **NHIA Act 2022**, and **NDPR** requirements from day one.

---

## Repository Structure

```
mediledgerNigeria/
├── frontend/                   Next.js 16 + shadcn/ui patient & provider dashboard
│   ├── app/                    App Router pages (layout, auth callback, root page)
│   ├── components/mediledger/  Feature components (dashboard, landing, wallet, sidebar)
│   ├── components/ui/          shadcn/ui primitives
│   ├── contexts/               AuthContext (Supabase) · WalletContext (Hedera)
│   ├── hooks/                  useWallet · useRealtimeSubscriptions
│   ├── lib/
│   │   ├── api/                Typed supabase-js clients (claims, consents, tokens …)
│   │   └── wallet/             HashPack · Blade · WalletConnect · Mock connectors
│   └── public/                 Logos, icons
│
├── backend/
│   ├── supabase/
│   │   ├── migrations/         PostgreSQL schema, RLS, realtime, triggers, storage
│   │   └── functions/          Deno Edge Functions (SMS, push, HCS audit, HEAL events)
│   │
│   ├── services/
│   │   ├── api-gateway/        NestJS :3000 — rate limiting, Supabase JWT guard, USSD
│   │   ├── auth-service/       NestJS :3001 — Hedera wallet auth, custodial wallets
│   │   ├── claims-service/     NestJS :3004 — on-chain claim submission
│   │   ├── token-service/      NestJS :3006 — HTS HEAL token transfers (4 decimals)
│   │   ├── emergency-service/  NestJS :3011 — sub-300 ms Redis hot cache
│   │   ├── zk-vault/           NestJS :3012 — ZK proof generation & verification
│   │   └── ai-service/         Python FastAPI :3008 — TabNet + Flower federated learning
│   │
│   ├── circuits/               Circom 2.1.8 ZK circuits (Groth16, BN254 curve)
│   │   ├── vault_integrity.circom      1,984 constraints — vault commitment + Merkle root
│   │   ├── condition_proof.circom      240 constraints  — condition value without record
│   │   ├── consent_scope.circom        28 constraints   — scope membership proof
│   │   ├── build/                      Compiled .r1cs + .wasm artifacts
│   │   ├── keys/                       .zkey proving keys + verification_key_*.json
│   │   └── scripts/
│   │       ├── setup-circuits.sh       Full trusted setup (one-time)
│   │       └── download-ptau.sh        Powers of Tau file
│   │
│   ├── contracts/              Solidity 0.8.20 smart contracts + Hardhat
│   │   ├── src/
│   │   │   ├── ConsentRegistry.sol           Privacy-preserving consent (hashed IDs)
│   │   │   ├── ClaimsProcessor.sol           3-of-3 multisig claims workflow
│   │   │   ├── EnrollmentVerifier.sol        NHIA enrollment status on-chain
│   │   │   ├── VaultIntegrityVerifier.sol    Groth16 verifier (exported by snarkjs)
│   │   │   └── VaultAwareConsentRegistry.sol ZK-gated consent (Phase 2)
│   │   └── scripts/            Deploy · Create HEAL token · Create HCS topics
│   │
│   └── shared/                 TypeScript types, Supabase admin client, internal-key guard
│
└── docs/
    ├── MediLedger_ZK_Vault_PRD_v1.0.0.docx
    ├── MediLedger_Backend_PRD_v2.0_Supabase.docx
    ├── MediLedger_AI_Federated_PRD_v1.0.0.docx
    └── Publication_and_Funding_Roadmap.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PATIENT  ·  PROVIDER  ·  HMO  ·  NHIA              │
│              Next.js 16  ·  shadcn/ui  ·  Tailwind CSS v4              │
│         HashPack  ·  Blade  ·  WalletConnect  ·  USSD *384*NHIA#       │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │  HTTPS / Next.js API proxy rewrites
┌───────────────────────────▼─────────────────────────────────────────────┐
│                      NestJS API Gateway  :3000                          │
│          Supabase JWT Guard  ·  Rate Limiting  ·  USSD Sessions         │
└──┬────────────┬────────────┬────────────┬────────────┬──────────────────┘
   │            │            │            │            │
   ▼            ▼            ▼            ▼            ▼
Auth :3001  Claims :3004 Tokens :3006 Emergency:3011 AI :3008
Hedera SDK  multisig.sol  HTS HEAL   Redis 1h TTL  TabNet+Flower
Wallet Auth Supabase      4 decimals sub-300ms     Opacus DP ε≤1
Custodial   persist       per-tx     SMS alert     FHIR 42 feat.
                                          │              │
                                          │         ZK Vault :3012
                                          │         Groth16 proofs
                                          │         vault_integrity
                                          │         condition_proof
                                          └────────►consent_scope
   │            │            │            │            │
   └────────────┴────────────┴────────────┴────────────┘
                             │  x-internal-key
                    ┌────────▼────────┐
                    │   Supabase      │  supabase.co  ·  AWS af-south-1
                    │  PostgreSQL 15  │  NDPA 2023 data residency
                    │  PostgREST      │  7 tables · Full RLS
                    │  Auth + RLS     │  4 realtime channels
                    │  Realtime WS    │  7 triggers · pg_cron SLA
                    │  Storage S3     │  50 MB medical-records store
                    │  Edge Fns Deno  │  4 Edge Functions
                    └────────┬────────┘
                             │
               ┌─────────────▼──────────────┐
               │     Hedera Hashgraph        │
               │  HCS: 5 audit topics        │
               │  HTS: HEAL token (4 dec)    │
               │  HSCS: 5 Solidity contracts │
               │  Testnet: chain ID 296      │
               │  Mainnet: chain ID 295      │
               └────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 · React 19 · TypeScript | Patient & provider web app |
| **UI System** | shadcn/ui · Radix UI · Tailwind CSS v4 | Component library |
| **Database** | Supabase — PostgreSQL 15 + PostgREST | Primary data store |
| **Auth** | Supabase Auth (Google OAuth · Magic Link · NHIA SAML · Hedera wallet) | Identity management |
| **Realtime** | Supabase Realtime (WebSocket) | Live claim / consent / token updates |
| **Storage** | Supabase Storage (S3-compatible, AES-256) | Encrypted FHIR blobs |
| **Edge Functions** | Deno (Supabase) | SMS / push notifications, HCS audit |
| **API Services** | NestJS — Node.js 20 LTS | Hedera SDK, USSD, ZK workloads |
| **ZK Proofs** | Circom 2.1.8 · snarkjs 0.7.4 · Groth16 BN254 | Health vault integrity proofs |
| **AI Inference** | Python 3.11 · FastAPI · uv | Federated learning, diagnostics |
| **ML Model** | TabNet · Opacus (ε ≤ 1.0) · Flower | Privacy-preserving diagnostics |
| **GPU Compute** | Modal — A10G, every Sunday 02:00 WAT | Federated learning rounds |
| **Blockchain** | Hedera Hashgraph — HCS + HTS + HSCS | Audit trail, token, contracts |
| **Smart Contracts** | Solidity 0.8.20 · Hardhat | Consent, claims, enrollment, ZK verifier |
| **Cache** | Redis 7.2 | USSD sessions, emergency cache, ZK proof cache |
| **SMS / USSD** | Africa's Talking | Notifications, USSD gateway |

---

## Core Features

### ZK Health Vault

Every patient's health vault is sealed with a **Groth16 zero-knowledge proof** generated from three Circom circuits. The AI inference engine verifies the vault proof before accessing any patient data. Proofs are cached in Redis (24-hour TTL for vault proofs, 48-hour for emergency condition proofs).

| Circuit | Constraints | Proves |
|---|---|---|
| `VaultIntegrity(8)` | 1,984 | Vault commitment + Merkle root of 8 records, without revealing any record |
| `ConditionProof` | 240 | A condition code exists in a record, without revealing the full record |
| `ConsentScopeProof(10)` | 28 | Requested data type is within the granted scope, without revealing the scope list |

### Patient Health Records
FHIR R4 records are AES-256 encrypted in Supabase Storage. Every access requires an active on-chain consent agreement in `ConsentRegistry.sol`, checked against a `keccak256`-hashed patient ID — no raw identifiers on-chain.

### Consent Management
Granular per-requester, per-purpose, time-limited consent agreements. Consent events trigger SMS notifications via Africa's Talking. Revocations propagate to the smart contract within seconds. A **50 HEAL** onboarding bonus is issued when a patient grants their first consent.

### Insurance Claims (3-of-3 Multisig)
Provider signs → patient countersigns → HMO approves. `ClaimsProcessor.sol` emits on-chain status transitions. SLA deadlines (48 h) are enforced by `pg_cron`; breaches surface in the NHIA regulator dashboard via Supabase Realtime.

### $HEAL Token (Hedera HTS)
Fungible token — 4 decimal places, 10 M initial supply, 100 M max. Patients earn HEAL for consenting to research access of their anonymized records. All transfers handled by `token-service`; balances sync to Supabase after each on-chain confirmation.

### AI Health Guardian
TabNet classifier — 42 FHIR features (LOINC labs, ICD-10 conditions, RxNorm medications, CVX vaccines, demographics) → 15 disease risk categories. Differential privacy (Opacus, ε ≤ 1.0, δ = 1e-5) on every local training round. Raw data never leaves the hospital. GPU federated rounds every **Sunday 02:00 WAT** on Modal A10G.

### Emergency Access (sub-300 ms)
First responders pull critical tags (blood type, allergies, emergency contacts) from Redis hot cache in < 1 ms. Every access fires a non-blocking SMS alert to the patient.

### USSD Gateway (`*384*NHIA#`)
70% of Nigerians use feature phones. Africa's Talking USSD → `api-gateway` → Redis session state (5-minute TTL). Patients can check NHIA enrollment, insurance coverage, HEAL balance, and manage emergency tags — no smartphone required.

---

## Tests

```bash
# ZK Circuit witness checks + end-to-end Groth16 proofs
cd backend/circuits && npm install && npm test

# Smart contract unit tests (Hardhat local network — no Hedera keys needed)
cd backend/contracts && npm install && npx hardhat test
```

| Suite | Result | Coverage |
|---|---|---|
| **ZK Circuits** — Circom + snarkjs | **11 / 11** | Witness generation, constraint rejection for each circuit, full Groth16 proof + verify for vault_integrity and condition_proof |
| **Solidity Contracts** — Hardhat | **27 / 27** | ConsentRegistry: deployment, grantConsent (6 cases), revokeConsent (4), hasActiveConsent (3), expireConsents (2), getPatientConsentIds (2), transferAdmin (4) |

---

## Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| Python | ≥ 3.11 | [python.org](https://python.org) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker + Compose | ≥ 24 | [docker.com](https://docker.com) |
| Supabase CLI | latest | `npm install -g supabase` |
| circom | 2.1.8 | Download from [iden3/circom releases](https://github.com/iden3/circom/releases/tag/v2.1.8) |

### 1. Clone & configure

```bash
git clone https://github.com/your-org/mediledger-nigeria.git
cd mediledger-nigeria

cp backend/.env.example backend/.env
# Fill in: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY (ECDSA hex),
#          SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#          (CLAIMS_CONTRACT_ID and HEAL_TOKEN_ID after step 4)

cp frontend/.env.local.example frontend/.env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 2. ZK Circuit trusted setup (once)

```bash
cd backend/circuits
npm install
bash scripts/setup-circuits.sh
# → keys/vault_integrity.zkey, condition_proof.zkey, consent_scope.zkey
# → keys/verification_key_*.json (for off-chain verification)
# → contracts/src/VaultIntegrityVerifier.sol (for on-chain verification)
```

> **Production note:** replace the local ptau with the [Hermez multi-party ceremony file](https://github.com/iden3/snarkjs#7-prepare-phase-2) for stronger security guarantees.

### 3. Start backend services

```bash
cd backend
docker compose up --build
# Redis · api-gateway · auth · claims · token · emergency · zk-vault · ai-service
```

### 4. Deploy to Hedera testnet

```bash
cd backend/contracts
npm install && npx hardhat compile
npx hardhat run scripts/deploy.js --network hedera_testnet
npx hardhat run scripts/deploy-verifier.js --network hedera_testnet
node scripts/create-heal-token.js
node scripts/create-hcs-topics.js
# Copy output IDs into backend/.env
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:3001
```

> Set `NEXT_PUBLIC_WALLET_MODE=mock` in `.env.local` to use the mock wallet — no browser extension or testnet required.

---

## Environment Variables

Full reference in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.local.example`](frontend/.env.local.example).

> **Never commit `.env` or `.env.local`** — both are covered by the root `.gitignore`.

---

## Data Residency & Compliance

| Requirement | Implementation |
|---|---|
| **Nigeria Data Protection Act 2023** | Supabase self-hosted on `aws:af-south-1` (Cape Town; Lagos region pending) |
| **NHIA Act 2022** | NHIA SAML SSO; treasury-managed HEAL supply; NHIA operator account as admin on all contracts |
| **Patient data sovereignty** | RLS policies enforce patients see only their own records; every third-party access requires an active on-chain consent |
| **Immutable audit trail** | Every sensitive action logged to HCS `mediledger.audit.main` using hashed identifiers |
| **ZK privacy** | Vault and condition proofs reveal zero raw data — verifier learns boolean validity only |
| **Differential privacy** | Federated learning rounds enforce ε ≤ 1.0, δ = 1e-5 via Opacus; weight deltas only, never raw records |
| **Key management** | ECDSA keys for HSCS/EVM compatibility; ED25519 for custodial wallets stored in AWS CloudHSM |

---

## Sub-project READMEs

| | |
|---|---|
| [**Frontend →**](frontend/README.md) | Next.js app, wallet connectors (window injection APIs), Supabase auth flows, realtime subscriptions |
| [**Backend →**](backend/README.md) | Supabase migrations, NestJS services, ZK circuits & trusted setup, AI service, Hedera contracts, Docker Compose |

---

## License

Proprietary — MediLedger Nigeria Ltd. All rights reserved.
