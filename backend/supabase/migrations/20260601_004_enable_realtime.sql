-- MediLedger Nigeria — Realtime Enablement
-- Migration 004: Enable Supabase Realtime on dashboard-relevant tables
-- Requires Supabase Realtime to be running (enabled by default in self-hosted)

ALTER PUBLICATION supabase_realtime ADD TABLE insurance_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE consent_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE token_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE health_records;
