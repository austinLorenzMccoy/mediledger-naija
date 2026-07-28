#!/usr/bin/env node
/**
 * Seed NHIA-TEST-001 via Supabase PostgREST (service_role).
 * Use when SQL seed is inconvenient or auth.users insert is restricted.
 *
 * Requires migrations applied and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node backend/scripts/seed-via-rest.js
 *   # or after load-env:
 *   cd backend && node scripts/seed-via-rest.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function req(method, pathSuffix, body, extraHeaders = {}) {
  const res = await fetch(`${URL}/rest/v1/${pathSuffix}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

async function main() {
  console.log('Probing Supabase…', URL);
  const probe = await req('GET', 'patients?select=id&limit=1');
  if (probe.status === 0 || probe.status >= 500) {
    console.error('Cannot reach Supabase:', probe);
    process.exit(1);
  }
  if (probe.status === 404 || (typeof probe.json === 'object' && probe.json?.code === 'PGRST205')) {
    console.error('Table patients not found. Apply migrations first (supabase/all_migrations.sql).');
    process.exit(1);
  }
  if (probe.status !== 200) {
    console.error('Unexpected probe response', probe.status, probe.json);
    process.exit(1);
  }
  console.log('✓ patients table reachable');

  // Find any auth user via admin API
  const usersRes = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=5`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const usersBody = await usersRes.json();
  let userId = usersBody?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found — creating test user via Admin API…');
    const create = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test-patient@mediledger.test',
        password: 'TestPassword123!',
        email_confirm: true,
        user_metadata: { full_name: 'Test Patient' },
      }),
    });
    const created = await create.json();
    userId = created?.id || created?.user?.id;
    if (!userId) {
      console.error('Could not create auth user:', created);
      process.exit(1);
    }
    console.log('✓ created auth user', userId);
  } else {
    console.log('✓ using existing auth user', userId);
  }

  // Clean prior seed
  const existing = await req(
    'GET',
    'patients?nhia_id=eq.NHIA-TEST-001&select=id',
  );
  if (Array.isArray(existing.json) && existing.json[0]?.id) {
    const pid = existing.json[0].id;
    await req('DELETE', `health_records?patient_id=eq.${pid}`);
    await req('DELETE', `token_transactions?to_patient_id=eq.${pid}`);
    await req('DELETE', `patients?id=eq.${pid}`);
    console.log('✓ cleaned prior NHIA-TEST-001');
  }

  await req('DELETE', `user_roles?user_id=eq.${userId}`);
  const role = await req('POST', 'user_roles', {
    user_id: userId,
    role: 'patient',
    nhia_id: 'NHIA-TEST-001',
  });
  if (role.status >= 300) {
    console.error('user_roles insert failed', role);
    process.exit(1);
  }

  const patient = await req('POST', 'patients', {
    user_id: userId,
    nhia_id: 'NHIA-TEST-001',
    full_name: 'Test Patient',
    date_of_birth: '1990-01-15',
    gender: 'F',
    phone_number: '+2348000000001',
    blood_type: 'O+',
    emergency_tag_active: true,
    vault_public_key: 'pending',
    zk_proof_hash: 'pending',
  });
  if (patient.status >= 300) {
    console.error('patients insert failed', patient);
    process.exit(1);
  }
  const patientId = patient.json[0].id;
  console.log('✓ patient', patientId);

  const h1 = crypto.createHash('sha256').update('fhir-lab-record-1').digest('hex');
  const h2 = crypto.createHash('sha256').update('fhir-rx-record-1').digest('hex');
  const facility = '11111111-2222-3333-4444-555555555555';

  const records = await req('POST', 'health_records', [
    {
      patient_id: patientId,
      record_type: 'lab',
      facility_id: facility,
      fhir_resource_type: 'Observation',
      storage_path: 'NHIA-TEST-001/lab-001.json',
      record_hash: h1,
      is_emergency_access: true,
    },
    {
      patient_id: patientId,
      record_type: 'prescription',
      facility_id: facility,
      fhir_resource_type: 'MedicationRequest',
      storage_path: 'NHIA-TEST-001/rx-001.json',
      record_hash: h2,
      is_emergency_access: false,
    },
  ]);
  if (records.status >= 300) {
    console.error('health_records insert failed', records);
    process.exit(1);
  }

  console.log('\n✓ Seed complete');
  console.log(JSON.stringify({
    nhiaId: 'NHIA-TEST-001',
    patientId,
    userId,
    recordHashes: [h1, h2],
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
