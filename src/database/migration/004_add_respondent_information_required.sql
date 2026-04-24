DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'survey_form_code'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'survey_form_code'
      AND enum_value.enumlabel = 'respondent_system_experience'
  ) THEN
    ALTER TYPE survey_form_code ADD VALUE 'respondent_system_experience';
  END IF;
END $$;

ALTER TABLE survey_forms
  ADD COLUMN IF NOT EXISTS respondent_information_required BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE survey_forms
SET respondent_information_required = TRUE
WHERE code::text IN ('existing_process_assessment', 'system_evaluation');

UPDATE survey_forms
SET respondent_information_required = FALSE
WHERE code::text = 'respondent_system_experience';

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
  sf.respondent_information_required
FROM survey_forms sf
WHERE sf.is_active = TRUE;