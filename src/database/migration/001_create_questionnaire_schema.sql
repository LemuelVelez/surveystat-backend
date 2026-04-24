CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'survey_form_code') THEN
    CREATE TYPE survey_form_code AS ENUM ('existing_process_assessment', 'system_evaluation');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'respondent_role') THEN
    CREATE TYPE respondent_role AS ENUM ('qa_personnel', 'system_user', 'validator', 'accreditor', 'researcher', 'other');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT,
  role respondent_role,
  office TEXT,
  program TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code survey_form_code NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instruction TEXT NOT NULL,
  scale JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES survey_forms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT survey_sections_form_code_unique UNIQUE (form_id, code),
  CONSTRAINT survey_sections_form_sort_order_unique UNIQUE (form_id, sort_order)
);

CREATE TABLE IF NOT EXISTS survey_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES survey_sections(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  statement TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT survey_items_section_sort_order_unique UNIQUE (section_id, sort_order)
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES survey_forms(id) ON DELETE RESTRICT,
  respondent_id UUID REFERENCES respondents(id) ON DELETE SET NULL,
  respondent_signature TEXT,
  voluntary_consent BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES survey_items(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT survey_answers_response_item_unique UNIQUE (response_id, item_id)
);

CREATE INDEX IF NOT EXISTS respondents_email_idx ON respondents(email);
CREATE INDEX IF NOT EXISTS survey_forms_code_idx ON survey_forms(code);
CREATE INDEX IF NOT EXISTS survey_sections_form_id_idx ON survey_sections(form_id);
CREATE INDEX IF NOT EXISTS survey_items_section_id_idx ON survey_items(section_id);
CREATE INDEX IF NOT EXISTS survey_responses_form_id_idx ON survey_responses(form_id);
CREATE INDEX IF NOT EXISTS survey_responses_respondent_id_idx ON survey_responses(respondent_id);
CREATE INDEX IF NOT EXISTS survey_answers_response_id_idx ON survey_answers(response_id);
CREATE INDEX IF NOT EXISTS survey_answers_item_id_idx ON survey_answers(item_id);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_respondents_updated_at ON respondents;
CREATE TRIGGER set_respondents_updated_at
BEFORE UPDATE ON respondents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_survey_forms_updated_at ON survey_forms;
CREATE TRIGGER set_survey_forms_updated_at
BEFORE UPDATE ON survey_forms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_survey_sections_updated_at ON survey_sections;
CREATE TRIGGER set_survey_sections_updated_at
BEFORE UPDATE ON survey_sections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_survey_items_updated_at ON survey_items;
CREATE TRIGGER set_survey_items_updated_at
BEFORE UPDATE ON survey_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_survey_responses_updated_at ON survey_responses;
CREATE TRIGGER set_survey_responses_updated_at
BEFORE UPDATE ON survey_responses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_survey_answers_updated_at ON survey_answers;
CREATE TRIGGER set_survey_answers_updated_at
BEFORE UPDATE ON survey_answers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE OR REPLACE VIEW survey_response_summary AS
SELECT
  sr.id AS response_id,
  sf.code AS form_code,
  sf.title AS form_title,
  ss.code AS section_code,
  ss.title AS section_title,
  ROUND(AVG(sa.rating)::NUMERIC, 2) AS section_mean,
  COUNT(sa.id) AS answered_items,
  sr.submitted_at
FROM survey_responses sr
JOIN survey_forms sf ON sf.id = sr.form_id
JOIN survey_sections ss ON ss.form_id = sf.id
JOIN survey_items si ON si.section_id = ss.id
LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.item_id = si.id
GROUP BY sr.id, sf.code, sf.title, ss.code, ss.title, ss.sort_order, sr.submitted_at
ORDER BY sr.submitted_at DESC NULLS LAST, ss.sort_order ASC;
