-- =============================================================================
-- Presales Pipeline Manager — Baseline Schema
-- Target: Azure Database for PostgreSQL Flexible Server 16
-- =============================================================================

BEGIN;

-- ========================== ENUMS ==========================

CREATE TYPE app_role AS ENUM ('ATO Admin', 'Account Manager', 'Alliance Team');
CREATE TYPE workshop_stage AS ENUM ('Identified', 'Proposed', 'Planning', 'Scheduled', 'Delivered', 'Follow-up', 'Conversion', 'SOW Submitted', 'SOW Signed');
CREATE TYPE eligibility_status AS ENUM ('Unknown', 'Eligible', 'Not Eligible');
CREATE TYPE sow_status AS ENUM ('Draft', 'Submitted', 'In Iteration', 'Signed');
CREATE TYPE action_owner AS ENUM ('ATO', 'Client', 'Account Manager', 'Alliance', 'Other');
CREATE TYPE task_status AS ENUM ('Open', 'In Progress', 'Done');

-- ========================== TABLES ==========================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_id TEXT NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL UNIQUE,
  account_manager_name TEXT,
  region TEXT,
  classification TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workshop_type TEXT NOT NULL DEFAULT 'Envisioning',
  workshop_name TEXT,
  stage workshop_stage NOT NULL DEFAULT 'Identified',
  stage_last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Proposed
  stakeholder_contact TEXT,
  first_meeting_scheduled BOOLEAN NOT NULL DEFAULT false,
  envisioning_proposed BOOLEAN NOT NULL DEFAULT false,

  -- Planning
  workshop_agreed BOOLEAN NOT NULL DEFAULT false,
  attendees_roles_collected BOOLEAN NOT NULL DEFAULT false,
  additional_use_cases_needed BOOLEAN NOT NULL DEFAULT false,
  content_built BOOLEAN NOT NULL DEFAULT false,

  -- Delivery
  planned_date_time TIMESTAMPTZ,
  delivered_date_time TIMESTAMPTZ,
  part_101_complete BOOLEAN NOT NULL DEFAULT false,
  part_201_complete BOOLEAN NOT NULL DEFAULT false,
  part_301_complete BOOLEAN NOT NULL DEFAULT false,

  -- Follow-up
  workshop_results_sent BOOLEAN NOT NULL DEFAULT false,

  -- Conversion
  use_cases_identified BOOLEAN NOT NULL DEFAULT false,
  use_cases_id TEXT,
  ato_proposed BOOLEAN NOT NULL DEFAULT false,
  proposal_created BOOLEAN NOT NULL DEFAULT false,

  -- Alliance & Funding
  eligibility_status eligibility_status NOT NULL DEFAULT 'Unknown',
  account_designation TEXT,
  funding_submitted BOOLEAN NOT NULL DEFAULT false,
  funding_submitted_date DATE,
  funding_recognized_amount NUMERIC(12,2),
  funding_anticipated_amount NUMERIC(12,2),

  -- Blockers
  technical_blocker BOOLEAN NOT NULL DEFAULT false,
  technical_blocker_comments TEXT,
  personnel_blocker BOOLEAN NOT NULL DEFAULT false,
  personnel_blocker_comments TEXT,

  -- General
  ato_owner TEXT NOT NULL DEFAULT 'ATO Admin',

  -- Post-Workshop Tracker
  poc_name TEXT,
  est_revenue_text TEXT,
  ms_funding_status TEXT,
  bucket TEXT,
  use_cases_status TEXT,
  proposal_status TEXT,
  current_status TEXT,
  workshop_details TEXT,
  dependency_risks TEXT,
  next_steps TEXT,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  sow_name TEXT NOT NULL,
  status sow_status NOT NULL DEFAULT 'Draft',
  current_action_owner action_owner NOT NULL DEFAULT 'ATO',
  value NUMERIC(12,2),
  afo_revenue NUMERIC(12,2),
  notes TEXT,
  submitted_date DATE,
  signed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  related_workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  related_sow_id UUID REFERENCES sows(id) ON DELETE CASCADE,
  assigned_role app_role NOT NULL,
  title TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'Open',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================== INDEXES ==========================

CREATE INDEX idx_profiles_entra ON profiles(entra_id);
CREATE INDEX idx_workshops_account ON workshops(account_id);
CREATE INDEX idx_workshops_stage ON workshops(stage);
CREATE INDEX idx_sows_workshop ON sows(workshop_id);
CREATE INDEX idx_tasks_workshop ON tasks(related_workshop_id);
CREATE INDEX idx_tasks_sow ON tasks(related_sow_id);
CREATE INDEX idx_tasks_role ON tasks(assigned_role);

-- ========================== HELPER FUNCTIONS ==========================

CREATE OR REPLACE FUNCTION has_role(_profile_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _profile_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION has_any_role(_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _profile_id)
$$;

-- ========================== TRIGGER FUNCTIONS ==========================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION workshops_before_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION workshops_after_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage = 'Scheduled' AND NEW.eligibility_status = 'Eligible' THEN
      INSERT INTO tasks (related_workshop_id, assigned_role, title)
      VALUES (NEW.id, 'Alliance Team', 'Submit scheduled workshop to Microsoft portal');
    END IF;
    IF NEW.stage = 'Delivered' THEN
      INSERT INTO tasks (related_workshop_id, assigned_role, title)
      VALUES (NEW.id, 'ATO Admin', 'Send workshop results / follow-up deck to client');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========================== TRIGGERS ==========================

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sows_updated BEFORE UPDATE ON sows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workshops_before_update BEFORE UPDATE ON workshops
  FOR EACH ROW EXECUTE FUNCTION workshops_before_update();

CREATE TRIGGER trg_workshops_stage_tasks AFTER INSERT OR UPDATE OF stage ON workshops
  FOR EACH ROW EXECUTE FUNCTION workshops_after_stage_change();

COMMIT;
