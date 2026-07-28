-- MediLedger Nigeria — Optional test seed (run AFTER migrations 001–008)
-- Requires: service_role SQL editor or: psql $DATABASE_URL -f seed_test_patient.sql
--
-- Creates a synthetic auth user + patient + sample health_record so you can:
--   1. POST /zk/seal-vault with nhiaId = NHIA-TEST-001
--   2. Confirm patients.zk_proof_hash / vault_public_key update
--   3. Run AI inference / emergency cache warm
--
-- Safe to re-run: deletes prior NHIA-TEST-001 rows first.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Step A: pick or create an auth user ─────────────────────────────
-- Prefer an existing user if you already created one in Dashboard.
-- Otherwise insert a fixed test user (works in SQL Editor as postgres).

DO $$
DECLARE
  v_user_id    UUID;
  v_patient_id UUID;
  v_facility   UUID := '11111111-2222-3333-4444-555555555555';
  v_hash1      TEXT;
  v_hash2      TEXT;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'test-patient@mediledger.test'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    BEGIN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'test-patient@mediledger.test',
        crypt('TestPassword123!', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Test Patient"}'::jsonb,
        NOW(),
        NOW()
      );
    EXCEPTION WHEN others THEN
      -- Fallback: use any existing user so patients FK still works
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No auth.users row available. Create a user in Supabase Auth UI first, then re-run this seed.';
      END IF;
      RAISE NOTICE 'auth.users insert skipped (%); using existing user %', SQLERRM, v_user_id;
    END;
  END IF;

  DELETE FROM health_records WHERE patient_id IN (
    SELECT id FROM patients WHERE nhia_id = 'NHIA-TEST-001'
  );
  DELETE FROM token_transactions WHERE to_patient_id IN (
    SELECT id FROM patients WHERE nhia_id = 'NHIA-TEST-001'
  );
  DELETE FROM patients WHERE nhia_id = 'NHIA-TEST-001';
  DELETE FROM user_roles WHERE nhia_id = 'NHIA-TEST-001' OR user_id = v_user_id;

  INSERT INTO user_roles (user_id, role, nhia_id)
  VALUES (v_user_id, 'patient', 'NHIA-TEST-001')
  ON CONFLICT (user_id) DO UPDATE SET role = 'patient', nhia_id = 'NHIA-TEST-001';

  INSERT INTO patients (
    user_id, nhia_id, full_name, date_of_birth, gender,
    phone_number, blood_type, emergency_tag_active,
    vault_public_key, zk_proof_hash
  ) VALUES (
    v_user_id,
    'NHIA-TEST-001',
    'Test Patient',
    '1990-01-15',
    'F',
    '+2348000000001',
    'O+',
    TRUE,
    'pending',
    'pending'
  )
  RETURNING id INTO v_patient_id;

  v_hash1 := encode(digest('fhir-lab-record-1', 'sha256'), 'hex');
  v_hash2 := encode(digest('fhir-rx-record-1', 'sha256'), 'hex');

  INSERT INTO health_records (
    patient_id, record_type, facility_id, fhir_resource_type,
    storage_path, record_hash, is_emergency_access
  ) VALUES
  (v_patient_id, 'lab', v_facility, 'Observation',
   'NHIA-TEST-001/lab-001.json', v_hash1, TRUE),
  (v_patient_id, 'prescription', v_facility, 'MedicationRequest',
   'NHIA-TEST-001/rx-001.json', v_hash2, FALSE);

  RAISE NOTICE 'Seeded NHIA-TEST-001 patient_id=% user_id=%', v_patient_id, v_user_id;
  RAISE NOTICE 'record_hash[1]=%', v_hash1;
  RAISE NOTICE 'record_hash[2]=%', v_hash2;
END $$;
