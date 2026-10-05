-- A coordinator's call on a flagged patient. One decision per patient per run;
-- re-deciding overwrites, and the audit log keeps the run it belongs to.
CREATE TABLE IF NOT EXISTS review_decisions (
  run_id          TEXT NOT NULL,
  patient_id      TEXT NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('accepted', 'excluded', 'more_info')),
  note            TEXT NOT NULL DEFAULT '',
  decided_by_name TEXT NOT NULL,
  decided_by_email TEXT NOT NULL,
  decided_at      TEXT NOT NULL,
  PRIMARY KEY (run_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_run ON review_decisions (run_id);
