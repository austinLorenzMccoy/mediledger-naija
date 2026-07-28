-- MediLedger Nigeria — ALL MIGRATIONS (001-008)
-- Paste into Supabase SQL Editor and Run once.
-- Generated: 2026-07-28T10:13:32Z


-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_001_core_schema.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Core Schema
-- Migration 001: Core Tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── user_roles ──────────────────────────────────────────────────────
CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('patient','provider','hmo','nhia','researcher')),
  nhia_id     TEXT UNIQUE,        -- Populated for patient role
  facility_id UUID,               -- Populated for provider/hmo role
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── patients ─────────────────────────────────────────────────────────
CREATE TABLE patients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nhia_id             TEXT UNIQUE NOT NULL,
  hedera_account_id   TEXT UNIQUE,
  full_name           TEXT NOT NULL,       -- AES-256 encrypted at app layer
  date_of_birth       DATE NOT NULL,
  gender              TEXT CHECK (gender IN ('M','F','Other')),
  phone_number        TEXT UNIQUE NOT NULL,
  blood_type          TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  emergency_tag_active BOOLEAN DEFAULT TRUE,
  vault_public_key    TEXT NOT NULL,
  zk_proof_hash       TEXT NOT NULL,
  heal_balance        NUMERIC(15,4) DEFAULT 0,  -- Cache; source of truth = Hedera HTS
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()  -- Managed by trigger
);

-- ── health_records ───────────────────────────────────────────────────
CREATE TABLE health_records (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  record_type          TEXT NOT NULL CHECK (record_type IN ('lab','imaging','prescription','consultation','vaccination','surgical')),
  facility_id          UUID NOT NULL,
  fhir_resource_type   TEXT NOT NULL,
  storage_path         TEXT NOT NULL,   -- Supabase Storage bucket path (encrypted blob)
  record_hash          TEXT NOT NULL,   -- SHA-256 of raw record
  hcs_sequence_number  BIGINT,
  hcs_topic_id         TEXT,
  is_emergency_access  BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── consent_agreements ───────────────────────────────────────────────
CREATE TABLE consent_agreements (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  requester_user_id    UUID REFERENCES auth.users(id) NOT NULL,
  requester_type       TEXT CHECK (requester_type IN ('provider','hmo','researcher','emergency')),
  data_scope           JSONB NOT NULL,
  purpose              TEXT NOT NULL,
  monthly_payment_heal NUMERIC(10,4) DEFAULT 0,
  status               TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked','pending')),
  valid_from           TIMESTAMPTZ NOT NULL,
  valid_until          TIMESTAMPTZ NOT NULL,
  hcs_message_id       TEXT,
  revoked_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── insurance_claims ─────────────────────────────────────────────────
CREATE TABLE insurance_claims (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID REFERENCES patients(id) NOT NULL,
  provider_user_id    UUID REFERENCES auth.users(id) NOT NULL,
  hmo_user_id         UUID REFERENCES auth.users(id),
  nhia_program_id     UUID,
  service_date        DATE NOT NULL,
  icd10_codes         TEXT[] NOT NULL,
  total_amount_ngn    NUMERIC(15,2) NOT NULL,
  approved_amount_ngn NUMERIC(15,2),
  status              TEXT DEFAULT 'draft' CHECK (
    status IN ('draft','submitted','provider_signed','patient_signed',
               'hmo_review','approved','rejected','paid','disputed')
  ),
  patient_sig_hash    TEXT,
  provider_sig_hash   TEXT,
  hmo_sig_hash        TEXT,
  smart_contract_tx_id TEXT,
  sla_deadline        TIMESTAMPTZ,   -- Set by trigger: submitted_at + 48h
  sla_breached        BOOLEAN DEFAULT FALSE,
  rejection_reason    TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── token_transactions ───────────────────────────────────────────────
CREATE TABLE token_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_patient_id UUID REFERENCES patients(id),
  to_patient_id   UUID REFERENCES patients(id),
  consent_id      UUID REFERENCES consent_agreements(id),
  amount_heal     NUMERIC(15,4) NOT NULL,
  tx_type         TEXT CHECK (tx_type IN ('consent_payment','onboarding_bonus','claim_reward','withdrawal')),
  hedera_tx_id    TEXT UNIQUE,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── notification_log ─────────────────────────────────────────────────
CREATE TABLE notification_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL,
  patient_nhia_id TEXT NOT NULL,
  consent_id      UUID REFERENCES consent_agreements(id),
  claim_id        UUID REFERENCES insurance_claims(id),
  channel         TEXT NOT NULL CHECK (channel IN ('sms','email','push','slack')),
  sent_at         TIMESTAMPTZ NOT NULL,
  success         BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_002_enable_rls.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — RLS Enablement
-- Migration 002: Enable Row Level Security on all core tables

ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log   ENABLE ROW LEVEL SECURITY;
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_003_rls_policies.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — RLS Policies
-- Migration 003: Row Level Security policies for all tables

-- ── USER_ROLES ────────────────────────────────────────────────────────
CREATE POLICY "user_roles: self read"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_roles: nhia read all"
  ON user_roles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );

-- ── PATIENTS ──────────────────────────────────────────────────────────

-- Patients can only see and edit their own record
CREATE POLICY "patients: self access only"
  ON patients FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Providers can read patient records IF active consent exists
CREATE POLICY "patients: provider with consent"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consent_agreements ca
      WHERE ca.patient_id = patients.id
        AND ca.requester_user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.valid_until > NOW()
        AND ca.requester_type IN ('provider', 'hmo', 'researcher')
    )
  );

