-- TrialScreen schema. Synthetic demo data only — no PHI is ever written here.

CREATE TABLE IF NOT EXISTS users (
  email         TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  -- Authorisation lives here, server-side, and is never read from the client.
  role          TEXT NOT NULL CHECK (role IN ('coordinator', 'admin')),
  password_hash TEXT NOT NULL
);

-- One row per screening run. This is the audit trail: it records what was asked,
-- who asked it, when, and exactly what came back — enough to reproduce the run.
CREATE TABLE IF NOT EXISTS screening_runs (
  id             TEXT PRIMARY KEY,
  trial_name     TEXT NOT NULL,
  criteria_text  TEXT NOT NULL,
  rules_json     TEXT NOT NULL,
  results_json   TEXT NOT NULL,
  parsed_by      TEXT NOT NULL CHECK (parsed_by IN ('ai', 'local')),
  operator_email TEXT NOT NULL,
  operator_name  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  screened       INTEGER NOT NULL,
  eligible       INTEGER NOT NULL,
  review         INTEGER NOT NULL,
  excluded       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON screening_runs (created_at DESC);

-- Demo personas. Password for both is "demo1234"; the hash is
-- SHA-256("trialscreen:" || password), computed in lib/session.ts.
INSERT OR IGNORE INTO users (email, name, role, password_hash) VALUES
  ('coordinator@trialscreen.demo', 'Dana Okafor', 'coordinator',
   'f39af306d4082decf00e26bb8ab30aa97d41b7e7e86d47be39dc5278542e8a28'),
  ('lead@trialscreen.demo', 'Ravi Menon', 'admin',
   'f39af306d4082decf00e26bb8ab30aa97d41b7e7e86d47be39dc5278542e8a28');
