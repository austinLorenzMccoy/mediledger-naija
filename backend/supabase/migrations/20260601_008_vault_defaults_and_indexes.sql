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