-- NHIA regulators can read all patient records (audit)
CREATE POLICY "patients: nhia read all"
  ON patients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );

-- ── HEALTH_RECORDS ────────────────────────────────────────────────────

-- Patients see only their own records
CREATE POLICY "health_records: patient self"
  ON health_records FOR ALL
  USING (
    patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Providers read records only with scoped consent
CREATE POLICY "health_records: provider consent scoped"
  ON health_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consent_agreements ca
      WHERE ca.patient_id = health_records.patient_id
        AND ca.requester_user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.valid_until > NOW()
        AND ca.data_scope @> jsonb_build_array(health_records.record_type)
    )
  );

-- NHIA can read all health records for audit purposes
CREATE POLICY "health_records: nhia read all"
  ON health_records FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );

-- ── CONSENT_AGREEMENTS ───────────────────────────────────────────────

-- Patients manage their own consents
CREATE POLICY "consents: patient owns"
  ON consent_agreements FOR ALL
  USING (
    patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Requesters see consents they requested
CREATE POLICY "consents: requester reads own"
  ON consent_agreements FOR SELECT
  USING (requester_user_id = auth.uid());

-- ── INSURANCE_CLAIMS ─────────────────────────────────────────────────

-- Patients see only their claims
CREATE POLICY "claims: patient sees own"
  ON insurance_claims FOR SELECT
  USING (
    patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Providers see claims they submitted
CREATE POLICY "claims: provider sees own submitted"
  ON insurance_claims FOR ALL
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());

-- HMO staff see claims assigned to their HMO
CREATE POLICY "claims: hmo sees assigned"
  ON insurance_claims FOR SELECT
  USING (hmo_user_id = auth.uid());

-- NHIA sees all claims
CREATE POLICY "claims: nhia reads all"
  ON insurance_claims FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );

-- ── TOKEN_TRANSACTIONS ───────────────────────────────────────────────

-- Users see only transactions where they are sender or receiver
CREATE POLICY "tokens: participant access"
  ON token_transactions FOR SELECT
  USING (
    from_patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
    OR to_patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- ── NOTIFICATION_LOG ─────────────────────────────────────────────────

-- Only NHIA and service_role (edge functions) can read notification log
CREATE POLICY "notification_log: nhia read"
  ON notification_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );

-- ── SUPABASE STORAGE: medical-records bucket ─────────────────────────

-- Patients can upload to their own folder only
CREATE POLICY "storage: patient upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Patients can read their own files
CREATE POLICY "storage: patient read own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Providers read files with active consent
CREATE POLICY "storage: provider consented read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-records'
    AND EXISTS (
      SELECT 1 FROM consent_agreements ca
      JOIN patients p ON p.id = ca.patient_id
      WHERE p.user_id::text = (storage.foldername(name))[1]
        AND ca.requester_user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.valid_until > NOW()
    )
  );

