import { randomUUID } from "node:crypto";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "./env.js";

export type BucketConfig = {
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
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
    endpoint: normalizeOptionalUrl(env.s3.endpoint),
    forcePathStyle: env.s3.forcePathStyle,
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
    const endpoint = normalizeOptionalUrl(env.s3.endpoint);

    sharedS3Client = new S3Client({
      region: env.s3.region,
      endpoint: endpoint || undefined,
      forcePathStyle: env.s3.forcePathStyle,
      followRegionRedirects: true,
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

function getAwsS3VirtualHostedHost(bucketName: string, region: string) {
  return `${bucketName}.s3-${region}.amazonaws.com`;
}

function getAwsS3RegionFromEndpointHost(hostname: string) {
  const regionalEndpointMatch = hostname.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/i);
  const virtualHostedMatch = hostname.match(/^[^.]+\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/i);

  return regionalEndpointMatch?.[1] || virtualHostedMatch?.[1] || env.s3.region;
}

function isAwsS3EndpointHost(hostname: string) {
  return /(^|\.)s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(hostname) || /^s3\.amazonaws\.com$/i.test(hostname);
}

function getDefaultS3ObjectUrl(bucketName: string, region: string, encodedKey: string) {
  return `https://${getAwsS3VirtualHostedHost(bucketName, region)}/${encodedKey}`;
}

function getEndpointObjectUrl(endpoint: string, bucketName: string, encodedKey: string) {
  if (!endpoint) {
    return "";
  }

  const endpointUrl = new URL(endpoint);
  const pathname = endpointUrl.pathname.replace(/\/+$/g, "");
  const virtualHostedAwsMatch = endpointUrl.hostname.match(/^[^.]+\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/i);

  if (env.s3.forcePathStyle) {
    return `${endpointUrl.origin}${pathname}/${bucketName}/${encodedKey}`;
  }

  if (virtualHostedAwsMatch) {
    return `${endpointUrl.protocol}//${endpointUrl.host}${pathname}/${encodedKey}`;
  }

  if (isAwsS3EndpointHost(endpointUrl.hostname)) {
    const region = getAwsS3RegionFromEndpointHost(endpointUrl.hostname);

    return `${endpointUrl.protocol}//${getAwsS3VirtualHostedHost(bucketName, region)}${pathname}/${encodedKey}`;
  }

  return `${endpointUrl.protocol}//${bucketName}.${endpointUrl.host}${pathname}/${encodedKey}`;
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

  if (config.endpoint) {
    return getEndpointObjectUrl(config.endpoint, config.bucketName, encodedKey);
  }

  return getDefaultS3ObjectUrl(config.bucketName, config.region, encodedKey);
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
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
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