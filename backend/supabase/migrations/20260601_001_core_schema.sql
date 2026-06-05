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
