-- MediLedger Nigeria — Database Functions & Triggers
-- Migration 005: Business logic enforced at the database layer

-- ── 1. Generic updated_at trigger function ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER health_records_updated_at
  BEFORE UPDATE ON health_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER consent_updated_at
  BEFORE UPDATE ON consent_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. HEAL balance auto-recalculation after token transaction ───────
CREATE OR REPLACE FUNCTION sync_heal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync on confirmed transactions
  IF NEW.status = 'confirmed' THEN
    IF NEW.from_patient_id IS NOT NULL THEN
      UPDATE patients SET heal_balance = heal_balance - NEW.amount_heal
      WHERE id = NEW.from_patient_id;
    END IF;
    IF NEW.to_patient_id IS NOT NULL THEN
      UPDATE patients SET heal_balance = heal_balance + NEW.amount_heal
      WHERE id = NEW.to_patient_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER token_tx_balance_sync
  AFTER INSERT OR UPDATE OF status ON token_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_heal_balance();

-- ── 3. Set SLA deadline on claim submission (48-hour target) ─────────
CREATE OR REPLACE FUNCTION set_claim_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    NEW.sla_deadline = NEW.updated_at + INTERVAL '48 hours';
    NEW.sla_breached = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_sla_on_submit
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION set_claim_sla_deadline();

-- ── 4. Auto-mark SLA breached (scheduled via pg_cron every 15 min) ───
CREATE OR REPLACE FUNCTION mark_sla_breaches()
RETURNS void AS $$
BEGIN
  UPDATE insurance_claims
  SET sla_breached = TRUE
  WHERE sla_deadline < NOW()
    AND status NOT IN ('approved', 'rejected', 'paid')
    AND sla_breached = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (Supabase Pro+ or self-hosted with pg_cron extension)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('sla-breach-check', '*/15 * * * *', 'SELECT mark_sla_breaches();');

-- ── 5. Auto-expire consents past valid_until ─────────────────────────
CREATE OR REPLACE FUNCTION expire_stale_consents()
RETURNS void AS $$
BEGIN
  UPDATE consent_agreements
  SET status = 'expired'
  WHERE valid_until < NOW()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly via pg_cron
-- SELECT cron.schedule('consent-expiry', '0 * * * *', 'SELECT expire_stale_consents();');

-- ── 6. Auto-approve claim when all 3 signatures present ──────────────
CREATE OR REPLACE FUNCTION check_claim_multisig_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_sig_hash IS NOT NULL
    AND NEW.provider_sig_hash IS NOT NULL
    AND NEW.hmo_sig_hash IS NOT NULL
    AND NEW.status NOT IN ('approved', 'rejected', 'paid')
  THEN
    NEW.status = 'approved';
    NEW.approved_amount_ngn = COALESCE(NEW.approved_amount_ngn, NEW.total_amount_ngn);
    NEW.processed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_multisig_approve
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION check_claim_multisig_approval();

-- ── 7. Award 50 HEAL onboarding bonus on first patient record insert ──
CREATE OR REPLACE FUNCTION award_onboarding_heal_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO token_transactions (to_patient_id, amount_heal, tx_type, status)
  VALUES (NEW.id, 50.0000, 'onboarding_bonus', 'confirmed');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER patient_onboarding_bonus
  AFTER INSERT ON patients
  FOR EACH ROW EXECUTE FUNCTION award_onboarding_heal_bonus();
