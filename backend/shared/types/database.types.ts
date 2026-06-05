// MediLedger Nigeria — Shared TypeScript types matching Supabase schema
// Auto-generate the real version with: supabase gen types typescript --local > shared/types/database.types.ts

export type Role = 'patient' | 'provider' | 'hmo' | 'nhia' | 'researcher';
export type Gender = 'M' | 'F' | 'Other';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type RecordType = 'lab' | 'imaging' | 'prescription' | 'consultation' | 'vaccination' | 'surgical';
export type ConsentStatus = 'active' | 'expired' | 'revoked' | 'pending';
export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'provider_signed'
  | 'patient_signed'
  | 'hmo_review'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'disputed';
export type TxType = 'consent_payment' | 'onboarding_bonus' | 'claim_reward' | 'withdrawal';
export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type NotificationChannel = 'sms' | 'email' | 'push' | 'slack';

export interface UserRole {
  id: string;
  user_id: string;
  role: Role;
  nhia_id?: string;
  facility_id?: string;
  created_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  nhia_id: string;
  hedera_account_id?: string;
  full_name: string;
  date_of_birth: string;
  gender?: Gender;
  phone_number: string;
  blood_type?: BloodType;
  emergency_tag_active: boolean;
  vault_public_key: string;
  zk_proof_hash: string;
  heal_balance: number;
  created_at: string;
  updated_at: string;
}

export interface HealthRecord {
  id: string;
  patient_id: string;
  record_type: RecordType;
  facility_id: string;
  fhir_resource_type: string;
  storage_path: string;
  record_hash: string;
  hcs_sequence_number?: number;
  hcs_topic_id?: string;
  is_emergency_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentAgreement {
  id: string;
  patient_id: string;
  requester_user_id: string;
  requester_type?: 'provider' | 'hmo' | 'researcher' | 'emergency';
  data_scope: string[];
  purpose: string;
  monthly_payment_heal: number;
  status: ConsentStatus;
  valid_from: string;
  valid_until: string;
  hcs_message_id?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceClaim {
  id: string;
  patient_id: string;
  provider_user_id: string;
  hmo_user_id?: string;
  nhia_program_id?: string;
  service_date: string;
  icd10_codes: string[];
  total_amount_ngn: number;
  approved_amount_ngn?: number;
  status: ClaimStatus;
  patient_sig_hash?: string;
  provider_sig_hash?: string;
  hmo_sig_hash?: string;
  smart_contract_tx_id?: string;
  sla_deadline?: string;
  sla_breached: boolean;
  rejection_reason?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  from_patient_id?: string;
  to_patient_id?: string;
  consent_id?: string;
  amount_heal: number;
  tx_type?: TxType;
  hedera_tx_id?: string;
  status: TxStatus;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  type: string;
  patient_nhia_id: string;
  consent_id?: string;
  claim_id?: string;
  channel: NotificationChannel;
  sent_at: string;
  success: boolean;
  created_at: string;
}
