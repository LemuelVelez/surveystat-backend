CREATE OR REPLACE VIEW survey_item_statistics AS
SELECT
  sf.id AS form_id,
  sf.code AS form_code,
  sf.title AS form_title,
  ss.id AS section_id,
  ss.code AS section_code,
  ss.title AS section_title,
  si.id AS item_id,
  si.code AS item_code,
  si.statement,
  si.sort_order AS item_sort_order,
  COUNT(sa.id) AS response_count,
  ROUND(AVG(sa.rating)::NUMERIC, 2) AS mean_rating,
  CASE
    WHEN AVG(sa.rating) >= 4.21 THEN 'Strongly Agree'
    WHEN AVG(sa.rating) >= 3.41 THEN 'Agree'
    WHEN AVG(sa.rating) >= 2.61 THEN 'Neutral'
    WHEN AVG(sa.rating) >= 1.81 THEN 'Disagree'
    WHEN AVG(sa.rating) >= 1.00 THEN 'Strongly Disagree'
    ELSE 'No Responses'
  END AS interpretation,
  COUNT(sa.id) FILTER (WHERE sa.rating = 5) AS strongly_agree_count,
  COUNT(sa.id) FILTER (WHERE sa.rating = 4) AS agree_count,
  COUNT(sa.id) FILTER (WHERE sa.rating = 3) AS neutral_count,
  COUNT(sa.id) FILTER (WHERE sa.rating = 2) AS disagree_count,
  COUNT(sa.id) FILTER (WHERE sa.rating = 1) AS strongly_disagree_count
FROM survey_forms sf
JOIN survey_sections ss ON ss.form_id = sf.id
JOIN survey_items si ON si.section_id = ss.id
LEFT JOIN survey_answers sa ON sa.item_id = si.id
GROUP BY sf.id, sf.code, sf.title, ss.id, ss.code, ss.title, ss.sort_order, si.id, si.code, si.statement, si.sort_order
ORDER BY sf.code ASC, ss.sort_order ASC, si.sort_order ASC;

CREATE OR REPLACE VIEW survey_section_statistics AS
SELECT
  sf.id AS form_id,
  sf.code AS form_code,
  sf.title AS form_title,
  ss.id AS section_id,
  ss.code AS section_code,
  ss.title AS section_title,
  ss.sort_order AS section_sort_order,
  COUNT(sa.id) AS answer_count,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.submitted_at IS NOT NULL) AS submitted_response_count,
  ROUND(AVG(sa.rating)::NUMERIC, 2) AS mean_rating,
  CASE
    WHEN AVG(sa.rating) >= 4.21 THEN 'Strongly Agree'
    WHEN AVG(sa.rating) >= 3.41 THEN 'Agree'
    WHEN AVG(sa.rating) >= 2.61 THEN 'Neutral'
    WHEN AVG(sa.rating) >= 1.81 THEN 'Disagree'
    WHEN AVG(sa.rating) >= 1.00 THEN 'Strongly Disagree'
    ELSE 'No Responses'
  END AS interpretation
FROM survey_forms sf
JOIN survey_sections ss ON ss.form_id = sf.id
JOIN survey_items si ON si.section_id = ss.id
LEFT JOIN survey_answers sa ON sa.item_id = si.id
LEFT JOIN survey_responses sr ON sr.id = sa.response_id
GROUP BY sf.id, sf.code, sf.title, ss.id, ss.code, ss.title, ss.sort_order
ORDER BY sf.code ASC, ss.sort_order ASC;

CREATE OR REPLACE VIEW survey_form_statistics AS
SELECT
  sf.id AS form_id,
  sf.code AS form_code,
  sf.title AS form_title,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.submitted_at IS NOT NULL) AS submitted_response_count,
  COUNT(sa.id) AS answer_count,
  ROUND(AVG(sa.rating)::NUMERIC, 2) AS mean_rating,
  CASE
    WHEN AVG(sa.rating) >= 4.21 THEN 'Strongly Agree'
    WHEN AVG(sa.rating) >= 3.41 THEN 'Agree'
    WHEN AVG(sa.rating) >= 2.61 THEN 'Neutral'
    WHEN AVG(sa.rating) >= 1.81 THEN 'Disagree'
    WHEN AVG(sa.rating) >= 1.00 THEN 'Strongly Disagree'
    ELSE 'No Responses'
  END AS interpretation
FROM survey_forms sf
LEFT JOIN survey_responses sr ON sr.form_id = sf.id
LEFT JOIN survey_answers sa ON sa.response_id = sr.id
GROUP BY sf.id, sf.code, sf.title
ORDER BY sf.code ASC;
