ALTER TABLE survey_forms
  ADD COLUMN IF NOT EXISTS respondent_role_options JSONB NOT NULL DEFAULT '["Student", "Faculty", "QA Personnel", "Administrator", "Specify"]'::jsonb;

UPDATE survey_forms
SET respondent_role_options = CASE
  WHEN code = 'existing_process_assessment' THEN '["QA Personnel", "Accreditation Task Force", "Faculty", "Specify"]'::jsonb
  WHEN code = 'system_evaluation' THEN '["Faculty", "QA Personnel", "Administrator", "IT Personnel", "Specify"]'::jsonb
  WHEN respondent_information_required = TRUE
    AND respondent_information_fields ? 'role'
    AND (
      respondent_role_options IS NULL
      OR jsonb_typeof(respondent_role_options) <> 'array'
      OR jsonb_array_length(respondent_role_options) = 0
    ) THEN '["Student", "Faculty", "QA Personnel", "Administrator", "Specify"]'::jsonb
  ELSE respondent_role_options
END;

UPDATE survey_forms
SET respondent_role_options = '[]'::jsonb
WHERE respondent_information_required = FALSE
  OR NOT (respondent_information_fields ? 'role');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_forms_respondent_role_options_array_check'
  ) THEN
    ALTER TABLE survey_forms
      ADD CONSTRAINT survey_forms_respondent_role_options_array_check
      CHECK (jsonb_typeof(respondent_role_options) = 'array');
  END IF;
END $$;