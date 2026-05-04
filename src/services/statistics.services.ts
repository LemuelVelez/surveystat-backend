import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import mean from "@stdlib/stats-base-mean";
import min from "@stdlib/stats-base-min";
import max from "@stdlib/stats-base-max";

import { assertDatabaseConfig, getDatabaseConfig } from "../lib/db.js";
import {
  getLikertInterpretation,
  LIKERT_SCALE,
  TABLES,
  type LikertValue,
  type SurveyFormCode,
  type SurveyResponseSource,
} from "../database/model/model.js";

type DatabaseExecutor = Pool | PoolClient;

type RatingDistribution = Record<LikertValue, number>;

type SourceBreakdown = {
  onlineResponseCount: number;
  hardcopyResponseCount: number;
  onlineAnswerCount: number;
  hardcopyAnswerCount: number;
};

type SurveyStatisticsFilters = {
  formId?: string;
  formCode?: SurveyFormCode;
  sectionId?: string;
  sectionCode?: string;
  itemId?: string;
  submittedFrom?: Date | string;
  submittedTo?: Date | string;
  responseSource?: SurveyResponseSource;
};

type RatingRow = QueryResultRow & {
  form_id: string;
  form_code: SurveyFormCode;
  form_title: string;
  section_id: string;
  section_code: string;
  section_title: string;
  section_sort_order: number;
  item_id: string;
  item_code: string;
  item_statement: string;
  item_sort_order: number;
  response_id: string;
  response_source: "online" | "hardcopy";
  hardcopy_batch_id?: string | null;
  hardcopy_response_count?: number | string | null;
  rating: LikertValue;
};

type ManualHardcopySurveyItemCounts = {
  itemId: string;
  counts: Partial<Record<LikertValue | string, number | string | null | undefined>>;
};

export type CreateManualHardcopySurveyStatisticsPayload = {
  formId?: string;
  formCode?: SurveyFormCode;
  batchLabel?: string | null;
  hardcopyResponseCount?: number | string | null;
  encodedBy?: string | null;
  notes?: string | null;
  ratingCounts: ManualHardcopySurveyItemCounts[];
};

export type ManualHardcopySurveyStatisticsResult = {
  batch: {
    id: string;
    formId: string;
    batchLabel: string;
    hardcopyResponseCount: number;
    encodedBy?: string | null;
    notes?: string | null;
    encodedAt: Date;
  };
  itemCount: number;
  answerCount: number;
  ratingCounts: Array<{
    itemId: string;
    rating: LikertValue;
    responseCount: number;
  }>;
};

export type DescriptiveCalculationStep = {
  label: string;
  formula: string;
  substitution: string;
  result: string;
};

export type DescriptiveCalculation = {
  basis: string;
  scale: string;
  weightedTotal: number;
  squaredDeviationsTotal: number;
  steps: DescriptiveCalculationStep[];
};

export type DescriptiveStatistics = {
  count: number;
  mean: number;
  weightedMean: number;
  standardDeviation: number;
  variance: number;
  minimum: number;
  maximum: number;
  total: number;
  distribution: RatingDistribution;
  interpretation: string;
  meanRange: string;
  sourceBreakdown: SourceBreakdown;
  calculation: DescriptiveCalculation;
};

export type SurveyItemStatistics = DescriptiveStatistics & {
  formId: string;
  formCode: SurveyFormCode;
  formTitle: string;
  sectionId: string;
  sectionCode: string;
  sectionTitle: string;
  itemId: string;
  itemCode: string;
  itemStatement: string;
  itemSortOrder: number;
};

export type SurveySectionStatistics = DescriptiveStatistics & {
  formId: string;
  formCode: SurveyFormCode;
  formTitle: string;
  sectionId: string;
  sectionCode: string;
  sectionTitle: string;
  sectionSortOrder: number;
  items: SurveyItemStatistics[];
};

