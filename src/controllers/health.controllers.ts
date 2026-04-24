import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json({
    status: "ok",
    service: "SurveyStat backend API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
