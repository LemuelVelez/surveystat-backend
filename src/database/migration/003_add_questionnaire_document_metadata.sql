ALTER TABLE survey_forms
  ADD COLUMN IF NOT EXISTS study_title TEXT,
  ADD COLUMN IF NOT EXISTS document_header JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS introduction TEXT,
  ADD COLUMN IF NOT EXISTS researchers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adviser TEXT,
  ADD COLUMN IF NOT EXISTS voluntary_note TEXT,
  ADD COLUMN IF NOT EXISTS signature_label TEXT NOT NULL DEFAULT 'Respondent''s Signature';

UPDATE survey_forms
SET
  study_title = COALESCE(
    study_title,
    'Development of a Digital Repository System for AACCUP Accreditation Documents in Jose Rizal Memorial State University-Tampilisan Campus (JRMSU-TC)'
  ),
  document_header = CASE
    WHEN document_header = '{}'::jsonb THEN
      jsonb_build_object(
        'documentCode', 'JRMSU-CCS-TC-044',
        'country', 'Republic of the Philippines',
        'university', 'JOSE RIZAL MEMORIAL STATE UNIVERSITY',
        'tagline', 'The Premier University in Zamboanga del Norte',
        'college', 'COLLEGE OF COMPUTING STUDIES',
        'contactNumber', '0917-630-6056',
        'email', 'ccs.tampilisan@jrmsu.edu.ph',
        'address', 'ZNAC, Tampilisan, Zamboanga del Norte'
      )
    ELSE document_header
  END,
  introduction = COALESCE(
    introduction,
    'Good day!' || E'\n\n' ||
    'We, the researchers, are currently conducting a study entitled “Development of a Digital Repository System for AACCUP Accreditation Documents in Jose Rizal Memorial State University-Tampilisan Campus (JRMSU-TC)”' || E'\n\n' ||
    'The purpose of these checklist questionnaires is to evaluate the existing processes employed by QA personnel and to assess the quality of the Digital Repository System using Garvin’s Eight Dimensions of Quality as the evaluation framework. The data gathered will be used to examine current practices, system functionality, and usability, and to identify opportunities for further improvement.' || E'\n\n' ||
    'All information provided will be kept strictly confidential and will be used solely for academic and research purposes. Your sincere and honest responses are highly valued and will contribute greatly to the success of this study.' || E'\n\n' ||
    'Thank you very much for your time and cooperation.'
  ),
  researchers = CASE
    WHEN researchers = '[]'::jsonb THEN
      '["MILYN N. BUCA", "JHONLY P. SALAC", "WHOWARD JHON V. TOME", "LEMUEL T. VELEZ"]'::jsonb
    ELSE researchers
  END,
  adviser = COALESCE(adviser, 'ERSON A. RODRIGUEZ, LPT, MSIT'),
  voluntary_note = COALESCE(
    voluntary_note,
    CASE
      WHEN code = 'system_evaluation' THEN
        'Participation in this survey is completely voluntary. I am willingly chosen to answer this questionnaire, and no one has been forced or coerced to obtain my participation.'
      ELSE
        'Participation in this survey is completely voluntary. I have chosen to answer this questionnaire willingly, and no one has forced or coerced me to participate.'
    END
  ),
  signature_label = COALESCE(NULLIF(signature_label, ''), 'Respondent''s Signature');

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
  sf.updated_at
FROM survey_forms sf
WHERE sf.is_active = TRUE;
