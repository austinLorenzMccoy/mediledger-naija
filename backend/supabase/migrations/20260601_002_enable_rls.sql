-- MediLedger Nigeria — RLS Enablement
-- Migration 002: Enable Row Level Security on all core tables

ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log   ENABLE ROW LEVEL SECURITY;
