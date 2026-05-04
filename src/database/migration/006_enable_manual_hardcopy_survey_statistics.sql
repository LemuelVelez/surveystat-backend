CREATE TABLE IF NOT EXISTS manual_survey_response_batches (
  id TEXT PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES survey_forms(id) ON DELETE CASCADE,
  batch_label TEXT NOT NULL DEFAULT 'Hardcopy Survey Batch',
  hardcopy_response_count INTEGER NOT NULL DEFAULT 0,
  encoded_by TEXT,
  notes TEXT,
  encoded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_survey_response_batches_hardcopy_count_non_negative
    CHECK (hardcopy_response_count >= 0)
);

CREATE TABLE IF NOT EXISTS manual_survey_answer_counts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES manual_survey_response_batches(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES survey_items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_survey_answer_counts_rating_range
    CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT manual_survey_answer_counts_response_count_non_negative
    CHECK (response_count >= 0),
  CONSTRAINT manual_survey_answer_counts_unique_rating_per_item
    UNIQUE (batch_id, item_id, rating)
);

CREATE INDEX IF NOT EXISTS idx_manual_survey_response_batches_form
  ON manual_survey_response_batches (form_id, encoded_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_survey_answer_counts_batch
  ON manual_survey_answer_counts (batch_id);

CREATE INDEX IF NOT EXISTS idx_manual_survey_answer_counts_item_rating
  ON manual_survey_answer_counts (item_id, rating);