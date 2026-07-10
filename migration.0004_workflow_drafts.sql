CREATE TABLE IF NOT EXISTS workflow_drafts (
  workflow_key TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
