#!/usr/bin/env bash
# MediLedger Nigeria — one command migrate + test
#
# Usage (from backend/):
#   bash scripts/migrate-and-test.sh
#   bash scripts/migrate-and-test.sh --seed
#   bash scripts/migrate-and-test.sh --http
#   bash scripts/migrate-and-test.sh --seed --http
#   bash scripts/migrate-and-test.sh --skip-migrate
#   bash scripts/migrate-and-test.sh --local-zk     # HTTP without Docker
#
# Migrations:
#   1) DATABASE_URL / SUPABASE_DB_URL + psql  (preferred automation)
#   2) supabase CLI (linked project)
#   3) Manual: paste supabase/all_migrations.sql in SQL Editor, then re-run with --skip-migrate --seed --http
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-env.sh"

DO_SEED=false
DO_HTTP=false
SKIP_MIGRATE=false
LOCAL_ZK=false
for arg in "$@"; do
  case "$arg" in
    --seed) DO_SEED=true ;;
    --http) DO_HTTP=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --local-zk) LOCAL_ZK=true; DO_HTTP=true ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
  esac
done

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

need node
need npm
[ -n "${SUPABASE_URL:-}" ] || die "SUPABASE_URL not set in backend/.env"
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || die "SUPABASE_SERVICE_ROLE_KEY not set"
[ -n "${INTERNAL_API_KEY:-}" ] || die "INTERNAL_API_KEY not set"

PROJECT_REF="$(echo "$SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co.*|\1|p')"
ok "Env loaded (project ref: ${PROJECT_REF:-unknown})"

# ── DNS / reachability check ──────────────────────────────────────────
log "Checking Supabase reachability"
if ! curl -sf -m 10 -o /dev/null "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" 2>/dev/null; then
  # rest root may 404 but host must resolve
  if ! curl -sS -m 10 -o /dev/null -w '%{http_code}' \
    "$SUPABASE_URL/auth/v1/health" 2>/tmp/sb-curl.err | grep -qE '200|401|404'; then
    warn "Cannot reach $SUPABASE_URL"
    if [ -f /tmp/sb-curl.err ]; then cat /tmp/sb-curl.err; fi
    warn "DNS NXDOMAIN usually means the project was paused/deleted or the URL is wrong."
    warn "Fix: Supabase Dashboard → Project Settings → API → copy Project URL"
    warn "Migrations can still be applied when the project is reachable."
    if [ "$SKIP_MIGRATE" = false ]; then
      warn "Continuing with offline tests only. Use --skip-migrate after fixing URL."
    fi
    SB_REACHABLE=false
  else
    SB_REACHABLE=true
  fi
else
  SB_REACHABLE=true
fi

