import type { Request, Response } from "express";

import { surveyService, type CreateRespondentInput, type SubmitSurveyResponseInput } from "../services/survey.services.js";
import type { LikertValue, RespondentRole, SurveyFormCode } from "../database/model/model.js";

function toBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
}

function toNullableString(value: unknown) {
  return toOptionalString(value) ?? null;
}

function getRouteParam(value: string | string[] | undefined, name: string) {
  const routeParam = Array.isArray(value) ? value[0] : value;
  const trimmed = routeParam?.trim();

  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}

function sendError(res: Response, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected request error.";

  res.status(status).json({
    message,
  });
}

function getFormCode(value: unknown) {
  return String(value) as SurveyFormCode;
}

function getRespondentInput(body: Record<string, unknown>): CreateRespondentInput {
  return {
    fullName: toNullableString(body.fullName),
    email: toNullableString(body.email),
    role: body.role ? (String(body.role) as RespondentRole) : null,
    office: toNullableString(body.office),
    program: toNullableString(body.program),
    consentGiven: toBoolean(body.consentGiven, true),
  };
}

function getSubmitSurveyResponseInput(body: Record<string, unknown>): SubmitSurveyResponseInput {
  const answers = Array.isArray(body.answers) ? body.answers : [];

  return {
    formId: toOptionalString(body.formId),
    formCode: body.formCode ? getFormCode(body.formCode) : undefined,
    respondentId: toNullableString(body.respondentId),
    respondent: body.respondent && typeof body.respondent === "object" ? getRespondentInput(body.respondent as Record<string, unknown>) : null,
    respondentSignature: toNullableString(body.respondentSignature),
    voluntaryConsent: toBoolean(body.voluntaryConsent, false),
    answers: answers.map((answer) => {
      const answerBody = answer as Record<string, unknown>;

      return {
        itemId: String(answerBody.itemId ?? ""),
        rating: Number(answerBody.rating) as LikertValue,
      };
    }),
  };
}

export async function listSurveyForms(req: Request, res: Response) {
  try {
    const forms = await surveyService.listSurveyForms({
      activeOnly: toBoolean(req.query.activeOnly, true),
    });

    res.status(200).json({
      data: forms,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function getSurveyFormById(req: Request, res: Response) {
  try {
    const formId = getRouteParam(req.params.formId, "formId");
    const form = await surveyService.getSurveyFormById(formId);

    if (!form) {
      res.status(404).json({
        message: "Survey form not found.",
      });
      return;
    }

    res.status(200).json({
      data: form,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function getSurveyFormByCode(req: Request, res: Response) {
  try {
    const formCode = getFormCode(getRouteParam(req.params.formCode, "formCode"));
    const form = await surveyService.getSurveyFormByCode(formCode);

    if (!form) {
      res.status(404).json({
        message: "Survey form not found.",
      });
      return;
    }

    res.status(200).json({
      data: form,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function getQuestionnaireByFormId(req: Request, res: Response) {
  try {
    const formId = getRouteParam(req.params.formId, "formId");
    const questionnaire = await surveyService.getQuestionnaireByFormId(formId);

    if (!questionnaire) {
      res.status(404).json({
        message: "Survey questionnaire not found.",
      });
      return;
    }

    res.status(200).json({
      data: questionnaire,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function getQuestionnaireByFormCode(req: Request, res: Response) {
  try {
    const formCode = getFormCode(getRouteParam(req.params.formCode, "formCode"));
    const questionnaire = await surveyService.getQuestionnaireByFormCode(formCode);

    if (!questionnaire) {
      res.status(404).json({
        message: "Survey questionnaire not found.",
      });
      return;
    }

    res.status(200).json({
      data: questionnaire,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function createRespondent(req: Request, res: Response) {
  try {
    const respondent = await surveyService.createRespondent(getRespondentInput(req.body ?? {}));

    res.status(201).json({
      message: "Respondent created successfully.",
      data: respondent,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getRespondentById(req: Request, res: Response) {
  try {
    const respondentId = getRouteParam(req.params.respondentId, "respondentId");
    const respondent = await surveyService.getRespondentById(respondentId);

    if (!respondent) {
      res.status(404).json({
        message: "Respondent not found.",
      });
      return;
    }

    res.status(200).json({
      data: respondent,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function submitSurveyResponse(req: Request, res: Response) {
  try {
    const response = await surveyService.submitSurveyResponse(getSubmitSurveyResponseInput(req.body ?? {}));

    res.status(201).json({
      message: "Survey response submitted successfully.",
      data: response,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function listSurveyResponses(req: Request, res: Response) {
  try {
    const responses = await surveyService.listSurveyResponses({
      formId: req.query.formId ? String(req.query.formId) : undefined,
      formCode: req.query.formCode ? getFormCode(req.query.formCode) : undefined,
      respondentId: req.query.respondentId ? String(req.query.respondentId) : undefined,
      submittedOnly: toBoolean(req.query.submittedOnly, true),
      limit: toNumber(req.query.limit),
      offset: toNumber(req.query.offset),
    });

    res.status(200).json({
      data: responses,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function getResponseAnswers(req: Request, res: Response) {
  try {
    const responseId = getRouteParam(req.params.responseId, "responseId");
    const answers = await surveyService.getResponseAnswers(responseId);

    res.status(200).json({
      data: answers,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}