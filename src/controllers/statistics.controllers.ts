import type { Request, Response } from "express";

import { statisticsService } from "../services/statistics.services.js";
import type { SurveyFormCode } from "../database/model/model.js";

function toDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date;
}

function getFormCode(value: unknown) {
  return String(value) as SurveyFormCode;
}

function getStatisticsFilters(query: Request["query"]) {
  return {
    formId: query.formId ? String(query.formId) : undefined,
    formCode: query.formCode ? getFormCode(query.formCode) : undefined,
    sectionId: query.sectionId ? String(query.sectionId) : undefined,
    sectionCode: query.sectionCode ? String(query.sectionCode) : undefined,
    itemId: query.itemId ? String(query.itemId) : undefined,
    submittedFrom: toDate(query.submittedFrom),
    submittedTo: toDate(query.submittedTo),
  };
}

function sendError(res: Response, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected request error.";

  res.status(status).json({
    message,
  });
}

export async function getStatisticsSummary(req: Request, res: Response) {
  try {
    const summary = await statisticsService.getSummary(getStatisticsFilters(req.query));

    res.status(200).json({
      data: summary,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getFormStatistics(req: Request, res: Response) {
  try {
    const statistics = await statisticsService.getFormStatistics(getStatisticsFilters(req.query));

    res.status(200).json({
      data: statistics,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getSectionStatistics(req: Request, res: Response) {
  try {
    const statistics = await statisticsService.getSectionStatistics(getStatisticsFilters(req.query));

    res.status(200).json({
      data: statistics,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getItemStatistics(req: Request, res: Response) {
  try {
    const statistics = await statisticsService.getItemStatistics(getStatisticsFilters(req.query));

    res.status(200).json({
      data: statistics,
    });
  } catch (error) {
    sendError(res, error);
  }
}
