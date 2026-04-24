DROP VIEW IF EXISTS survey_questionnaire_forms;

ALTER TABLE survey_forms
  ADD COLUMN IF NOT EXISTS survey_series_id TEXT,
  ADD COLUMN IF NOT EXISTS survey_step_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS survey_series_title TEXT;

UPDATE survey_forms
SET
  survey_series_id = COALESCE(survey_series_id, code::text),
  survey_step_number = CASE
    WHEN code::text = 'existing_process_assessment' THEN 1
    WHEN code::text = 'system_evaluation' THEN 2
    WHEN code::text = 'respondent_system_experience' THEN 3
    ELSE survey_step_number
  END,
  survey_series_title = COALESCE(survey_series_title, 'Default Survey Series')
WHERE survey_series_id IS NULL
  OR survey_series_title IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_forms_survey_step_number_positive'
  ) THEN
    ALTER TABLE survey_forms
      ADD CONSTRAINT survey_forms_survey_step_number_positive
      CHECK (survey_step_number >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_survey_forms_series
  ON survey_forms (survey_series_id, survey_step_number);

CREATE OR REPLACE VIEW survey_questionnaire_forms AS
SELECT
  sf.id,
  sf.code,
  sf.title,
  sf.description,
  sf.study_title,
  sf.document_header,
  sf.introduction,
  sf.researchers,
  sf.adviser,
  sf.instruction,
  sf.scale,
  sf.voluntary_note,
  sf.signature_label,
  sf.is_active,
  sf.created_at,
  sf.updated_at,
  sf.respondent_information_required,
  sf.survey_series_id,
  sf.survey_step_number,
  sf.survey_series_title
FROM survey_forms sf
WHERE sf.is_active = TRUE;