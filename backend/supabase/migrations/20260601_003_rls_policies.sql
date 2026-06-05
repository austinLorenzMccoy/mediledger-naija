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
