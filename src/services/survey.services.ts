import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { assertDatabaseConfig, getDatabaseConfig } from "../lib/db.js";
import {
  LIKERT_SCALE,
  TABLES,
  type LikertScale,
  type LikertValue,
  type Respondent,
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
  isActive?: boolean;
  sections?: CreateSurveySectionInput[];
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
  voluntaryConsent: boolean;
  answers: SubmitSurveyAnswerInput[];
};

export type SubmittedSurveyResponse = SurveyResponse & {
  respondent: Respondent | null;
  answers: SurveyAnswer[];
};

export type ListSurveyResponsesOptions = {
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

function validateRespondentInformation(input?: CreateRespondentInput | null) {
  if (!input) {
    throw new Error("Respondent information is required for this survey.");
  }

  requireText(input.fullName, "Respondent full name");
  requireText(input.email, "Respondent email");
  requireText(String(input.role ?? ""), "Respondent role");
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

function mapSurveyForm(row: SurveyFormRow): SurveyForm {
  return {
    id: row.id,
    code: row.code,
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
  return withTransaction(async (client) => {
    const title = requireText(input.title, "Survey title");
    const code = requireText(String(input.code ?? ""), "Survey code") as SurveyFormCode;
    const sections = input.sections ?? [];

    const formResult = await client.query<SurveyFormRow>(
      `
        INSERT INTO ${TABLES.surveyForms} (
          code,
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
          is_active
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13, $14)
        RETURNING
          id,
          code,
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
          is_active,
          created_at,
          updated_at
      `,
      [
        code,
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
        input.isActive ?? true,
      ],
    );

    const formRow = formResult.rows[0];

    if (!formRow) {
      throw new Error("Unable to create survey form.");
    }

    const form = mapSurveyForm(formRow);

    for (const [sectionIndex, section] of sections.entries()) {
      const sectionTitle = requireText(section.title, `Section ${sectionIndex + 1} title`);
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
          sanitizeText(section.code) ?? createCodeFromTitle(sectionTitle, `section_${sectionIndex + 1}`),
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
            sanitizeText(item.code) ?? createCodeFromTitle(statement, `item_${itemIndex + 1}`),
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
  });
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

  async listSurveyForms(options: { activeOnly?: boolean } = {}) {
    const pool = getPool();
    const activeOnly = options.activeOnly ?? true;

    const result = await pool.query<SurveyFormRow>(
      `
        SELECT
          id,
          code,
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
          is_active,
          created_at,
          updated_at
        FROM ${TABLES.surveyForms}
        WHERE ($1::boolean = FALSE OR is_active = TRUE)
        ORDER BY title ASC
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
    return withTransaction(async (client) => {
      const form = await resolveSurveyForm(client, input);

      if (!form.isActive) {
        throw new Error(`Survey form is inactive: ${form.code}`);
      }

      if (!input.voluntaryConsent) {
        throw new Error("Voluntary consent is required before submitting the survey response.");
      }

      if (form.respondentInformationRequired && !input.respondentId) {
        validateRespondentInformation(input.respondent);
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
          sanitizeText(input.respondentSignature),
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
        ...response,
        respondent,
        answers: savedAnswers,
      };
    });
  },

  async listSurveyResponses(options: ListSurveyResponsesOptions = {}) {
    const pool = getPool();
    const filters: string[] = [];
    const values: unknown[] = [];

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

    const result = await pool.query<SurveyResponseRow>(
      `
        SELECT
          sr.id,
          sr.form_id,
          sr.respondent_id,
          sr.respondent_signature,
          sr.voluntary_consent,
          sr.submitted_at,
          sr.created_at,
          sr.updated_at
        FROM ${TABLES.surveyResponses} sr
        JOIN ${TABLES.surveyForms} sf ON sf.id = sr.form_id
        ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY sr.submitted_at DESC NULLS LAST, sr.created_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      values,
    );

    return result.rows.map(mapSurveyResponse);
  },

  async getResponseAnswers(responseId: string) {
    const pool = getPool();
    const result = await pool.query<SurveyAnswerRow>(
      `
        SELECT
          id,
          response_id,
          item_id,
          rating,
          created_at,
          updated_at
        FROM ${TABLES.surveyAnswers}
        WHERE response_id = $1
        ORDER BY created_at ASC
      `,
      [responseId],
    );

    return result.rows.map(mapSurveyAnswer);
  },

  async closePool() {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = null;
    }
  },
};

export default surveyService;