# ── 1. Migrations ─────────────────────────────────────────────────────
if [ "$SKIP_MIGRATE" = false ] && [ "${SB_REACHABLE:-false}" = true ]; then
  log "Applying migrations"
  DBURL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
  if [ -n "$DBURL" ] && command -v psql >/dev/null 2>&1; then
    for f in supabase/migrations/*.sql; do
      name="$(basename "$f")"
      if psql "$DBURL" -v ON_ERROR_STOP=1 -f "$f" >"/tmp/ml-$name.log" 2>&1; then
        ok "Applied $name"
      elif grep -qiE 'already exists|duplicate' "/tmp/ml-$name.log"; then
        ok "Already applied $name"
      else
        warn "Failed $name — see /tmp/ml-$name.log"
        tail -15 "/tmp/ml-$name.log" || true
      fi
    done
  elif command -v supabase >/dev/null 2>&1 && { [ -f supabase/.temp/project-ref ] || [ -f supabase/.supabase/project-ref ]; }; then
    (cd supabase && supabase db push --include-all)
    ok "supabase db push done"
  else
    warn "No DATABASE_URL and project not linked."
    echo ""
    echo "  One-paste migrate:"
    echo "    1. Open Supabase → SQL Editor"
    echo "    2. Paste contents of: backend/supabase/all_migrations.sql"
    echo "    3. Run, then: bash scripts/migrate-and-test.sh --skip-migrate --seed --http"
    echo ""
    echo "  Or set DATABASE_URL (Settings → Database → Connection string URI)"
    echo "  Or: cd supabase && supabase login && supabase link --project-ref $PROJECT_REF"
  fi
elif [ "$SKIP_MIGRATE" = true ]; then
  warn "Skipping migrations"
else
  warn "Skipping remote migrate (Supabase unreachable). Offline tests still run."
fi

# ── 2. Offline ZK ─────────────────────────────────────────────────────
log "Offline ZK (vault + condition + consent_scope)"
(
  cd services/zk-vault
  [ -d node_modules ] || npm install --no-fund --no-audit
  # Prefer local circuits tree over Docker mount path from .env
  export CIRCUITS_DIR="$ROOT/circuits"
  npm run test:integration
)
ok "Offline ZK OK"

# ── 3. Contracts ──────────────────────────────────────────────────────
log "Hardhat contract tests"
(
  cd contracts
  [ -d node_modules ] || npm install --no-fund --no-audit
  npx hardhat test
)
ok "Contracts OK"

# ── 4. Seed via REST ──────────────────────────────────────────────────
if [ "$DO_SEED" = true ]; then
  log "Seeding NHIA-TEST-001 via REST"
  if [ "${SB_REACHABLE:-false}" = true ]; then
    node scripts/seed-via-rest.js || warn "REST seed failed — try supabase/seed_test_patient.sql in SQL Editor"
  else
    warn "Skip seed — Supabase unreachable"
  fi
fi

# ── 5. HTTP path ──────────────────────────────────────────────────────
ZK_PID=""
cleanup() {
  if [ -n "$ZK_PID" ] && kill -0 "$ZK_PID" 2>/dev/null; then
    kill "$ZK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ "$DO_HTTP" = true ]; then
  log "HTTP zk-vault path"

  if [ "$LOCAL_ZK" = true ] || ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    warn "Using local zk-vault (no Docker)"
    # Redis
    if ! redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping 2>/dev/null | grep -q PONG; then
      die "Redis not running on ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}. Start Redis or Docker."
    fi
    ok "Redis up"

    (
      cd services/zk-vault
      [ -d dist ] || npm run build
      export CIRCUITS_DIR="$ROOT/circuits"
      export REDIS_HOST="${REDIS_HOST:-localhost}"
      export REDIS_PORT="${REDIS_PORT:-6379}"
      export REDIS_PASSWORD="${REDIS_PASSWORD:-}"
      export PORT=3012
      export SUPABASE_URL
      export SUPABASE_SERVICE_ROLE_KEY
      export INTERNAL_API_KEY
      # Avoid Nest dying on missing Redis password empty string quirks
      node dist/main
    ) > /tmp/zk-vault-local.log 2>&1 &
    ZK_PID=$!
  else
    docker compose up -d --build redis zk-vault-service
  fi

  log "Waiting for http://localhost:3012/api/v1/zk/health"
  for i in $(seq 1 45); do
    if curl -sf "http://localhost:3012/api/v1/zk/health" >/dev/null 2>&1; then
      ok "zk-vault healthy"
      curl -s "http://localhost:3012/api/v1/zk/health" | head -c 400; echo
      break
    fi
    if [ "$i" -eq 45 ]; then
      [ -f /tmp/zk-vault-local.log ] && tail -40 /tmp/zk-vault-local.log
      docker compose logs --tail=40 zk-vault-service 2>/dev/null || true
      die "zk-vault did not become healthy"
    fi
    sleep 1
  done

  # Seal with seed hashes (deterministic from seed script)
  H1="$(node -e "console.log(require('crypto').createHash('sha256').update('fhir-lab-record-1').digest('hex'))")"
  H2="$(node -e "console.log(require('crypto').createHash('sha256').update('fhir-rx-record-1').digest('hex'))")"
  SEAL_BODY=$(node -e "console.log(JSON.stringify({
    nhiaId: 'NHIA-TEST-001',
    vaultKeyHex: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    recordHashes: [process.argv[1], process.argv[2]],
  }))" "$H1" "$H2")

  log "POST /zk/seal-vault"
  SEAL_RESP="$(curl -s -w '\n%{http_code}' -X POST "http://localhost:3012/api/v1/zk/seal-vault" \
    -H "Content-Type: application/json" \
    -H "x-internal-key: $INTERNAL_API_KEY" \
    -d "$SEAL_BODY")"
  SEAL_CODE="$(echo "$SEAL_RESP" | tail -1)"
  SEAL_JSON="$(echo "$SEAL_RESP" | sed '$d')"
  echo "HTTP $SEAL_CODE $SEAL_JSON"
  [[ "$SEAL_CODE" == "200" || "$SEAL_CODE" == "201" ]] || die "seal-vault failed"

  PROOF_JSON="$(curl -sf "http://localhost:3012/api/v1/zk/proof/NHIA-TEST-001" \
    -H "x-internal-key: $INTERNAL_API_KEY")"
  VERIFY_BODY="$(node -e "const p=JSON.parse(process.argv[1]); console.log(JSON.stringify({proof:p.proof,publicSignals:p.publicSignals}))" "$PROOF_JSON")"
  VERIFY_JSON="$(curl -sf -X POST "http://localhost:3012/api/v1/zk/verify" \
    -H "Content-Type: application/json" \
    -H "x-internal-key: $INTERNAL_API_KEY" \
    -d "$VERIFY_BODY")"
  echo "verify: $VERIFY_JSON"
  echo "$VERIFY_JSON" | grep -q '"valid":true' || die "verify failed"

  if [ "${SB_REACHABLE:-false}" = true ]; then
    PATIENT_AFTER="$(curl -sf \
      "${SUPABASE_URL}/rest/v1/patients?nhia_id=eq.NHIA-TEST-001&select=nhia_id,zk_proof_hash,vault_public_key" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" || echo '[]')"
    echo "patient after seal: $PATIENT_AFTER"
  fi

  export ZK_VAULT_URL=http://localhost:3012
  (
    cd services/zk-vault
    npm run test:integration
  )
  ok "HTTP path OK"
fi

log "Done"
ok "migrate-and-test finished"
echo ""
echo "Files:"
echo "  supabase/all_migrations.sql   — one-paste into SQL Editor"
echo "  scripts/seed-via-rest.js       — seed after migrate"
echo "  scripts/migrate-and-test.sh    — this script"
