import type { Request, Response } from "express";

import {
  surveyService,
  type CreateRespondentInput,
  type CreateSurveyFormInput,
  type CreateSurveyItemInput,
  type CreateSurveySeriesInput,
  type CreateSurveySectionInput,
  type SubmitSurveyResponseInput,
  type UpdateSurveyFormRespondentInformationInput,
} from "../services/survey.services.js";
import type { LikertScaleOption, LikertValue, RespondentRole, SurveyFormCode } from "../database/model/model.js";

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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function getLikertScale(value: unknown): CreateSurveyFormInput["scale"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const scale: LikertScaleOption[] = [];

  for (const option of value) {
    const optionBody = option as Record<string, unknown>;
    const rating = Number(optionBody.value);

    if (![1, 2, 3, 4, 5].includes(rating)) {
      continue;
    }

    const label = toOptionalString(optionBody.label) ?? `Rating ${rating}`;
    const scaleOption: LikertScaleOption = {
      value: rating as LikertValue,
      label,
    };
    const description = toNullableString(optionBody.description);
    const meanRange = toOptionalString(optionBody.meanRange);
    const minMean = toNumber(optionBody.minMean);
    const maxMean = toNumber(optionBody.maxMean);

    if (description !== null) {
      scaleOption.description = description;
    }

    if (meanRange) {
      scaleOption.meanRange = meanRange;
    }

    if (minMean !== undefined) {
      scaleOption.minMean = minMean;
    }

    if (maxMean !== undefined) {
      scaleOption.maxMean = maxMean;
    }

    scale.push(scaleOption);
  }

  return scale.length > 0 ? scale : undefined;
}

function getSurveyItems(value: unknown): CreateSurveyItemInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const itemBody = item as Record<string, unknown>;

    return {
      code: toNullableString(itemBody.code),
      statement: String(itemBody.statement ?? ""),
      sortOrder: toNumber(itemBody.sortOrder) ?? index + 1,
      isRequired: toBoolean(itemBody.isRequired, true),
    };
  });
}

function getSurveySections(value: unknown): CreateSurveySectionInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((section, index) => {
    const sectionBody = section as Record<string, unknown>;

    return {
      code: toNullableString(sectionBody.code),
      title: String(sectionBody.title ?? ""),
      sortOrder: toNumber(sectionBody.sortOrder) ?? index + 1,
      items: getSurveyItems(sectionBody.items),
    };
  });
}

function getCreateSurveyFormInput(body: Record<string, unknown>): CreateSurveyFormInput {
  return {
    code: getFormCode(toOptionalString(body.code) ?? ""),
    surveySeriesId: toNullableString(body.surveySeriesId),
    surveyStepNumber: toNumber(body.surveyStepNumber),
    surveySeriesTitle: toNullableString(body.surveySeriesTitle),
    title: String(body.title ?? ""),
    description: toNullableString(body.description),
    studyTitle: toNullableString(body.studyTitle),
    documentHeader: body.documentHeader && typeof body.documentHeader === "object" ? (body.documentHeader as Record<string, unknown>) : {},
    introduction: toNullableString(body.introduction),
    researchers: toStringArray(body.researchers),
    adviser: toNullableString(body.adviser),
    instruction: toNullableString(body.instruction),
    scale: getLikertScale(body.scale),
    voluntaryNote: toNullableString(body.voluntaryNote),
    signatureLabel: toNullableString(body.signatureLabel),
    respondentInformationRequired: toBoolean(body.respondentInformationRequired, true),
    isActive: toBoolean(body.isActive, true),
    sections: getSurveySections(body.sections),
  };
}


function getCreateSurveySeriesInput(body: Record<string, unknown>): CreateSurveySeriesInput {
  const forms = Array.isArray(body.forms) ? body.forms : [];

  return {
    surveySeriesId: toNullableString(body.surveySeriesId),
    surveySeriesTitle: String(body.surveySeriesTitle ?? body.title ?? ""),
    forms: forms.map((form) => getCreateSurveyFormInput(form as Record<string, unknown>)),
  };
}


function getUpdateSurveyFormRespondentInformationInput(
  body: Record<string, unknown>,
): UpdateSurveyFormRespondentInformationInput {
  return {
    respondentInformationRequired: toBoolean(body.respondentInformationRequired, false),
  };
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
    respondentSignatureImage: toNullableString(body.respondentSignatureImage),
    respondentSignatureFileName: toNullableString(body.respondentSignatureFileName),
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

export async function createSurveyForm(req: Request, res: Response) {
  try {
    const form = await surveyService.createSurveyForm(getCreateSurveyFormInput(req.body ?? {}));

    res.status(201).json({
      message: "Survey form created successfully.",
      data: form,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function createSurveySeries(req: Request, res: Response) {
  try {
    const forms = await surveyService.createSurveySeries(getCreateSurveySeriesInput(req.body ?? {}));

    res.status(201).json({
      message: "Survey series created successfully.",
      data: forms,
    });
  } catch (error) {
    sendError(res, error);
  }
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


export async function updateSurveyFormRespondentInformation(req: Request, res: Response) {
  try {
    const formId = getRouteParam(req.params.formId, "formId");
    const form = await surveyService.updateSurveyFormRespondentInformation(
      formId,
      getUpdateSurveyFormRespondentInformationInput(req.body ?? {}),
    );

    if (!form) {
      res.status(404).json({
        message: "Survey form not found.",
      });
      return;
    }

    res.status(200).json({
      message: "Survey respondent information setting updated successfully.",
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

export async function resendSurveyResponseReviewEmail(req: Request, res: Response) {
  try {
    const responseId = getRouteParam(req.params.responseId, "responseId");
    const result = await surveyService.resendSurveyResponseReviewEmail(responseId);

    res.status(200).json({
      message: "Survey response review email resent successfully.",
      data: result,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}

export async function deleteSurveyResponse(req: Request, res: Response) {
  try {
    const responseId = getRouteParam(req.params.responseId, "responseId");
    const response = await surveyService.deleteSurveyResponse(responseId);

    if (!response) {
      res.status(404).json({
        message: "Survey response not found.",
      });
      return;
    }

    res.status(200).json({
      message: "Survey response deleted successfully.",
      data: response,
    });
  } catch (error) {
    sendError(res, error, 500);
  }
}
