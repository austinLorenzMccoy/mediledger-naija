# Supabase migrations — run order

Apply in filename order (001 → 008). Do **not** skip 008 — it adds vault defaults, indexes, storage policies, and `update_patient_vault_seal`.

## One command (recommended)

```bash
cd backend

# Offline tests always (ZK + contracts). Migrate if DB reachable.
bash scripts/migrate-and-test.sh

# After migrations exist on Supabase:
bash scripts/migrate-and-test.sh --seed --local-zk

# Full flags:
#   --seed           seed NHIA-TEST-001 via REST
#   --http           start zk-vault (Docker if available)
#   --local-zk       start zk-vault with local Node + Redis (no Docker)
#   --skip-migrate   tests/seed/http only
```

### Fastest migrate path (no CLI password)

1. Open Supabase → **SQL Editor**
2. Paste **`all_migrations.sql`** (001–008 concatenated) → Run  
3. Then:

```bash
cd backend
bash scripts/migrate-and-test.sh --skip-migrate --seed --local-zk
```

## Hosted Supabase (file-by-file)

1. Open **SQL Editor**
2. Paste and run each file under `migrations/` in order (001 → 008)
3. Optional: `seed_test_patient.sql` or `node scripts/seed-via-rest.js`
4. Copy **Project URL** + **service_role** key into `backend/.env`

## CLI / psql

```bash
# Option A — connection string (Settings → Database → URI)
export DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-….pooler.supabase.com:6543/postgres'
cd backend && bash scripts/migrate-and-test.sh --seed

# Option B — Supabase CLI
cd backend/supabase
supabase login
supabase link --project-ref <your-ref>
supabase db push
```

## After migrate — verify implementation

```bash
# 1. Circuit + offline Groth16
cd backend/circuits && npm test

# 2. Offline ZK flow
cd backend/services/zk-vault && npm install && npm run test:integration

# 3. Smart contracts (includes on-chain verifier)
cd backend/contracts && npm install && npx hardhat compile && npx hardhat test

# 4. HTTP seal + verify (local Node + Redis)
cd backend
bash scripts/migrate-and-test.sh --skip-migrate --local-zk
```

Seal expects `dbUpdated: true` when patient `NHIA-TEST-001` exists and service role can update.