-- NHIA can read all medical record blobs (audit)
CREATE POLICY "storage: nhia read all"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-records'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_004_enable_realtime.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Realtime Enablement
-- Migration 004: Enable Supabase Realtime on dashboard-relevant tables
-- Requires Supabase Realtime to be running (enabled by default in self-hosted)

ALTER PUBLICATION supabase_realtime ADD TABLE insurance_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE consent_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE token_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE health_records;
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_005_functions_triggers.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Database Functions & Triggers
-- Migration 005: Business logic enforced at the database layer

-- ── 1. Generic updated_at trigger function ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER health_records_updated_at
  BEFORE UPDATE ON health_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER consent_updated_at
  BEFORE UPDATE ON consent_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. HEAL balance auto-recalculation after token transaction ───────
CREATE OR REPLACE FUNCTION sync_heal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync on confirmed transactions
  IF NEW.status = 'confirmed' THEN
    IF NEW.from_patient_id IS NOT NULL THEN
      UPDATE patients SET heal_balance = heal_balance - NEW.amount_heal
      WHERE id = NEW.from_patient_id;
    END IF;
    IF NEW.to_patient_id IS NOT NULL THEN
      UPDATE patients SET heal_balance = heal_balance + NEW.amount_heal
      WHERE id = NEW.to_patient_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER token_tx_balance_sync
  AFTER INSERT OR UPDATE OF status ON token_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_heal_balance();

-- ── 3. Set SLA deadline on claim submission (48-hour target) ─────────
CREATE OR REPLACE FUNCTION set_claim_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    NEW.sla_deadline = NEW.updated_at + INTERVAL '48 hours';
    NEW.sla_breached = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_sla_on_submit
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION set_claim_sla_deadline();

-- ── 4. Auto-mark SLA breached (scheduled via pg_cron every 15 min) ───
CREATE OR REPLACE FUNCTION mark_sla_breaches()
RETURNS void AS $$
BEGIN
  UPDATE insurance_claims
  SET sla_breached = TRUE
  WHERE sla_deadline < NOW()
    AND status NOT IN ('approved', 'rejected', 'paid')
    AND sla_breached = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (Supabase Pro+ or self-hosted with pg_cron extension)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('sla-breach-check', '*/15 * * * *', 'SELECT mark_sla_breaches();');

-- ── 5. Auto-expire consents past valid_until ─────────────────────────
CREATE OR REPLACE FUNCTION expire_stale_consents()
RETURNS void AS $$
BEGIN
  UPDATE consent_agreements
  SET status = 'expired'
  WHERE valid_until < NOW()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly via pg_cron
-- SELECT cron.schedule('consent-expiry', '0 * * * *', 'SELECT expire_stale_consents();');

-- ── 6. Auto-approve claim when all 3 signatures present ──────────────
CREATE OR REPLACE FUNCTION check_claim_multisig_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_sig_hash IS NOT NULL
    AND NEW.provider_sig_hash IS NOT NULL
    AND NEW.hmo_sig_hash IS NOT NULL
    AND NEW.status NOT IN ('approved', 'rejected', 'paid')
  THEN
    NEW.status = 'approved';
    NEW.approved_amount_ngn = COALESCE(NEW.approved_amount_ngn, NEW.total_amount_ngn);
    NEW.processed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_multisig_approve
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION check_claim_multisig_approval();

-- ── 7. Award 50 HEAL onboarding bonus on first patient record insert ──
CREATE OR REPLACE FUNCTION award_onboarding_heal_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO token_transactions (to_patient_id, amount_heal, tx_type, status)
  VALUES (NEW.id, 50.0000, 'onboarding_bonus', 'confirmed');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER patient_onboarding_bonus
  AFTER INSERT ON patients
  FOR EACH ROW EXECUTE FUNCTION award_onboarding_heal_bonus();
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_006_storage_buckets.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Storage Buckets
-- Migration 006: Create private storage buckets for medical records

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-records',
  'medical-records',
  FALSE,
  52428800,  -- 50 MB per file
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/dicom', 'application/json']
)
ON CONFLICT (id) DO NOTHING;
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_007_custodial_wallets.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Custodial Wallets
-- Migration 007: patient_custodial_wallets table for USSD feature-phone patients

