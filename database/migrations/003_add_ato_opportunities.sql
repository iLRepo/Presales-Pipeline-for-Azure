-- =============================================================================
-- ATO Opportunities — non-workshop opportunity tracking
-- =============================================================================

BEGIN;

CREATE TABLE ato_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  opportunity_name TEXT,
  stage TEXT NOT NULL DEFAULT 'Identified',
  stage_last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  poc_name TEXT,
  est_revenue_text TEXT,
  est_revenue_url TEXT,
  ms_funding_status TEXT,
  bucket TEXT,
  use_cases_status TEXT,
  proposal_status TEXT,
  current_status TEXT,
  description TEXT,
  dependency_risks TEXT,
  next_steps TEXT,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,

  funding_anticipated_amount NUMERIC(12,2),
  funding_recognized_amount NUMERIC(12,2),

  technical_blocker BOOLEAN NOT NULL DEFAULT false,
  technical_blocker_comments TEXT,
  personnel_blocker BOOLEAN NOT NULL DEFAULT false,
  personnel_blocker_comments TEXT,

  ato_owner TEXT NOT NULL DEFAULT 'ATO Admin',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ato_opportunities_account ON ato_opportunities(account_id);
CREATE INDEX idx_ato_opportunities_stage ON ato_opportunities(stage);

CREATE TRIGGER trg_ato_opportunities_updated BEFORE UPDATE ON ato_opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