export type SurveyFormStatistics = DescriptiveStatistics & {
  formId: string;
  formCode: SurveyFormCode;
  formTitle: string;
  sections: SurveySectionStatistics[];
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

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function createEmptyDistribution(): RatingDistribution {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

function createEmptySourceBreakdown(): SourceBreakdown {
  return {
    onlineResponseCount: 0,
    hardcopyResponseCount: 0,
    onlineAnswerCount: 0,
    hardcopyAnswerCount: 0,
  };
}

function round(value: number, precision = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function getDistribution(values: number[]) {
  const distribution = createEmptyDistribution();

  for (const value of values) {
    if (value >= 1 && value <= 5) {
      distribution[value as LikertValue] += 1;
    }
  }

  return distribution;
}

function calculateWeightedMean(distribution: RatingDistribution, count: number) {
  if (count <= 0) {
    return 0;
  }

  const weightedTotal = LIKERT_SCALE.reduce(
    (total, scale) => total + scale.value * distribution[scale.value],
    0,
  );

  return weightedTotal / count;
}

function buildCalculationDetails(
  values: number[],
  distribution: RatingDistribution,
  count: number,
  total: number,
  meanValue: number,
  weightedMean: number,
  varianceValue: number,
  standardDeviation: number,
  squaredDeviationsTotal: number,
): DescriptiveCalculation {
  const weightedTotal = LIKERT_SCALE.reduce(
    (sum, scale) => sum + scale.value * distribution[scale.value],
    0,
  );
  const frequencySubstitution = LIKERT_SCALE.map((scale) => `${scale.value}(${distribution[scale.value]})`).join(" + ");
  const ratingPreview = values.length > 20 ? `${values.slice(0, 20).join(", ")} ...` : values.join(", ");
  const varianceDenominator = count > 1 ? count - 1 : 0;

  return {
    basis: "SPSS-inspired descriptive statistics for combined online and hardcopy Likert-scale survey responses.",
    scale: "1=Strongly Disagree, 2=Disagree, 3=Neutral, 4=Agree, 5=Strongly Agree",
    weightedTotal,
    squaredDeviationsTotal: round(squaredDeviationsTotal),
    steps: [
      {
        label: "Frequency distribution",
        formula: "f = count of online answers plus encoded hardcopy answers per Likert rating",
        substitution: `Ratings: ${ratingPreview || "No ratings"}`,
        result: `1=${distribution[1]}, 2=${distribution[2]}, 3=${distribution[3]}, 4=${distribution[4]}, 5=${distribution[5]}`,
      },
      {
        label: "Total score",
        formula: "Σx",
        substitution: values.length > 0 ? values.join(" + ") : "0",
        result: `${total}`,
      },
      {
        label: "Mean",
        formula: "Σx / N",
        substitution: `${total} / ${count || 1}`,
        result: `${round(meanValue)}`,
      },
      {
        label: "Weighted total",
        formula: "Σ(xf)",
        substitution: frequencySubstitution,
        result: `${weightedTotal}`,
      },
      {
        label: "Weighted mean",
        formula: "Σ(xf) / N",
        substitution: `${weightedTotal} / ${count || 1}`,
        result: `${round(weightedMean)}`,
      },
      {
        label: "Sample variance",
        formula: "Σ(x - x̄)² / (N - 1)",
        substitution: `${round(squaredDeviationsTotal)} / ${varianceDenominator || 1}`,
        result: `${round(varianceValue)}`,
      },
      {
        label: "Standard deviation",
        formula: "√variance",
        substitution: `√${round(varianceValue)}`,
        result: `${round(standardDeviation)}`,
      },
    ],
  };
}

function calculateDescriptiveStatistics(values: number[], sourceBreakdown = createEmptySourceBreakdown()): DescriptiveStatistics {
  const count = values.length;
  const distribution = getDistribution(values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const meanValue = count > 0 ? mean(count, values, 1) : 0;
  const weightedMean = calculateWeightedMean(distribution, count);
  const squaredDeviationsTotal = values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0);
  const varianceValue = count > 1 ? squaredDeviationsTotal / (count - 1) : 0;
  const standardDeviation = Math.sqrt(varianceValue);
  const interpretation = getLikertInterpretation(weightedMean || meanValue);

  return {
    count,
    mean: round(meanValue),
    weightedMean: round(weightedMean),
    standardDeviation: round(standardDeviation),
    variance: round(varianceValue),
    minimum: count > 0 ? min(count, values, 1) : 0,
    maximum: count > 0 ? max(count, values, 1) : 0,
    total,
    distribution,
    interpretation: interpretation.label,
    meanRange: interpretation.meanRange,
    sourceBreakdown,
    calculation: buildCalculationDetails(
      values,
      distribution,
      count,
      total,
      meanValue,
      weightedMean,
      varianceValue,
      standardDeviation,
      squaredDeviationsTotal,
    ),
  };
}

function normalizeResponseSource(value?: SurveyResponseSource | string | null): SurveyResponseSource {
  if (value === "online" || value === "hardcopy") {
    return value;
  }

  return "all";
}

function buildRatingQuery(filters: SurveyStatisticsFilters = {}) {
  const responseSource = normalizeResponseSource(filters.responseSource);
  const includeOnline = responseSource !== "hardcopy";
  const includeHardcopy = responseSource !== "online";
  const onlineWhere: string[] = ["sr.submitted_at IS NOT NULL"];
  const hardcopyWhere: string[] = ["mac.response_count > 0"];
  const values: unknown[] = [];

  function addFilter(value: unknown, onlineCondition: string, hardcopyCondition: string) {
    values.push(value);
    const placeholder = `$${values.length}`;
    onlineWhere.push(onlineCondition.replace("?", placeholder));
    hardcopyWhere.push(hardcopyCondition.replace("?", placeholder));
  }

  if (filters.formId) {
    addFilter(filters.formId, "sf.id = ?", "sf.id = ?");
  }

  if (filters.formCode) {
    addFilter(filters.formCode, "sf.code = ?", "sf.code = ?");
  }

  if (filters.sectionId) {
    addFilter(filters.sectionId, "ss.id = ?", "ss.id = ?");
  }

  if (filters.sectionCode) {
    addFilter(filters.sectionCode, "ss.code = ?", "ss.code = ?");
  }

  if (filters.itemId) {
    addFilter(filters.itemId, "si.id = ?", "si.id = ?");
  }

  if (filters.submittedFrom) {
    addFilter(filters.submittedFrom, "sr.submitted_at >= ?", "mb.encoded_at >= ?");
  }

  if (filters.submittedTo) {
    addFilter(filters.submittedTo, "sr.submitted_at <= ?", "mb.encoded_at <= ?");
  }

  const selects: string[] = [];

  if (includeOnline) {
    selects.push(`
      SELECT
        sf.id AS form_id,
        sf.code AS form_code,
        sf.title AS form_title,
        ss.id AS section_id,
        ss.code AS section_code,
        ss.title AS section_title,
        ss.sort_order AS section_sort_order,
        si.id AS item_id,
        si.code AS item_code,
        si.statement AS item_statement,
        si.sort_order AS item_sort_order,
        sr.id AS response_id,
        'online'::text AS response_source,
        NULL::text AS hardcopy_batch_id,
        0::integer AS hardcopy_response_count,
        sa.rating::integer AS rating,
        sr.submitted_at AS submitted_at
      FROM ${TABLES.surveyAnswers} sa
      JOIN ${TABLES.surveyResponses} sr ON sr.id = sa.response_id
      JOIN ${TABLES.surveyForms} sf ON sf.id = sr.form_id
      JOIN ${TABLES.surveyItems} si ON si.id = sa.item_id
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id AND ss.form_id = sf.id
      WHERE ${onlineWhere.join(" AND ")}
    `);
  }

  if (includeHardcopy) {
    selects.push(`
      SELECT
        sf.id AS form_id,
        sf.code AS form_code,
        sf.title AS form_title,
        ss.id AS section_id,
        ss.code AS section_code,
        ss.title AS section_title,
        ss.sort_order AS section_sort_order,
        si.id AS item_id,
        si.code AS item_code,
        si.statement AS item_statement,
        si.sort_order AS item_sort_order,
        CONCAT('hardcopy:', mb.id, ':', si.id, ':', mac.rating, ':', hardcopy_row.answer_index) AS response_id,
        'hardcopy'::text AS response_source,
        mb.id AS hardcopy_batch_id,
        mb.hardcopy_response_count::integer AS hardcopy_response_count,
        mac.rating::integer AS rating,
        mb.encoded_at AS submitted_at
      FROM ${TABLES.manualSurveyAnswerCounts} mac
      JOIN ${TABLES.manualSurveyResponseBatches} mb ON mb.id = mac.batch_id
      JOIN ${TABLES.surveyForms} sf ON sf.id = mb.form_id
      JOIN ${TABLES.surveyItems} si ON si.id = mac.item_id
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id AND ss.form_id = sf.id
      JOIN LATERAL generate_series(1, GREATEST(mac.response_count, 0)) AS hardcopy_row(answer_index) ON TRUE
      WHERE ${hardcopyWhere.join(" AND ")}
    `);
  }

  return {
    sql: `
      ${selects.join("\nUNION ALL\n")}
      ORDER BY form_title ASC, section_sort_order ASC, item_sort_order ASC, submitted_at ASC
    `,
    values,
  };
}

async function fetchRatingRows(executor: DatabaseExecutor, filters: SurveyStatisticsFilters = {}) {
  const query = buildRatingQuery(filters);
  const result = await executor.query<RatingRow>(query.sql, query.values);
  return result.rows;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Map<string, T[]>>((groups, item) => {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
    return groups;
  }, new Map<string, T[]>());
}

function getSourceBreakdown(rows: RatingRow[]): SourceBreakdown {
  const onlineResponseIds = new Set<string>();
  const hardcopyBatchResponseCounts = new Map<string, number>();
  const breakdown = createEmptySourceBreakdown();

  for (const row of rows) {
    if (row.response_source === "hardcopy") {
      breakdown.hardcopyAnswerCount += 1;

      if (row.hardcopy_batch_id) {
        hardcopyBatchResponseCounts.set(
          row.hardcopy_batch_id,
          Math.max(
            hardcopyBatchResponseCounts.get(row.hardcopy_batch_id) ?? 0,
            Number(row.hardcopy_response_count ?? 0),
          ),
        );
      }
    } else {
      breakdown.onlineAnswerCount += 1;
      onlineResponseIds.add(row.response_id);
    }
  }

  breakdown.onlineResponseCount = onlineResponseIds.size;
  breakdown.hardcopyResponseCount = Array.from(hardcopyBatchResponseCounts.values()).reduce(
    (total, count) => total + count,
    0,
  );

  return breakdown;
}

function buildItemStatistics(rows: RatingRow[]): SurveyItemStatistics[] {
  const itemGroups = groupBy(rows, (row) => row.item_id);

  return Array.from(itemGroups.values())
    .map((itemRows) => {
      const firstRow = itemRows[0];
      const ratings = itemRows.map((row) => Number(row.rating));

      return {
        formId: firstRow.form_id,
        formCode: firstRow.form_code,
        formTitle: firstRow.form_title,
        sectionId: firstRow.section_id,
        sectionCode: firstRow.section_code,
        sectionTitle: firstRow.section_title,
        itemId: firstRow.item_id,
        itemCode: firstRow.item_code,
        itemStatement: firstRow.item_statement,
        itemSortOrder: firstRow.item_sort_order,
        ...calculateDescriptiveStatistics(ratings, getSourceBreakdown(itemRows)),
      };
    })
    .sort((a, b) => a.itemSortOrder - b.itemSortOrder || a.itemStatement.localeCompare(b.itemStatement));
}

function buildSectionStatistics(rows: RatingRow[]): SurveySectionStatistics[] {
  const sectionGroups = groupBy(rows, (row) => row.section_id);

  return Array.from(sectionGroups.values())
    .map((sectionRows) => {
      const firstRow = sectionRows[0];
      const ratings = sectionRows.map((row) => Number(row.rating));

      return {
        formId: firstRow.form_id,
        formCode: firstRow.form_code,
        formTitle: firstRow.form_title,
        sectionId: firstRow.section_id,
        sectionCode: firstRow.section_code,
        sectionTitle: firstRow.section_title,
        sectionSortOrder: firstRow.section_sort_order,
        items: buildItemStatistics(sectionRows),
        ...calculateDescriptiveStatistics(ratings, getSourceBreakdown(sectionRows)),
      };
    })
    .sort((a, b) => a.sectionSortOrder - b.sectionSortOrder || a.sectionTitle.localeCompare(b.sectionTitle));
}

function buildFormStatistics(rows: RatingRow[]): SurveyFormStatistics[] {
  const formGroups = groupBy(rows, (row) => row.form_id);

  return Array.from(formGroups.values())
    .map((formRows) => {
      const firstRow = formRows[0];
      const ratings = formRows.map((row) => Number(row.rating));

      return {
        formId: firstRow.form_id,
        formCode: firstRow.form_code,
        formTitle: firstRow.form_title,
        sections: buildSectionStatistics(formRows),
        ...calculateDescriptiveStatistics(ratings, getSourceBreakdown(formRows)),
      };
    })
    .sort((a, b) => a.formTitle.localeCompare(b.formTitle));
}

function normalizeCount(value: unknown) {
  const count = Number(value ?? 0);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

function normalizeManualRatingCounts(payload: CreateManualHardcopySurveyStatisticsPayload) {
  const rows: Array<{ itemId: string; rating: LikertValue; responseCount: number }> = [];

  for (const item of payload.ratingCounts ?? []) {
    const itemId = String(item.itemId ?? "").trim();

    if (!itemId) {
      continue;
    }

    for (const rating of [1, 2, 3, 4, 5] as LikertValue[]) {
      const responseCount = normalizeCount(item.counts?.[rating] ?? item.counts?.[String(rating)]);

      if (responseCount > 0) {
        rows.push({ itemId, rating, responseCount });
      }
    }
  }

  return rows;
}

async function resolveFormId(executor: DatabaseExecutor, payload: CreateManualHardcopySurveyStatisticsPayload) {
  if (payload.formId) {
    return String(payload.formId).trim();
  }

  if (!payload.formCode) {
    throw new Error("Form ID or form code is required for hardcopy statistics.");
  }

  const result = await executor.query<{ id: string }>(
    `SELECT id FROM ${TABLES.surveyForms} WHERE code = $1 LIMIT 1`,
    [payload.formCode],
  );

  const formId = result.rows[0]?.id;

  if (!formId) {
    throw new Error(`Survey form was not found for code: ${payload.formCode}`);
  }

  return formId;
}

async function getValidItemIds(executor: DatabaseExecutor, formId: string) {
  const result = await executor.query<{ id: string }>(
    `
      SELECT si.id
      FROM ${TABLES.surveyItems} si
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id
      WHERE ss.form_id = $1
    `,
    [formId],
  );

  return new Set(result.rows.map((row) => row.id));
}

function getDerivedHardcopyResponseCount(
  rows: Array<{ itemId: string; rating: LikertValue; responseCount: number }>,
  explicitResponseCount?: number | string | null,
) {
  const providedResponseCount = normalizeCount(explicitResponseCount);

  if (providedResponseCount > 0) {
    return providedResponseCount;
  }

  const itemTotals = rows.reduce<Map<string, number>>((totals, row) => {
    totals.set(row.itemId, (totals.get(row.itemId) ?? 0) + row.responseCount);
    return totals;
  }, new Map<string, number>());

  return Math.max(0, ...itemTotals.values());
}

export const statisticsService = {
  getPool,

  calculateDescriptiveStatistics,

  async getItemStatistics(filters: SurveyStatisticsFilters = {}) {
    const rows = await fetchRatingRows(getPool(), filters);
    return buildItemStatistics(rows);
  },

  async getSectionStatistics(filters: SurveyStatisticsFilters = {}) {
    const rows = await fetchRatingRows(getPool(), filters);
    return buildSectionStatistics(rows);
  },

  async getFormStatistics(filters: SurveyStatisticsFilters = {}) {
    const rows = await fetchRatingRows(getPool(), filters);
    return buildFormStatistics(rows);
  },

  async getSummary(filters: SurveyStatisticsFilters = {}) {
    const rows = await fetchRatingRows(getPool(), filters);
    const uniqueItemIds = new Set(rows.map((row) => row.item_id));
    const ratings = rows.map((row) => Number(row.rating));
    const sourceBreakdown = getSourceBreakdown(rows);

    return {
      responseCount: sourceBreakdown.onlineResponseCount + sourceBreakdown.hardcopyResponseCount,
      itemCount: uniqueItemIds.size,
      answerCount: rows.length,
      ...calculateDescriptiveStatistics(ratings, sourceBreakdown),
    };
  },

  async createManualHardcopyStatistics(payload: CreateManualHardcopySurveyStatisticsPayload): Promise<ManualHardcopySurveyStatisticsResult> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const formId = await resolveFormId(client, payload);
      const validItemIds = await getValidItemIds(client, formId);
      const ratingCounts = normalizeManualRatingCounts(payload).filter((row) => validItemIds.has(row.itemId));

      if (ratingCounts.length === 0) {
        throw new Error("Add at least one hardcopy rating count for a valid survey item.");
      }

      const hardcopyResponseCount = getDerivedHardcopyResponseCount(ratingCounts, payload.hardcopyResponseCount);
      const batchLabel = String(payload.batchLabel || "Hardcopy Survey Batch").trim() || "Hardcopy Survey Batch";
      const encodedBy = payload.encodedBy ? String(payload.encodedBy).trim() : null;
      const notes = payload.notes ? String(payload.notes).trim() : null;
      const batchId = createId("manual_batch");
      const batchResult = await client.query<{
        id: string;
        form_id: string;
        batch_label: string;
        hardcopy_response_count: number;
        encoded_by?: string | null;
        notes?: string | null;
        encoded_at: Date;
      }>(
        `
          INSERT INTO ${TABLES.manualSurveyResponseBatches}
            (id, form_id, batch_label, hardcopy_response_count, encoded_by, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, form_id, batch_label, hardcopy_response_count, encoded_by, notes, encoded_at
        `,
        [batchId, formId, batchLabel, hardcopyResponseCount, encodedBy, notes],
      );
      const batch = batchResult.rows[0];

      for (const row of ratingCounts) {
        await client.query(
          `
            INSERT INTO ${TABLES.manualSurveyAnswerCounts}
              (id, batch_id, item_id, rating, response_count)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [createId("manual_answer_count"), batch.id, row.itemId, row.rating, row.responseCount],
        );
      }

      await client.query("COMMIT");

      return {
        batch: {
          id: batch.id,
          formId: batch.form_id,
          batchLabel: batch.batch_label,
          hardcopyResponseCount: Number(batch.hardcopy_response_count),
          encodedBy: batch.encoded_by,
          notes: batch.notes,
          encodedAt: batch.encoded_at,
        },
        itemCount: new Set(ratingCounts.map((row) => row.itemId)).size,
        answerCount: ratingCounts.reduce((total, row) => total + row.responseCount, 0),
        ratingCounts,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async closePool() {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = null;
    }
  },
};

export default statisticsService;