CREATE TABLE patient_custodial_wallets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  hedera_account_id     TEXT UNIQUE NOT NULL,
  hsm_key_handle        TEXT NOT NULL,        -- AWS CloudHSM key reference (not the key itself)
  key_type              TEXT DEFAULT 'ED25519' CHECK (key_type IN ('ED25519', 'ECDSA')),
  custody_type          TEXT DEFAULT 'nhia_custodial'
                          CHECK (custody_type IN ('nhia_custodial', 'self_custody', 'migrating')),
  heal_balance          NUMERIC(15,4) DEFAULT 0,  -- Cached; source of truth = Hedera HTS
  is_token_associated   BOOLEAN DEFAULT FALSE,
  export_requested_at   TIMESTAMPTZ,   -- NULL unless self-custody migration requested
  export_completed_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patient_custodial_wallets ENABLE ROW LEVEL SECURITY;

-- Only NHIA backend (service_role) can access this table — no patient-facing RLS policy
-- Patients never directly query their HSM key handles

CREATE TRIGGER custodial_wallets_updated_at
  BEFORE UPDATE ON patient_custodial_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── HCS Audit Log Table ──────────────────────────────────────────────
-- Records every HCS message submission for compliance queries
CREATE TABLE hcs_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic           TEXT NOT NULL,        -- e.g. 'mediledger.consent'
  action          TEXT NOT NULL,        -- e.g. 'CONSENT_GRANTED'
  actor_id        TEXT NOT NULL,        -- Hashed actor identifier
  payload_hash    TEXT NOT NULL,        -- SHA-256 of payload
  hedera_tx_id    TEXT,                 -- Filled in after HCS submission
  sequence_number BIGINT,               -- HCS sequence number
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hcs_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hcs_audit: nhia read all"
  ON hcs_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia')
  );
;

-- ══════════════════════════════════════════════════════════
-- FILE: migrations/20260601_008_vault_defaults_and_indexes.sql
-- ══════════════════════════════════════════════════════════
-- MediLedger Nigeria — Migration 008
-- Vault column defaults (allow patient create before first seal) + indexes + HCS helpers
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS patterns where needed.

-- ── 1. Allow patient rows before first ZK seal ───────────────────────
-- Onboarding inserts patients before any record upload; seal fills these later.
ALTER TABLE patients
  ALTER COLUMN vault_public_key SET DEFAULT 'pending',
  ALTER COLUMN zk_proof_hash    SET DEFAULT 'pending';

-- Existing NOT NULL constraints remain; defaults satisfy them on INSERT.

-- ── 2. Lookup indexes for ZK vault + emergency paths ────────────────
CREATE INDEX IF NOT EXISTS idx_patients_nhia_id
  ON patients (nhia_id);

CREATE INDEX IF NOT EXISTS idx_health_records_patient_id
  ON health_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_health_records_record_hash
  ON health_records (record_hash);

CREATE INDEX IF NOT EXISTS idx_consent_agreements_patient_status
  ON consent_agreements (patient_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_hcs_audit_log_action_created
  ON hcs_audit_log (action, created_at DESC);

-- ── 3. Storage policies for medical-records bucket ───────────────────
-- Service role bypasses RLS; these cover authenticated patient/provider access.

DROP POLICY IF EXISTS "medical-records: patient own folder" ON storage.objects;
CREATE POLICY "medical-records: patient own folder"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'medical-records'
    AND (storage.foldername(name))[1] = (
      SELECT nhia_id FROM patients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'medical-records'
    AND (storage.foldername(name))[1] = (
      SELECT nhia_id FROM patients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "medical-records: nhia read all" ON storage.objects;
CREATE POLICY "medical-records: nhia read all"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-records'
    AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'nhia'
    )
  );

-- ── 4. Helper: service-role friendly vault seal update (optional RPC) ─
CREATE OR REPLACE FUNCTION update_patient_vault_seal(
  p_nhia_id          TEXT,
  p_vault_commitment TEXT,
  p_zk_proof_hash    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE patients
  SET vault_public_key = p_vault_commitment,
      zk_proof_hash    = p_zk_proof_hash,
      updated_at       = NOW()
  WHERE nhia_id = p_nhia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found for nhia_id=%', p_nhia_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION update_patient_vault_seal(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_patient_vault_seal(TEXT, TEXT, TEXT) TO service_role;
;
