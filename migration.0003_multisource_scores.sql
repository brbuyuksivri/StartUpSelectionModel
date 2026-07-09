ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS external_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ai_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ai_rationales_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS last_ai_evaluation_id TEXT;
