import dotenv from "dotenv";

dotenv.config();

function readEnv(key: string, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

function readBooleanEnv(key: string, fallback = false) {
  const value = readEnv(key).toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value);
}

function readNumberEnv(key: string, fallback: number) {
  const value = Number(readEnv(key));

  if (Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

export const env = {
  nodeEnv: readEnv("NODE_ENV", "development"),
  port: readNumberEnv("PORT", 8080),
  clientOrigin: readEnv("CLIENT_ORIGIN"),
  serverPublicUrl: readEnv("SERVER_PUBLIC_URL"),

  database: {
    url: readEnv("PostgreSQL_DATABASE_URL"),
    ssl: readBooleanEnv("DATABASE_SSL", false),
  },

  auth: {
    jwtSecret: readEnv("JWT_SECRET"),
  },

  gmail: {
    user: readEnv("GMAIL_USER"),
    appPassword: readEnv("GMAIL_APP_PASSWORD"),
  },

  s3: {
    region: readEnv("AWS_REGION", "ap-southeast-1"),
    endpoint: readEnv("S3_ENDPOINT") || readEnv("AWS_ENDPOINT_URL_S3") || readEnv("AWS_S3_ENDPOINT"),
    forcePathStyle: readBooleanEnv("S3_FORCE_PATH_STYLE", false),
    bucketName: readEnv("S3_BUCKET_NAME"),
    accessKeyId: readEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: readEnv("AWS_SECRET_ACCESS_KEY"),
    prefix: readEnv("S3_PREFIX", "uploads"),
    publicBaseUrl: readEnv("S3_PUBLIC_BASE_URL"),
  },
};

export function isProduction() {
  return env.nodeEnv === "production";
}

export function getServerAppUrl() {
  if (env.serverPublicUrl) {
    return env.serverPublicUrl;
  }

  return `http://localhost:${env.port}`;
}