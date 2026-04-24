import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "./env.js";

export type BucketConfig = {
  region: string;
  bucketName: string;
  prefix: string;
  hasCredentials: boolean;
};

export function getBucketConfig(): BucketConfig {
  return {
    region: env.s3.region,
    bucketName: env.s3.bucketName,
    prefix: normalizePrefix(env.s3.prefix),
    hasCredentials: Boolean(env.s3.accessKeyId && env.s3.secretAccessKey),
  };
}

export function assertBucketConfig() {
  if (!env.s3.bucketName) {
    throw new Error("S3_BUCKET_NAME is required.");
  }

  if (!env.s3.accessKeyId) {
    throw new Error("AWS_ACCESS_KEY_ID is required.");
  }

  if (!env.s3.secretAccessKey) {
    throw new Error("AWS_SECRET_ACCESS_KEY is required.");
  }
}

export function normalizePrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, "");
}

export function createObjectKey(filename: string, folder = "") {
  const safeFilename = path
    .basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  const parts = [
    normalizePrefix(env.s3.prefix),
    normalizePrefix(folder),
    `${Date.now()}-${randomUUID()}-${safeFilename}`,
  ].filter(Boolean);

  return parts.join("/");
}
