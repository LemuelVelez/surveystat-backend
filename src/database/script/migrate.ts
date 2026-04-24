import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { assertDatabaseConfig, getDatabaseConfig } from "../../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, "../migration");

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

    for (const filename of files) {
      const migrationId = getMigrationId(filename);

      if (appliedMigrationIds.has(migrationId)) {
        console.log(`Skipped: ${filename}`);
        continue;
      }

      const migrationPath = path.join(migrationsDirectory, filename);
      const sql = await readFile(migrationPath, "utf8");
      const client = await pool.connect();

      try {
        console.log(`Applying: ${filename}`);
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (id, filename) VALUES ($1, $2)",
          [migrationId, filename],
        );
        await client.query("COMMIT");
        appliedCount += 1;
        console.log(`Applied: ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(`Migrations completed. Applied: ${appliedCount}, Skipped: ${files.length - appliedCount}`);
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
