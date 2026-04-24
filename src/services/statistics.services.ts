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
} from "../database/model/model.js";

type DatabaseExecutor = Pool | PoolClient;

type RatingDistribution = Record<LikertValue, number>;

type SurveyStatisticsFilters = {
  formId?: string;
  formCode?: SurveyFormCode;
  sectionId?: string;
  sectionCode?: string;
  itemId?: string;
  submittedFrom?: Date | string;
  submittedTo?: Date | string;
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
  rating: LikertValue;
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

function createEmptyDistribution(): RatingDistribution {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
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
    basis: "SPSS-inspired descriptive statistics for Likert-scale survey responses.",
    scale: "1=Strongly Disagree, 2=Disagree, 3=Neutral, 4=Agree, 5=Strongly Agree",
    weightedTotal,
    squaredDeviationsTotal: round(squaredDeviationsTotal),
    steps: [
      {
        label: "Frequency distribution",
        formula: "f = count of responses per Likert rating",
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

function calculateDescriptiveStatistics(values: number[]): DescriptiveStatistics {
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

function buildRatingQuery(filters: SurveyStatisticsFilters = {}) {
  const where: string[] = ["sr.submitted_at IS NOT NULL"];
  const values: unknown[] = [];

  if (filters.formId) {
    values.push(filters.formId);
    where.push(`sf.id = $${values.length}`);
  }

  if (filters.formCode) {
    values.push(filters.formCode);
    where.push(`sf.code = $${values.length}`);
  }

  if (filters.sectionId) {
    values.push(filters.sectionId);
    where.push(`ss.id = $${values.length}`);
  }

  if (filters.sectionCode) {
    values.push(filters.sectionCode);
    where.push(`ss.code = $${values.length}`);
  }

  if (filters.itemId) {
    values.push(filters.itemId);
    where.push(`si.id = $${values.length}`);
  }

  if (filters.submittedFrom) {
    values.push(filters.submittedFrom);
    where.push(`sr.submitted_at >= $${values.length}`);
  }

  if (filters.submittedTo) {
    values.push(filters.submittedTo);
    where.push(`sr.submitted_at <= $${values.length}`);
  }

  return {
    sql: `
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
        sa.rating AS rating
      FROM ${TABLES.surveyAnswers} sa
      JOIN ${TABLES.surveyResponses} sr ON sr.id = sa.response_id
      JOIN ${TABLES.surveyForms} sf ON sf.id = sr.form_id
      JOIN ${TABLES.surveyItems} si ON si.id = sa.item_id
      JOIN ${TABLES.surveySections} ss ON ss.id = si.section_id AND ss.form_id = sf.id
      WHERE ${where.join(" AND ")}
      ORDER BY sf.title ASC, ss.sort_order ASC, si.sort_order ASC, sr.submitted_at ASC
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
        ...calculateDescriptiveStatistics(ratings),
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
        ...calculateDescriptiveStatistics(ratings),
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
        ...calculateDescriptiveStatistics(ratings),
      };
    })
    .sort((a, b) => a.formTitle.localeCompare(b.formTitle));
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
    const uniqueResponseIds = new Set(rows.map((row) => row.response_id));
    const uniqueItemIds = new Set(rows.map((row) => row.item_id));
    const ratings = rows.map((row) => Number(row.rating));

    return {
      responseCount: uniqueResponseIds.size,
      itemCount: uniqueItemIds.size,
      answerCount: rows.length,
      ...calculateDescriptiveStatistics(ratings),
    };
  },

  async closePool() {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = null;
    }
  },
};

export default statisticsService;