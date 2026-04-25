import cors, { type CorsOptions } from "cors";
import express, { type Express } from "express";
import { env, isProduction } from "../lib/env.js";

const allowedOrigins = env.clientOrigins;
const allowedOriginSet = new Set(allowedOrigins);

function normalizeOrigin(origin: string) {
  const trimmedOrigin = origin.trim().replace(/\/+$/, "");

  if (!trimmedOrigin || trimmedOrigin === "*") {
    return trimmedOrigin;
  }

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    return trimmedOrigin;
  }
}

function isLocalhostOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const requestOrigin = normalizeOrigin(origin);

    if (allowedOriginSet.has("*")) {
      callback(null, true);
      return;
    }

    if (allowedOriginSet.has(requestOrigin)) {
      callback(null, requestOrigin);
      return;
    }

    if (!isProduction() && isLocalhostOrigin(requestOrigin)) {
      callback(null, requestOrigin);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

export function configureMiddleware(app: Express) {
  app.use(cors(corsOptions));
  app.use(express.json());
}
