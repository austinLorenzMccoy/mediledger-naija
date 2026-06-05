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
