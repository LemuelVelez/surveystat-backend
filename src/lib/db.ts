import { env } from "./env.js";

export type DatabaseConfig = {
  connectionString: string;
  ssl: boolean;
};

export function getDatabaseConfig(): DatabaseConfig {
  return {
    connectionString: env.database.url,
    ssl: env.database.ssl,
  };
}

export function assertDatabaseConfig() {
  if (!env.database.url) {
    throw new Error("PostgreSQL_DATABASE_URL is required.");
  }
}
