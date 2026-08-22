import type { Database } from '@/lib/database.types';

type Patient = Database['public']['Tables']['patients']['Row'];

export type EnrollmentProgram = {
  id: string;
  name: string;
};

export type EnrollmentCheck = {
  nhiaId: string;
  isActive: boolean;
  program: EnrollmentProgram | null;
  patientHash: string;
  hmoHash: string;
  validUntil: string | null;
  elapsedMs: number;
  reason: string;
};

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function inferNhiaProgram(nhiaId: string): EnrollmentProgram {
  const u = nhiaId.toUpperCase();
  if (u.includes('BHCPF') || u.includes('VULN')) {
    return { id: 'BHCPF', name: 'Basic Healthcare Provision Fund' };
  }
  if (u.includes('GIF')) {
    return { id: 'GIFSHIP', name: 'Government Integrated Staff Health Insurance' };
  }
  return { id: 'NHIS', name: 'Formal Sector (NHIS)' };
}

/**
 * Instant NHIA enrollment check against the signed-in patient row.
 * Hashed identifiers only — matches EnrollmentVerifier.sol (no raw records on-chain).
 */
export async function verifyEnrollment(
  nhiaId: string,
  patient: Patient | null,
): Promise<EnrollmentCheck> {
  const started = performance.now();
  const trimmed = nhiaId.trim().toUpperCase();
  const patientHash = await sha256Hex(`${trimmed}:mediledger-salt`);
  const hmoHash = await sha256Hex(`hmo:${trimmed}`);
  const elapsedMs = Math.max(0.1, performance.now() - started);

  if (!trimmed) {
    return {
      nhiaId: trimmed,
      isActive: false,
      program: null,
      patientHash,
      hmoHash,
      validUntil: null,
      elapsedMs,
      reason: 'Enter an NHIA ID to verify.',
    };
  }

  if (!patient) {
    return {
      nhiaId: trimmed,
      isActive: false,
      program: inferNhiaProgram(trimmed),
      patientHash,
      hmoHash,
      validUntil: null,
      elapsedMs,
      reason: 'Sign in to confirm live enrollment. Identifiers stay hashed — no raw records leave this device.',
    };
  }

  if (patient.nhia_id.toUpperCase() !== trimmed) {
    return {
      nhiaId: trimmed,
      isActive: false,
      program: inferNhiaProgram(trimmed),
      patientHash,
      hmoHash,
      validUntil: null,
      elapsedMs,
      reason: 'No active enrollment visible for this ID in your session (only your own NHIA record can be verified here).',
    };
  }

  const created = new Date(patient.created_at);
  const validUntil = new Date(created);
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  return {
    nhiaId: trimmed,
    isActive: true,
    program: inferNhiaProgram(trimmed),
    patientHash,
    hmoHash,
    validUntil: validUntil.toISOString(),
    elapsedMs,
    reason: 'Active NHIA enrollment. Providers can confirm eligibility in under a second instead of weeks of paper checks.',
  };
}
