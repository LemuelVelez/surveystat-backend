import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

import { assertDatabaseConfig, getDatabaseConfig } from "../../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, "../migration");

type MigrationDetection = {
  isSatisfied: boolean;
  reason?: string;
};

async function ensureMigrationTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrationIds(pool: Pool) {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );

  return new Set(result.rows.map((row) => row.id));
}

function getMigrationId(filename: string) {
  return filename.replace(/\.sql$/i, "");
}

async function relationExists(client: PoolClient, relationName: string, relationKind?: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = $1
          AND ($2::text IS NULL OR c.relkind = $2)
      ) AS exists
    `,
    [relationName, relationKind ?? null],
  );

  return result.rows[0]?.exists === true;
}

async function typeExists(client: PoolClient, typeName: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = $1
      ) AS exists
    `,
    [typeName],
  );

  return result.rows[0]?.exists === true;
}

async function columnsExist(client: PoolClient, tableName: string, columnNames: string[]) {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = ANY($2::text[])
    `,
    [tableName, columnNames],
  );

  const existingColumns = new Set(result.rows.map((row) => row.column_name));
  return columnNames.every((columnName) => existingColumns.has(columnName));
}

async function legacyMigrationAlreadySatisfied(client: PoolClient, migrationId: string): Promise<MigrationDetection> {
  switch (migrationId) {
    case "001_create_questionnaire_schema": {
      const requiredTypes = await Promise.all([
        typeExists(client, "survey_form_code"),
        typeExists(client, "respondent_role"),
      ]);

      const requiredTables = await Promise.all([
        relationExists(client, "respondents", "r"),
        relationExists(client, "survey_forms", "r"),
        relationExists(client, "survey_sections", "r"),
        relationExists(client, "survey_items", "r"),
        relationExists(client, "survey_responses", "r"),
        relationExists(client, "survey_answers", "r"),
      ]);

      const requiredView = await relationExists(client, "survey_response_summary", "v");

      const isSatisfied = [...requiredTypes, ...requiredTables, requiredView].every(Boolean);

      return {
        isSatisfied,
        reason: isSatisfied
          ? "required questionnaire schema objects already exist"
          : undefined,
      };
    }

    case "002_create_survey_statistics_views": {
      const requiredViews = await Promise.all([
        relationExists(client, "survey_item_statistics", "v"),
        relationExists(client, "survey_section_statistics", "v"),
        relationExists(client, "survey_form_statistics", "v"),
      ]);

      const isSatisfied = requiredViews.every(Boolean);

      return {
        isSatisfied,
        reason: isSatisfied
          ? "required survey statistics views already exist"
          : undefined,
      };
    }

    case "003_add_questionnaire_document_metadata": {
      const hasRequiredColumns = await columnsExist(client, "survey_forms", [
        "study_title",
        "document_header",
        "introduction",
        "researchers",
        "adviser",
        "voluntary_note",
        "signature_label",
      ]);
      const hasQuestionnaireView = await relationExists(client, "survey_questionnaire_forms", "v");
      const isSatisfied = hasRequiredColumns && hasQuestionnaireView;

      return {
        isSatisfied,
        reason: isSatisfied
          ? "questionnaire document metadata columns and view already exist"
          : undefined,
      };
    }

    default:
      return {
        isSatisfied: false,
      };
  }
}

async function markMigrationAsApplied(client: PoolClient, migrationId: string, filename: string) {
  await client.query(
    `
      INSERT INTO schema_migrations (id, filename)
      VALUES ($1, $2)
      ON CONFLICT (id)
      DO UPDATE SET
        filename = EXCLUDED.filename
    `,
    [migrationId, filename],
  );
}

async function runMigrations() {
  assertDatabaseConfig();

  const databaseConfig = getDatabaseConfig();
  const pool = new Pool({
    connectionString: databaseConfig.connectionString,
    ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await ensureMigrationTable(pool);

    const files = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log("No SQL migrations found.");
      return;
    }

    const appliedMigrationIds = await getAppliedMigrationIds(pool);
    let appliedCount = 0;
    let skippedCount = 0;
    let detectedCount = 0;

    for (const filename of files) {
      const migrationId = getMigrationId(filename);

      if (appliedMigrationIds.has(migrationId)) {
        skippedCount += 1;
        console.log(`Skipped already applied migration: ${filename}`);
        continue;
      }

      const migrationPath = path.join(migrationsDirectory, filename);
      const sql = await readFile(migrationPath, "utf8");
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const detection = await legacyMigrationAlreadySatisfied(client, migrationId);

        if (detection.isSatisfied) {
          await markMigrationAsApplied(client, migrationId, filename);
          await client.query("COMMIT");

          appliedMigrationIds.add(migrationId);
          detectedCount += 1;
          console.log(`Detected already migrated state: ${filename}${detection.reason ? ` (${detection.reason})` : ""}`);
          continue;
        }

        console.log(`Applying: ${filename}`);
        await client.query(sql);
        await markMigrationAsApplied(client, migrationId, filename);
        await client.query("COMMIT");

        appliedMigrationIds.add(migrationId);
        appliedCount += 1;
        console.log(`Applied: ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(
      `Migrations completed. Applied: ${appliedCount}, Detected: ${detectedCount}, Skipped: ${skippedCount}`,
    );
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
