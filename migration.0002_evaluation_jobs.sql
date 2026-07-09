CREATE TABLE IF NOT EXISTS evaluation_jobs (
  id TEXT PRIMARY KEY,
  startup_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  error_text TEXT,
  requested_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status_created_at
  ON evaluation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_startup_id
  ON evaluation_jobs(startup_id);
