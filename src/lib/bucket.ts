import { randomUUID } from "node:crypto";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "./env.js";

export type BucketConfig = {
  region: string;
  bucketName: string;
  prefix: string;
  publicBaseUrl: string;
  hasCredentials: boolean;
};

export type UploadedBucketObject = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

let sharedS3Client: S3Client | null = null;

export function getBucketConfig(): BucketConfig {
  return {
    region: env.s3.region,
    bucketName: env.s3.bucketName,
    prefix: normalizePrefix(env.s3.prefix),
    publicBaseUrl: normalizeOptionalUrl(env.s3.publicBaseUrl),
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

function normalizeOptionalUrl(url?: string) {
  return url?.trim().replace(/\/+$/g, "") ?? "";
}

function getS3Client() {
  assertBucketConfig();

  if (!sharedS3Client) {
    sharedS3Client = new S3Client({
      region: env.s3.region,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
  }

  return sharedS3Client;
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

function getPublicObjectUrl(key: string) {
  const config = getBucketConfig();
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodedKey}`;
  }

  return `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${encodedKey}`;
}

function getBase64UploadParts(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid signature image data. Expected a base64 data URL.");
  }

  const [, contentType, base64Body] = match;
  const buffer = Buffer.from(base64Body, "base64");

  if (buffer.length === 0) {
    throw new Error("Signature image is empty.");
  }

  return {
    contentType,
    buffer,
  };
}

export async function uploadBase64Object(params: {
  dataUrl: string;
  filename?: string | null;
  folder?: string;
}): Promise<UploadedBucketObject> {
  const { contentType, buffer } = getBase64UploadParts(params.dataUrl);
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] || "png";
  const filename = params.filename?.trim() || `signature.${extension}`;
  const key = createObjectKey(filename, params.folder);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.s3.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        source: "surveystat-signature",
      },
    }),
  );

  return {
    key,
    url: getPublicObjectUrl(key),
    contentType,
    size: buffer.length,
  };
}