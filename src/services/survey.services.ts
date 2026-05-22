import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { assertDatabaseConfig, getDatabaseConfig } from "../lib/db.js";
import { uploadBase64Object } from "../lib/bucket.js";
import { sendSurveyResponseReviewEmail } from "../lib/email/response-email.js";
import {
  DEFAULT_RESPONDENT_INFORMATION_FIELDS,
  getLikertInterpretation,
  LIKERT_SCALE,
  TABLES,
  type LikertScale,
  type LikertValue,
  type Respondent,
  type RespondentInformationField,
  type RespondentRole,
  type SurveyAnswer,
  type SurveyForm,
  type SurveyFormCode,
  type SurveyItem,
  type SurveyResponse,
  type SurveySection,
} from "../database/model/model.js";

type DatabaseExecutor = Pool | PoolClient;

type SurveyFormRow = QueryResultRow & {
  id: string;
  code: SurveyFormCode;
  survey_series_id: string | null;
  survey_step_number: number;
  survey_series_title: string | null;
  title: string;
  description: string;
  study_title: string | null;
  document_header: SurveyForm["documentHeader"] | null;
  introduction: string | null;
  researchers: string[] | null;
  adviser: string | null;
  instruction: string;
  scale: LikertScale;
  voluntary_note: string | null;
  signature_label: string | null;
  respondent_information_required: boolean;
  respondent_information_fields: RespondentInformationField[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type SurveySectionRow = QueryResultRow & {
  id: string;
  form_id: string;
  code: string;
  title: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

type SurveyItemRow = QueryResultRow & {
  id: string;
  section_id: string;
  code: string;
  statement: string;
  sort_order: number;
  is_required: boolean;
  created_at: Date;
  updated_at: Date;
};

type RespondentRow = QueryResultRow & {
  id: string;
  full_name: string | null;
  email: string | null;
  role: RespondentRole | null;
  office: string | null;
  program: string | null;
  consent_given: boolean;
  created_at: Date;
  updated_at: Date;
};

type SurveyResponseRow = QueryResultRow & {
  id: string;
  form_id: string;
  respondent_id: string | null;
  respondent_signature: string | null;
  voluntary_consent: boolean;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type SurveyAnswerRow = QueryResultRow & {
  id: string;
  response_id: string;
  item_id: string;
  rating: LikertValue;
  created_at: Date;
  updated_at: Date;
};

type SurveyResponseSummaryRow = SurveyResponseRow & {
  form_code: SurveyFormCode;
  form_title: string;
  respondent_full_name: string | null;
  respondent_email: string | null;
  respondent_role: RespondentRole | null;
  respondent_office: string | null;
  respondent_program: string | null;
  answer_count: number | string;
  weighted_mean: number | string | null;
};

type SurveyAnswerDetailRow = SurveyAnswerRow & {
  form_id: string;
  form_code: SurveyFormCode;
  form_title: string;
  section_id: string;
  section_code: string;
  section_title: string;
  item_code: string;
  item_statement: string;
  item_sort_order: number;
};

export type SurveyQuestionnaireItem = SurveyItem;

export type SurveyQuestionnaireSection = SurveySection & {
  items: SurveyQuestionnaireItem[];
};

export type SurveyQuestionnaireForm = SurveyForm & {
  sections: SurveyQuestionnaireSection[];
};

export type CreateRespondentInput = {
  fullName?: string | null;
  email?: string | null;
  role?: RespondentRole | null;
  office?: string | null;
  program?: string | null;
  consentGiven?: boolean;
};

export type CreateSurveyItemInput = {
  code?: string | null;
  statement: string;
  sortOrder?: number;
  isRequired?: boolean;
};

export type CreateSurveySectionInput = {
  code?: string | null;
  title: string;
  sortOrder?: number;
  items: CreateSurveyItemInput[];
};

export type CreateSurveyFormInput = {
  code: SurveyFormCode;
  surveySeriesId?: string | null;
  surveyStepNumber?: number;
  surveySeriesTitle?: string | null;
  title: string;
  description?: string | null;
  studyTitle?: string | null;
  documentHeader?: SurveyForm["documentHeader"] | null;
  introduction?: string | null;
  researchers?: string[] | null;
  adviser?: string | null;
  instruction?: string | null;
  scale?: LikertScale;
  voluntaryNote?: string | null;
  signatureLabel?: string | null;
  respondentInformationRequired?: boolean;
  respondentInformationFields?: RespondentInformationField[];
  isActive?: boolean;
  sections?: CreateSurveySectionInput[];
};

export type CreateSurveySeriesInput = {
  surveySeriesId?: string | null;
  surveySeriesTitle: string;
  forms: CreateSurveyFormInput[];
};

export type UpdateSurveyFormInput = {
  title?: string;
  description?: string | null;
  respondentInformationRequired?: boolean;
  respondentInformationFields?: RespondentInformationField[];
  isActive?: boolean;
};

export type UpdateSurveyFormRespondentInformationInput = {
  respondentInformationRequired: boolean;
  respondentInformationFields?: RespondentInformationField[];
};

export type UpdateSurveyItemInput = {
  id?: string | null;
  code?: string | null;
  statement: string;
  sortOrder?: number;
  isRequired?: boolean;
};

export type UpdateSurveySectionInput = {
  id?: string | null;
  code?: string | null;
  title: string;
  sortOrder?: number;
  items: UpdateSurveyItemInput[];
};

export type UpdateSurveyQuestionnaireInput = UpdateSurveyFormInput & {
  sections?: UpdateSurveySectionInput[];
};

export type SubmitSurveyAnswerInput = {
  itemId: string;
  rating: LikertValue;
};

export type SubmitSurveyResponseInput = {
  formId?: string;
  formCode?: SurveyFormCode;
  respondentId?: string | null;
  respondent?: CreateRespondentInput | null;
  respondentSignature?: string | null;
  respondentSignatureImage?: string | null;
  respondentSignatureFileName?: string | null;
  voluntaryConsent: boolean;
  answers: SubmitSurveyAnswerInput[];
};

export type SubmittedSurveyResponse = SurveyResponse & {
  respondent: Respondent | null;
  answers: SurveyAnswer[];
};

export type SurveyResponseSummary = SurveyResponse & {
  formCode: SurveyFormCode;
  formTitle: string;
  respondentFullName?: string | null;
  respondentEmail?: string | null;
  respondentRole?: RespondentRole | null;
  respondentOffice?: string | null;
  respondentProgram?: string | null;
  answerCount: number;
  weightedMean: number;
  interpretation: string;
  meanRange: string;
};

export type SurveyResponseAnswer = SurveyAnswer & {
  formId: string;
  formCode: SurveyFormCode;
  formTitle: string;
  sectionId: string;
  sectionCode: string;
  sectionTitle: string;
  itemCode: string;
  itemStatement: string;
  itemSortOrder: number;
  interpretation: string;
  meanRange: string;
};

export type ListSurveyResponsesOptions = {
  responseId?: string;
  formId?: string;
  formCode?: SurveyFormCode;
  respondentId?: string;
  submittedOnly?: boolean;
  limit?: number;
  offset?: number;
};

let sharedPool: Pool | null = null;

function getPool() {
  if (!sharedPool) {
    assertDatabaseConfig();

    const databaseConfig = getDatabaseConfig();
    sharedPool = new Pool({
      connectionString: databaseConfig.connectionString,
      ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  return sharedPool;
}

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(Number(value)), 1), 500);
}

function normalizeOffset(value?: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(Math.trunc(Number(value)), 0);
}

function normalizeSortOrder(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(Math.trunc(Number(value)), 1);
}

function requireText(value: string | null | undefined, fieldName: string) {
  const text = sanitizeText(value);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function createCodeFromTitle(title: string, fallback: string) {
  const code = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return code || fallback;
}

function createUniqueCode(rawCode: string | null | undefined, fallback: string, usedCodes: Set<string>) {
  const baseCode = createCodeFromTitle(rawCode ?? "", fallback).slice(0, 60).replace(/_+$/g, "") || fallback;
  let candidate = baseCode;
  let duplicateNumber = 2;

  while (usedCodes.has(candidate)) {
    const suffix = `_${duplicateNumber}`;
    candidate = `${baseCode.slice(0, Math.max(1, 60 - suffix.length))}${suffix}`;
    duplicateNumber += 1;
  }

  usedCodes.add(candidate);
  return candidate;
}

function createScopedSurveyCode(scopeCode: string, rawCode: string | null | undefined, fallback: string) {
  const scope = createCodeFromTitle(scopeCode, "survey").slice(0, 32).replace(/_+$/g, "");
  const base = createCodeFromTitle(rawCode ?? "", fallback).replace(/_+$/g, "") || fallback;
  const scopedCode = `${scope}_${base}`.replace(/_+/g, "_").replace(/^_+|_+$/g, "");

  return scopedCode.slice(0, 60).replace(/_+$/g, "") || fallback;
}

const respondentInformationFieldLabels: Record<RespondentInformationField, string> = {
  fullName: "Respondent full name",
  email: "Respondent email",
  role: "Respondent role",
  office: "Respondent office",
  program: "Respondent program",
};

const validRespondentInformationFields = new Set<RespondentInformationField>([
  "fullName",
  "email",
  "role",
  "office",
  "program",
]);

function normalizeRespondentInformationFields(
  fields?: RespondentInformationField[] | null,
  fallback: RespondentInformationField[] = DEFAULT_RESPONDENT_INFORMATION_FIELDS,
) {
  if (!Array.isArray(fields)) {
    return fallback;
  }

  const normalizedFields = fields.filter((field): field is RespondentInformationField =>
    validRespondentInformationFields.has(field),
  );
  const uniqueFields = Array.from(new Set(normalizedFields));

  return uniqueFields.length > 0 ? uniqueFields : fallback;
}

async function getExistingCodes(
  executor: DatabaseExecutor,
  tableName: typeof TABLES.surveySections | typeof TABLES.surveyItems,
) {
  const result = await executor.query<{ code: string }>(`
    SELECT code
    FROM ${tableName}
  `);

  return new Set(result.rows.map((row) => row.code));
}

async function ensureSurveySectionsAllowMultipleSections(executor: DatabaseExecutor) {
  await executor.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = '${TABLES.surveySections}'
          AND constraint_name = 'survey_sections_form_code_unique'
          AND constraint_type = 'UNIQUE'
      ) THEN
        ALTER TABLE ${TABLES.surveySections} DROP CONSTRAINT survey_sections_form_code_unique;
      END IF;
    END $$;
  `);

  await executor.query(`DROP INDEX IF EXISTS survey_sections_form_code_unique;`);
}

function quotePostgresLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function ensureSurveyFormCode(code: SurveyFormCode) {
  await getPool().query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'survey_forms'
          AND column_name = 'code'
          AND udt_name = 'survey_form_code'
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_enum enum_value
        JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
        WHERE enum_type.typname = 'survey_form_code'
          AND enum_value.enumlabel = ${quotePostgresLiteral(String(code))}
      ) THEN
        ALTER TYPE survey_form_code ADD VALUE ${quotePostgresLiteral(String(code))};
      END IF;
    END $$;
  `);
}

function validateRespondentInformation(
  input: CreateRespondentInput | null | undefined,
  fields: RespondentInformationField[] = DEFAULT_RESPONDENT_INFORMATION_FIELDS,
) {
  if (!input) {
    throw new Error("Respondent information is required for this survey.");
  }

  const requiredFields = normalizeRespondentInformationFields(fields);

  for (const field of requiredFields) {
    requireText(String(input[field] ?? ""), respondentInformationFieldLabels[field]);
  }
}

function isLikertValue(value: number): value is LikertValue {
  return LIKERT_SCALE.some((scale) => scale.value === value);
}

function normalizeLikertValue(value: number) {
  if (!isLikertValue(value)) {
    throw new Error(`Invalid Likert rating: ${value}. Expected a value from 1 to 5.`);
  }

  return value;
}

function isBase64DataUrl(value?: string | null) {
  return Boolean(value?.trim().match(/^data:[^;,]+;base64,/));
}

async function resolveRespondentSignature(input: SubmitSurveyResponseInput, form: SurveyForm) {
  const signatureImage = sanitizeText(input.respondentSignatureImage);

  if (!signatureImage) {
    return sanitizeText(input.respondentSignature);
  }

  if (!isBase64DataUrl(signatureImage)) {
    throw new Error("Invalid respondent signature image. Please upload or draw a valid image signature.");
  }

  const uploadedSignature = await uploadBase64Object({
    dataUrl: signatureImage,
    filename: input.respondentSignatureFileName ?? "respondent-signature.png",
    folder: `survey-signatures/${form.code}`,
  });

  return uploadedSignature.url;
}

function createEmailSummary(params: {
  response: SurveyResponse;
  form: SurveyForm;
  respondent: Respondent | null;
  answers: SurveyResponseAnswer[];
}): SurveyResponseSummary {
  const answerCount = params.answers.length;
  const total = params.answers.reduce((sum, answer) => sum + Number(answer.rating ?? 0), 0);
  const weightedMean = answerCount > 0 ? Number((total / answerCount).toFixed(2)) : 0;
  const interpretation = getLikertInterpretation(weightedMean);

  return {
    ...params.response,
    formCode: params.form.code,
    formTitle: params.form.title,
    respondentFullName: params.respondent?.fullName ?? null,
    respondentEmail: params.respondent?.email ?? null,
    respondentRole: params.respondent?.role ?? null,
    respondentOffice: params.respondent?.office ?? null,
    respondentProgram: params.respondent?.program ?? null,
    answerCount,
    weightedMean,
    interpretation: weightedMean > 0 ? interpretation.label : "No data",
    meanRange: weightedMean > 0 ? interpretation.meanRange : "N/A",
  };
}

async function getResponseAnswerDetails(responseId: string) {
  const pool = getPool();
  const result = await pool.query<SurveyAnswerDetailRow>(
    `
      SELECT
        sa.id,
        sa.response_id,
        sa.item_id,
        sa.rating,
        sa.created_at,
        sa.updated_at,
        sf.id AS form_id,
        sf.code AS form_code,
        sf.title AS form_title,
        ss.id AS section_id,
        ss.code AS section_code,
        ss.title AS section_title,
        si.code AS item_code,
        si.statement AS item_statement,
        si.sort_order AS item_sort_order
      FROM ${TABLES.surveyAnswers} sa
      JOIN ${TABLES.surveyResponses} sr ON sr.id = sa.response_id
      JOIN ${TABLES.surveyForms} sf ON sf.id = sr.form_id
      JOIN ${TABLES.surveyItems} si ON si.id = sa.item_id
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id AND ss.form_id = sf.id
      WHERE sa.response_id = $1
      ORDER BY ss.sort_order ASC, si.sort_order ASC, sa.created_at ASC
    `,
    [responseId],
  );

  return result.rows.map(mapSurveyResponseAnswer);
}

async function sendResponseReviewEmail(params: {
  response: SurveyResponse;
  form: SurveyForm;
  respondent: Respondent | null;
}) {
  const recipientEmail = sanitizeText(params.respondent?.email);

  if (!recipientEmail) {
    return false;
  }

  const answers = await getResponseAnswerDetails(params.response.id);
  const responseSummary = createEmailSummary({
    response: params.response,
    form: params.form,
    respondent: params.respondent,
    answers,
  });

  await sendSurveyResponseReviewEmail({
    to: recipientEmail,
    response: responseSummary,
    answers,
  });

  return true;
}

function mapSurveyForm(row: SurveyFormRow): SurveyForm {
  return {
    id: row.id,
    code: row.code,
    surveySeriesId: row.survey_series_id,
    surveyStepNumber: row.survey_step_number ?? 1,
    surveySeriesTitle: row.survey_series_title,
    title: row.title,
    description: row.description,
    studyTitle: row.study_title,
    documentHeader: row.document_header,
    introduction: row.introduction,
    researchers: row.researchers,
    adviser: row.adviser,
    instruction: row.instruction,
    scale: row.scale ?? LIKERT_SCALE,
    voluntaryNote: row.voluntary_note,
    signatureLabel: row.signature_label,
    respondentInformationRequired: row.respondent_information_required ?? true,
    respondentInformationFields: normalizeRespondentInformationFields(row.respondent_information_fields),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveySection(row: SurveySectionRow): SurveySection {
  return {
    id: row.id,
    formId: row.form_id,
    code: row.code,
    title: row.title,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyItem(row: SurveyItemRow): SurveyItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    code: row.code,
    statement: row.statement,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRespondent(row: RespondentRow): Respondent {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    office: row.office,
    program: row.program,
    consentGiven: row.consent_given,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyResponse(row: SurveyResponseRow): SurveyResponse {
  return {
    id: row.id,
    formId: row.form_id,
    respondentId: row.respondent_id,
    respondentSignature: row.respondent_signature,
    voluntaryConsent: row.voluntary_consent,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyAnswer(row: SurveyAnswerRow): SurveyAnswer {
  return {
    id: row.id,
    responseId: row.response_id,
    itemId: row.item_id,
    rating: row.rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyResponseSummary(row: SurveyResponseSummaryRow): SurveyResponseSummary {
  const weightedMean = Number(row.weighted_mean ?? 0);
  const interpretation = getLikertInterpretation(weightedMean);

  return {
    ...mapSurveyResponse(row),
    formCode: row.form_code,
    formTitle: row.form_title,
    respondentFullName: row.respondent_full_name,
    respondentEmail: row.respondent_email,
    respondentRole: row.respondent_role,
    respondentOffice: row.respondent_office,
    respondentProgram: row.respondent_program,
    answerCount: Number(row.answer_count ?? 0),
    weightedMean,
    interpretation: weightedMean > 0 ? interpretation.label : "No data",
    meanRange: weightedMean > 0 ? interpretation.meanRange : "N/A",
  };
}

function mapSurveyResponseAnswer(row: SurveyAnswerDetailRow): SurveyResponseAnswer {
  const rating = Number(row.rating) as LikertValue;
  const interpretation = getLikertInterpretation(rating);

  return {
    ...mapSurveyAnswer(row),
    formId: row.form_id,
    formCode: row.form_code,
    formTitle: row.form_title,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    sectionTitle: row.section_title,
    itemCode: row.item_code,
    itemStatement: row.item_statement,
    itemSortOrder: row.item_sort_order,
    interpretation: interpretation.label,
    meanRange: interpretation.meanRange,
  };
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSurveyFormById(executor: DatabaseExecutor, formId: string) {
  const result = await executor.query<SurveyFormRow>(
    `
      SELECT
        id,
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active,
        created_at,
        updated_at
      FROM ${TABLES.surveyForms}
      WHERE id = $1
      LIMIT 1
    `,
    [formId],
  );

  const row = result.rows[0];
  return row ? mapSurveyForm(row) : null;
}

async function getSurveyFormByCode(executor: DatabaseExecutor, formCode: SurveyFormCode) {
  const result = await executor.query<SurveyFormRow>(
    `
      SELECT
        id,
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active,
        created_at,
        updated_at
      FROM ${TABLES.surveyForms}
      WHERE code = $1
      LIMIT 1
    `,
    [formCode],
  );

  const row = result.rows[0];
  return row ? mapSurveyForm(row) : null;
}

async function updateSurveyFormRecord(executor: DatabaseExecutor, formId: string, input: UpdateSurveyFormInput) {
  const title = input.title !== undefined ? requireText(input.title, "Survey title") : null;
  const shouldUpdateDescription = input.description !== undefined;
  const description = shouldUpdateDescription ? sanitizeText(input.description) ?? "" : null;

  const result = await executor.query<SurveyFormRow>(
    `
      UPDATE ${TABLES.surveyForms}
      SET
        title = COALESCE($2::text, title),
        description = CASE WHEN $3::boolean THEN $4::text ELSE description END,
        respondent_information_required = COALESCE($5::boolean, respondent_information_required),
        respondent_information_fields = COALESCE($6::jsonb, respondent_information_fields),
        is_active = COALESCE($7::boolean, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active,
        created_at,
        updated_at
    `,
    [
      formId,
      title,
      shouldUpdateDescription,
      description,
      input.respondentInformationRequired ?? null,
      input.respondentInformationFields !== undefined
        ? JSON.stringify(
            normalizeRespondentInformationFields(
              input.respondentInformationFields,
              input.respondentInformationRequired === true ? DEFAULT_RESPONDENT_INFORMATION_FIELDS : [],
            ),
          )
        : null,
      input.isActive ?? null,
    ],
  );

  const row = result.rows[0];
  return row ? mapSurveyForm(row) : null;
}

async function updateSurveyForm(formId: string, input: UpdateSurveyFormInput) {
  return updateSurveyFormRecord(getPool(), formId, input);
}

async function updateSurveySectionItems(
  client: PoolClient,
  sectionId: string,
  sectionIndex: number,
  items: UpdateSurveyItemInput[],
) {
  if (items.length === 0) {
    throw new Error(`Section ${sectionIndex + 1} must have at least one survey item.`);
  }

  const existingItemsResult = await client.query<SurveyItemRow>(
    `
      SELECT
        id,
        section_id,
        code,
        statement,
        sort_order,
        is_required,
        created_at,
        updated_at
      FROM ${TABLES.surveyItems}
      WHERE section_id = $1
      ORDER BY sort_order ASC, statement ASC
    `,
    [sectionId],
  );
  const existingItems = existingItemsResult.rows;
  const existingItemIds = new Set(existingItems.map((item) => item.id));
  const keptItemIds = new Set<string>();
  const usedItemCodes = new Set<string>();

  for (const [itemIndex, item] of items.entries()) {
    const statement = requireText(item.statement, `Section ${sectionIndex + 1} item ${itemIndex + 1} statement`);
    const itemCode = createUniqueCode(sanitizeText(item.code) ?? statement, `item_${itemIndex + 1}`, usedItemCodes);
    const existingItemId = sanitizeText(item.id);

    if (existingItemId && existingItemIds.has(existingItemId)) {
      const updatedItem = await client.query<SurveyItemRow>(
        `
          UPDATE ${TABLES.surveyItems}
          SET
            code = $2,
            statement = $3,
            sort_order = $4,
            is_required = $5,
            updated_at = NOW()
          WHERE id = $1
            AND section_id = $6
          RETURNING id
        `,
        [
          existingItemId,
          itemCode,
          statement,
          normalizeSortOrder(item.sortOrder, itemIndex + 1),
          item.isRequired ?? true,
          sectionId,
        ],
      );
      const updatedItemId = updatedItem.rows[0]?.id;

      if (updatedItemId) {
        keptItemIds.add(updatedItemId);
      }

      continue;
    }

    const insertedItem = await client.query<SurveyItemRow>(
      `
        INSERT INTO ${TABLES.surveyItems} (section_id, code, statement, sort_order, is_required)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        sectionId,
        itemCode,
        statement,
        normalizeSortOrder(item.sortOrder, itemIndex + 1),
        item.isRequired ?? true,
      ],
    );
    const insertedItemId = insertedItem.rows[0]?.id;

    if (!insertedItemId) {
      throw new Error(`Unable to create survey item: ${statement}`);
    }

    keptItemIds.add(insertedItemId);
  }

  const deletedItemIds = existingItems
    .map((item) => item.id)
    .filter((itemId) => !keptItemIds.has(itemId));

  if (deletedItemIds.length > 0) {
    await client.query(`DELETE FROM ${TABLES.surveyAnswers} WHERE item_id = ANY($1::uuid[])`, [deletedItemIds]);
    await client.query(`DELETE FROM ${TABLES.manualSurveyAnswerCounts} WHERE item_id = ANY($1::uuid[])`, [deletedItemIds]);
    await client.query(`DELETE FROM ${TABLES.surveyItems} WHERE id = ANY($1::uuid[])`, [deletedItemIds]);
  }
}

async function replaceSurveyQuestionnaireSections(
  client: PoolClient,
  formId: string,
  sections: UpdateSurveySectionInput[],
) {
  if (sections.length === 0) {
    throw new Error("At least one survey section is required.");
  }

  await ensureSurveySectionsAllowMultipleSections(client);

  const existingSectionsResult = await client.query<SurveySectionRow>(
    `
      SELECT
        id,
        form_id,
        code,
        title,
        sort_order,
        created_at,
        updated_at
      FROM ${TABLES.surveySections}
      WHERE form_id = $1
      ORDER BY sort_order ASC, title ASC
    `,
    [formId],
  );
  const existingSections = existingSectionsResult.rows;
  const existingSectionIds = new Set(existingSections.map((section) => section.id));
  const keptSectionIds = new Set<string>();
  const usedSectionCodes = new Set<string>();

  for (const [sectionIndex, section] of sections.entries()) {
    const sectionTitle = requireText(section.title, `Section ${sectionIndex + 1} title`);
    const sectionCode = createUniqueCode(sanitizeText(section.code) ?? sectionTitle, `section_${sectionIndex + 1}`, usedSectionCodes);
    const existingSectionId = sanitizeText(section.id);
    let sectionId = existingSectionId && existingSectionIds.has(existingSectionId) ? existingSectionId : null;

    if (sectionId) {
      const updatedSection = await client.query<SurveySectionRow>(
        `
          UPDATE ${TABLES.surveySections}
          SET
            code = $2,
            title = $3,
            sort_order = $4,
            updated_at = NOW()
          WHERE id = $1
            AND form_id = $5
          RETURNING id
        `,
        [
          sectionId,
          sectionCode,
          sectionTitle,
          normalizeSortOrder(section.sortOrder, sectionIndex + 1),
          formId,
        ],
      );

      sectionId = updatedSection.rows[0]?.id ?? null;
    } else {
      const insertedSection = await client.query<SurveySectionRow>(
        `
          INSERT INTO ${TABLES.surveySections} (form_id, code, title, sort_order)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [
          formId,
          sectionCode,
          sectionTitle,
          normalizeSortOrder(section.sortOrder, sectionIndex + 1),
        ],
      );

      sectionId = insertedSection.rows[0]?.id ?? null;
    }

    if (!sectionId) {
      throw new Error(`Unable to save survey section: ${sectionTitle}`);
    }

    keptSectionIds.add(sectionId);
    await updateSurveySectionItems(client, sectionId, sectionIndex, section.items ?? []);
  }

  const deletedSectionIds = existingSections
    .map((section) => section.id)
    .filter((sectionId) => !keptSectionIds.has(sectionId));

  if (deletedSectionIds.length > 0) {
    const deletedItemsResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM ${TABLES.surveyItems}
        WHERE section_id = ANY($1::uuid[])
      `,
      [deletedSectionIds],
    );
    const deletedItemIds = deletedItemsResult.rows.map((item) => item.id);

    if (deletedItemIds.length > 0) {
      await client.query(`DELETE FROM ${TABLES.surveyAnswers} WHERE item_id = ANY($1::uuid[])`, [deletedItemIds]);
      await client.query(`DELETE FROM ${TABLES.manualSurveyAnswerCounts} WHERE item_id = ANY($1::uuid[])`, [deletedItemIds]);
      await client.query(`DELETE FROM ${TABLES.surveyItems} WHERE id = ANY($1::uuid[])`, [deletedItemIds]);
    }

    await client.query(`DELETE FROM ${TABLES.surveySections} WHERE id = ANY($1::uuid[])`, [deletedSectionIds]);
  }
}

async function updateSurveyQuestionnaireForm(formId: string, input: UpdateSurveyQuestionnaireInput) {
  return withTransaction(async (client) => {
    const form = await updateSurveyFormRecord(client, formId, input);

    if (!form) {
      return null;
    }

    if (input.sections !== undefined) {
      await replaceSurveyQuestionnaireSections(client, form.id, input.sections);
    }

    return {
      ...form,
      sections: await getQuestionnaireSections(client, form.id),
    };
  });
}

async function updateSurveyFormRespondentInformation(
  formId: string,
  input: UpdateSurveyFormRespondentInformationInput,
) {
  const result = await getPool().query<SurveyFormRow>(
    `
      UPDATE ${TABLES.surveyForms}
      SET
        respondent_information_required = $2,
        respondent_information_fields = COALESCE($3::jsonb, respondent_information_fields),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active,
        created_at,
        updated_at
    `,
    [
      formId,
      input.respondentInformationRequired,
      input.respondentInformationFields !== undefined
        ? JSON.stringify(
            normalizeRespondentInformationFields(
              input.respondentInformationFields,
              input.respondentInformationRequired === true ? DEFAULT_RESPONDENT_INFORMATION_FIELDS : [],
            ),
          )
        : null,
    ],
  );

  const row = result.rows[0];
  return row ? mapSurveyForm(row) : null;
}

async function resolveSurveyForm(executor: DatabaseExecutor, input: Pick<SubmitSurveyResponseInput, "formId" | "formCode">) {
  if (input.formId) {
    const form = await getSurveyFormById(executor, input.formId);

    if (!form) {
      throw new Error(`Survey form not found: ${input.formId}`);
    }

    return form;
  }

  if (input.formCode) {
    const form = await getSurveyFormByCode(executor, input.formCode);

    if (!form) {
      throw new Error(`Survey form not found: ${input.formCode}`);
    }

    return form;
  }

  throw new Error("Survey form id or code is required.");
}

async function createSurveyForm(input: CreateSurveyFormInput) {
  const code = requireText(String(input.code ?? ""), "Survey code") as SurveyFormCode;
  await ensureSurveyFormCode(code);

  return withTransaction(async (client) => createSurveyFormRecord(client, input));
}

async function createSurveyFormRecord(client: PoolClient, input: CreateSurveyFormInput) {
  const title = requireText(input.title, "Survey title");
  const code = requireText(String(input.code ?? ""), "Survey code") as SurveyFormCode;
  const sections = input.sections ?? [];

  await ensureSurveySectionsAllowMultipleSections(client);

  const formResult = await client.query<SurveyFormRow>(
    `
      INSERT INTO ${TABLES.surveyForms} (
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13::jsonb, $14, $15, $16::jsonb, $17)
      RETURNING
        id,
        code,
        survey_series_id,
        survey_step_number,
        survey_series_title,
        title,
        description,
        study_title,
        document_header,
        introduction,
        researchers,
        adviser,
        instruction,
        scale,
        voluntary_note,
        signature_label,
        respondent_information_required,
        respondent_information_fields,
        is_active,
        created_at,
        updated_at
    `,
    [
      code,
      sanitizeText(input.surveySeriesId),
      normalizeSortOrder(input.surveyStepNumber, 1),
      sanitizeText(input.surveySeriesTitle),
      title,
      sanitizeText(input.description) ?? "",
      sanitizeText(input.studyTitle),
      JSON.stringify(input.documentHeader ?? {}),
      sanitizeText(input.introduction),
      JSON.stringify(input.researchers ?? []),
      sanitizeText(input.adviser),
      sanitizeText(input.instruction) ?? "Please read each statement carefully and select the rating that best reflects your answer.",
      JSON.stringify(input.scale ?? LIKERT_SCALE),
      sanitizeText(input.voluntaryNote),
      sanitizeText(input.signatureLabel) ?? "Respondent's Signature",
      input.respondentInformationRequired ?? true,
      JSON.stringify(
        normalizeRespondentInformationFields(
          input.respondentInformationFields,
          input.respondentInformationRequired === false ? [] : DEFAULT_RESPONDENT_INFORMATION_FIELDS,
        ),
      ),
      input.isActive ?? true,
    ],
  );

  const formRow = formResult.rows[0];

  if (!formRow) {
    throw new Error("Unable to create survey form.");
  }

  const form = mapSurveyForm(formRow);

  const usedSectionCodes = await getExistingCodes(client, TABLES.surveySections);
  const usedItemCodes = await getExistingCodes(client, TABLES.surveyItems);

  for (const [sectionIndex, section] of sections.entries()) {
    const sectionTitle = requireText(section.title, `Section ${sectionIndex + 1} title`);
    const sectionCode = createUniqueCode(
      createScopedSurveyCode(code, sanitizeText(section.code) ?? sectionTitle, `section_${sectionIndex + 1}`),
      `section_${sectionIndex + 1}`,
      usedSectionCodes,
    );
    const sectionResult = await client.query<SurveySectionRow>(
      `
        INSERT INTO ${TABLES.surveySections} (form_id, code, title, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          form_id,
          code,
          title,
          sort_order,
          created_at,
          updated_at
      `,
      [
        form.id,
        sectionCode,
        sectionTitle,
        normalizeSortOrder(section.sortOrder, sectionIndex + 1),
      ],
    );

    const sectionRow = sectionResult.rows[0];

    if (!sectionRow) {
      throw new Error(`Unable to create survey section: ${sectionTitle}`);
    }

    for (const [itemIndex, item] of section.items.entries()) {
      const statement = requireText(item.statement, `Section ${sectionIndex + 1} item ${itemIndex + 1} statement`);
      const itemCode = createUniqueCode(
        createScopedSurveyCode(sectionCode, sanitizeText(item.code) ?? `item_${itemIndex + 1}`, `item_${itemIndex + 1}`),
        `item_${itemIndex + 1}`,
        usedItemCodes,
      );

      await client.query<SurveyItemRow>(
        `
          INSERT INTO ${TABLES.surveyItems} (section_id, code, statement, sort_order, is_required)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            section_id,
            code,
            statement,
            sort_order,
            is_required,
            created_at,
            updated_at
        `,
        [
          sectionRow.id,
          itemCode,
          statement,
          normalizeSortOrder(item.sortOrder, itemIndex + 1),
          item.isRequired ?? true,
        ],
      );
    }
  }

  return {
    ...form,
    sections: await getQuestionnaireSections(client, form.id),
  };
}

async function createSurveySeries(input: CreateSurveySeriesInput) {
  const seriesTitle = requireText(input.surveySeriesTitle, "Survey series title");
  const forms = input.forms ?? [];

  if (forms.length === 0) {
    throw new Error("At least one survey form is required to create a survey series.");
  }

  const seriesId =
    sanitizeText(input.surveySeriesId) ?? `${createCodeFromTitle(seriesTitle, "survey_series")}_${Date.now().toString(36)}`;

  const createdForms: SurveyQuestionnaireForm[] = [];

  for (const [index, form] of forms.entries()) {
    createdForms.push(
      await createSurveyForm({
        ...form,
        surveySeriesId: seriesId,
        surveySeriesTitle: seriesTitle,
        surveyStepNumber: normalizeSortOrder(form.surveyStepNumber, index + 1),
      }),
    );
  }

  return createdForms;
}

async function createRespondent(executor: DatabaseExecutor, input: CreateRespondentInput) {
  const result = await executor.query<RespondentRow>(
    `
      INSERT INTO ${TABLES.respondents} (
        full_name,
        email,
        role,
        office,
        program,
        consent_given
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        full_name,
        email,
        role,
        office,
        program,
        consent_given,
        created_at,
        updated_at
    `,
    [
      sanitizeText(input.fullName),
      sanitizeText(input.email),
      input.role ?? null,
      sanitizeText(input.office),
      sanitizeText(input.program),
      input.consentGiven ?? true,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Unable to create respondent.");
  }

  return mapRespondent(row);
}

async function getRespondentById(executor: DatabaseExecutor, respondentId: string) {
  const result = await executor.query<RespondentRow>(
    `
      SELECT
        id,
        full_name,
        email,
        role,
        office,
        program,
        consent_given,
        created_at,
        updated_at
      FROM ${TABLES.respondents}
      WHERE id = $1
      LIMIT 1
    `,
    [respondentId],
  );

  const row = result.rows[0];
  return row ? mapRespondent(row) : null;
}

async function getQuestionnaireSections(executor: DatabaseExecutor, formId: string) {
  const sectionsResult = await executor.query<SurveySectionRow>(
    `
      SELECT
        id,
        form_id,
        code,
        title,
        sort_order,
        created_at,
        updated_at
      FROM ${TABLES.surveySections}
      WHERE form_id = $1
      ORDER BY sort_order ASC, title ASC
    `,
    [formId],
  );

  const sectionRows = sectionsResult.rows;
  const sectionIds = sectionRows.map((section) => section.id);

  if (sectionIds.length === 0) {
    return [];
  }

  const itemsResult = await executor.query<SurveyItemRow>(
    `
      SELECT
        id,
        section_id,
        code,
        statement,
        sort_order,
        is_required,
        created_at,
        updated_at
      FROM ${TABLES.surveyItems}
      WHERE section_id = ANY($1::uuid[])
      ORDER BY sort_order ASC, statement ASC
    `,
    [sectionIds],
  );

  const itemsBySectionId = new Map<string, SurveyQuestionnaireItem[]>();

  for (const item of itemsResult.rows.map(mapSurveyItem)) {
    const sectionItems = itemsBySectionId.get(item.sectionId) ?? [];
    sectionItems.push(item);
    itemsBySectionId.set(item.sectionId, sectionItems);
  }

  return sectionRows.map((sectionRow) => ({
    ...mapSurveySection(sectionRow),
    items: itemsBySectionId.get(sectionRow.id) ?? [],
  }));
}

async function validateSurveyAnswers(executor: DatabaseExecutor, formId: string, answers: SubmitSurveyAnswerInput[]) {
  if (answers.length === 0) {
    throw new Error("At least one survey answer is required.");
  }

  const duplicateItemIds = answers
    .map((answer) => answer.itemId)
    .filter((itemId, index, itemIds) => itemIds.indexOf(itemId) !== index);

  if (duplicateItemIds.length > 0) {
    throw new Error(`Duplicate survey answer item ids: ${Array.from(new Set(duplicateItemIds)).join(", ")}`);
  }

  const itemIds = answers.map((answer) => answer.itemId);
  const itemResult = await executor.query<{ id: string; is_required: boolean }>(
    `
      SELECT si.id, si.is_required
      FROM ${TABLES.surveyItems} si
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id
      WHERE ss.form_id = $1
        AND si.id = ANY($2::uuid[])
    `,
    [formId, itemIds],
  );

  const validItemIds = new Set(itemResult.rows.map((row) => row.id));
  const invalidItemIds = itemIds.filter((itemId) => !validItemIds.has(itemId));

  if (invalidItemIds.length > 0) {
    throw new Error(`Survey answers contain items that do not belong to the selected form: ${invalidItemIds.join(", ")}`);
  }

  for (const answer of answers) {
    normalizeLikertValue(Number(answer.rating));
  }
}

export const surveyService = {
  getPool,

  async createSurveyForm(input: CreateSurveyFormInput) {
    return createSurveyForm(input);
  },

  async createSurveySeries(input: CreateSurveySeriesInput) {
    return createSurveySeries(input);
  },

  async listSurveyForms(options: { activeOnly?: boolean } = {}) {
    const pool = getPool();
    const activeOnly = options.activeOnly ?? true;

    const result = await pool.query<SurveyFormRow>(
      `
        SELECT
          id,
          code,
          survey_series_id,
          survey_step_number,
          survey_series_title,
          title,
          description,
          study_title,
          document_header,
          introduction,
          researchers,
          adviser,
          instruction,
          scale,
          voluntary_note,
          signature_label,
          respondent_information_required,
          respondent_information_fields,
          is_active,
          created_at,
          updated_at
        FROM ${TABLES.surveyForms}
        WHERE ($1::boolean = FALSE OR is_active = TRUE)
        ORDER BY survey_series_title ASC NULLS LAST, survey_series_id ASC NULLS LAST, survey_step_number ASC, title ASC
      `,
      [activeOnly],
    );

    return result.rows.map(mapSurveyForm);
  },

  async getSurveyFormById(formId: string) {
    return getSurveyFormById(getPool(), formId);
  },

  async getSurveyFormByCode(formCode: SurveyFormCode) {
    return getSurveyFormByCode(getPool(), formCode);
  },

  async updateSurveyForm(formId: string, input: UpdateSurveyFormInput) {
    return updateSurveyForm(formId, input);
  },

  async updateSurveyQuestionnaireForm(formId: string, input: UpdateSurveyQuestionnaireInput) {
    return updateSurveyQuestionnaireForm(formId, input);
  },

  async updateSurveyFormRespondentInformation(formId: string, input: UpdateSurveyFormRespondentInformationInput) {
    return updateSurveyFormRespondentInformation(formId, input);
  },

  async getQuestionnaireByFormId(formId: string): Promise<SurveyQuestionnaireForm | null> {
    const pool = getPool();
    const form = await getSurveyFormById(pool, formId);

    if (!form) {
      return null;
    }

    return {
      ...form,
      sections: await getQuestionnaireSections(pool, form.id),
    };
  },

  async getQuestionnaireByFormCode(formCode: SurveyFormCode): Promise<SurveyQuestionnaireForm | null> {
    const pool = getPool();
    const form = await getSurveyFormByCode(pool, formCode);

    if (!form) {
      return null;
    }

    return {
      ...form,
      sections: await getQuestionnaireSections(pool, form.id),
    };
  },

  async createRespondent(input: CreateRespondentInput) {
    return createRespondent(getPool(), input);
  },

  async getRespondentById(respondentId: string) {
    return getRespondentById(getPool(), respondentId);
  },

  async submitSurveyResponse(input: SubmitSurveyResponseInput): Promise<SubmittedSurveyResponse> {
    const submission = await withTransaction(async (client) => {
      const form = await resolveSurveyForm(client, input);

      if (!form.isActive) {
        throw new Error(`Survey form is inactive: ${form.code}`);
      }

      if (!input.voluntaryConsent) {
        throw new Error("Voluntary consent is required before submitting the survey response.");
      }

      if (form.respondentInformationRequired && !input.respondentId) {
        validateRespondentInformation(input.respondent, form.respondentInformationFields);
      }

      await validateSurveyAnswers(client, form.id, input.answers);

      const respondent = input.respondentId
        ? await getRespondentById(client, input.respondentId)
        : input.respondent
          ? await createRespondent(client, input.respondent)
          : null;

      if (input.respondentId && !respondent) {
        throw new Error(`Respondent not found: ${input.respondentId}`);
      }

      const respondentSignature = await resolveRespondentSignature(input, form);

      const responseResult = await client.query<SurveyResponseRow>(
        `
          INSERT INTO ${TABLES.surveyResponses} (
            form_id,
            respondent_id,
            respondent_signature,
            voluntary_consent,
            submitted_at
          )
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING
            id,
            form_id,
            respondent_id,
            respondent_signature,
            voluntary_consent,
            submitted_at,
            created_at,
            updated_at
        `,
        [
          form.id,
          respondent?.id ?? null,
          respondentSignature,
          input.voluntaryConsent,
        ],
      );

      const responseRow = responseResult.rows[0];

      if (!responseRow) {
        throw new Error("Unable to create survey response.");
      }

      const response = mapSurveyResponse(responseRow);
      const savedAnswers: SurveyAnswer[] = [];

      for (const answer of input.answers) {
        const answerResult = await client.query<SurveyAnswerRow>(
          `
            INSERT INTO ${TABLES.surveyAnswers} (response_id, item_id, rating)
            VALUES ($1, $2, $3)
            RETURNING
              id,
              response_id,
              item_id,
              rating,
              created_at,
              updated_at
          `,
          [response.id, answer.itemId, normalizeLikertValue(Number(answer.rating))],
        );

        const answerRow = answerResult.rows[0];

        if (!answerRow) {
          throw new Error(`Unable to save survey answer for item: ${answer.itemId}`);
        }

        savedAnswers.push(mapSurveyAnswer(answerRow));
      }

      return {
        response: {
          ...response,
          respondent,
          answers: savedAnswers,
        },
        form,
        respondent,
      };
    });

    try {
      await sendResponseReviewEmail({
        response: submission.response,
        form: submission.form,
        respondent: submission.respondent,
      });
    } catch (error) {
      console.error("Unable to send survey response review email.", error);
    }

    return submission.response;
  },

  async listSurveyResponses(options: ListSurveyResponsesOptions = {}) {
    const pool = getPool();
    const filters: string[] = [];
    const values: unknown[] = [];

    if (options.responseId) {
      values.push(options.responseId);
      filters.push(`sr.id = $${values.length}`);
    }

    if (options.formId) {
      values.push(options.formId);
      filters.push(`sr.form_id = $${values.length}`);
    }

    if (options.formCode) {
      values.push(options.formCode);
      filters.push(`sf.code = $${values.length}`);
    }

    if (options.respondentId) {
      values.push(options.respondentId);
      filters.push(`sr.respondent_id = $${values.length}`);
    }

    if (options.submittedOnly ?? true) {
      filters.push("sr.submitted_at IS NOT NULL");
    }

    values.push(normalizeLimit(options.limit));
    const limitPlaceholder = `$${values.length}`;
    values.push(normalizeOffset(options.offset));
    const offsetPlaceholder = `$${values.length}`;

    const result = await pool.query<SurveyResponseSummaryRow>(
      `
        SELECT
          sr.id,
          sr.form_id,
          sr.respondent_id,
          sr.respondent_signature,
          sr.voluntary_consent,
          sr.submitted_at,
          sr.created_at,
          sr.updated_at,
          sf.code AS form_code,
          sf.title AS form_title,
          r.full_name AS respondent_full_name,
          r.email AS respondent_email,
          r.role AS respondent_role,
          r.office AS respondent_office,
          r.program AS respondent_program,
          COUNT(sa.id)::int AS answer_count,
          COALESCE(ROUND(AVG(sa.rating)::numeric, 2), 0)::float8 AS weighted_mean
        FROM ${TABLES.surveyResponses} sr
        JOIN ${TABLES.surveyForms} sf ON sf.id = sr.form_id
        LEFT JOIN ${TABLES.respondents} r ON r.id = sr.respondent_id
        LEFT JOIN ${TABLES.surveyAnswers} sa ON sa.response_id = sr.id
        ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
        GROUP BY
          sr.id,
          sr.form_id,
          sr.respondent_id,
          sr.respondent_signature,
          sr.voluntary_consent,
          sr.submitted_at,
          sr.created_at,
          sr.updated_at,
          sf.code,
          sf.title,
          r.full_name,
          r.email,
          r.role,
          r.office,
          r.program
        ORDER BY sr.submitted_at DESC NULLS LAST, sr.created_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      values,
    );

    return result.rows.map(mapSurveyResponseSummary);
  },

  async getResponseAnswers(responseId: string) {
    return getResponseAnswerDetails(responseId);
  },

  async resendSurveyResponseReviewEmail(responseId: string) {
    const [response] = await this.listSurveyResponses({
      responseId,
      submittedOnly: false,
      limit: 1,
    });

    if (!response) {
      throw new Error("Survey response not found.");
    }

    if (!response.respondentEmail) {
      throw new Error("The selected response does not have a respondent email address.");
    }

    const answers = await getResponseAnswerDetails(responseId);

    await sendSurveyResponseReviewEmail({
      to: response.respondentEmail,
      response,
      answers,
    });

    return {
      response,
      answers,
    };
  },

  async deleteSurveyForm(formId: string) {
    return withTransaction(async (client) => {
      const form = await getSurveyFormById(client, formId);

      if (!form) {
        return null;
      }

      await client.query(
        `
          DELETE FROM ${TABLES.surveyAnswers}
          WHERE response_id IN (
            SELECT id FROM ${TABLES.surveyResponses}
            WHERE form_id = $1
          )
          OR item_id IN (
            SELECT si.id
            FROM ${TABLES.surveyItems} si
            JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id
            WHERE ss.form_id = $1
          )
        `,
        [formId],
      );
      await client.query(
        `
          DELETE FROM ${TABLES.manualSurveyAnswerCounts}
          WHERE item_id IN (
            SELECT si.id
            FROM ${TABLES.surveyItems} si
            JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id
            WHERE ss.form_id = $1
          )
        `,
        [formId],
      );
      await client.query(`DELETE FROM ${TABLES.manualSurveyResponseBatches} WHERE form_id = $1`, [formId]);
      await client.query(`DELETE FROM ${TABLES.surveyResponses} WHERE form_id = $1`, [formId]);
      await client.query(
        `
          DELETE FROM ${TABLES.surveyItems}
          WHERE section_id IN (
            SELECT id FROM ${TABLES.surveySections}
            WHERE form_id = $1
          )
        `,
        [formId],
      );
      await client.query(`DELETE FROM ${TABLES.surveySections} WHERE form_id = $1`, [formId]);
      await client.query(`DELETE FROM ${TABLES.surveyForms} WHERE id = $1`, [formId]);

      return form;
    });
  },

  async deleteSurveyResponse(responseId: string) {
    return withTransaction(async (client) => {
      const existingResponse = await client.query<SurveyResponseRow>(
        `
          SELECT
            id,
            form_id,
            respondent_id,
            respondent_signature,
            voluntary_consent,
            submitted_at,
            created_at,
            updated_at
          FROM ${TABLES.surveyResponses}
          WHERE id = $1
          LIMIT 1
        `,
        [responseId],
      );

      const responseRow = existingResponse.rows[0];

      if (!responseRow) {
        return null;
      }

      await client.query(`DELETE FROM ${TABLES.surveyAnswers} WHERE response_id = $1`, [responseId]);
      await client.query(`DELETE FROM ${TABLES.surveyResponses} WHERE id = $1`, [responseId]);

      return mapSurveyResponse(responseRow);
    });
  },

  async closePool() {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = null;
    }
  },
};

export default surveyService;