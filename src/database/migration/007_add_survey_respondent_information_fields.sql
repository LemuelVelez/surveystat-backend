ALTER TABLE survey_forms
  ADD COLUMN IF NOT EXISTS respondent_information_fields JSONB NOT NULL DEFAULT '["fullName", "email", "role"]'::jsonb;

UPDATE survey_forms
SET respondent_information_fields = '["fullName", "email", "role"]'::jsonb
WHERE respondent_information_required = TRUE
  AND (
    respondent_information_fields IS NULL
    OR jsonb_typeof(respondent_information_fields) <> 'array'
    OR jsonb_array_length(respondent_information_fields) = 0
  );

UPDATE survey_forms
SET respondent_information_fields = '[]'::jsonb
WHERE respondent_information_required = FALSE
  AND (
    respondent_information_fields IS NULL
    OR jsonb_typeof(respondent_information_fields) <> 'array'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_forms_respondent_information_fields_array_check'
  ) THEN
    ALTER TABLE survey_forms
      ADD CONSTRAINT survey_forms_respondent_information_fields_array_check
      CHECK (jsonb_typeof(respondent_information_fields) = 'array');
  END IF;
END $$;