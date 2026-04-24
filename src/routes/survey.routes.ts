import { Router } from "express";

import {
  createRespondent,
  createSurveyForm,
  deleteSurveyResponse,
  createSurveySeries,
  getQuestionnaireByFormCode,
  getQuestionnaireByFormId,
  getRespondentById,
  getResponseAnswers,
  getSurveyFormByCode,
  getSurveyFormById,
  listSurveyForms,
  listSurveyResponses,
  resendSurveyResponseReviewEmail,
  submitSurveyResponse,
  updateSurveyFormRespondentInformation,
} from "../controllers/survey.controllers.js";

const router = Router();

router.get("/forms", listSurveyForms);
router.post("/forms", createSurveyForm);
router.post("/series", createSurveySeries);
router.patch("/forms/:formId/respondent-information", updateSurveyFormRespondentInformation);
router.get("/forms/code/:formCode", getSurveyFormByCode);
router.get("/forms/:formId", getSurveyFormById);

router.get("/questionnaires/code/:formCode", getQuestionnaireByFormCode);
router.get("/questionnaires/:formId", getQuestionnaireByFormId);

router.post("/respondents", createRespondent);
router.get("/respondents/:respondentId", getRespondentById);

router.post("/responses", submitSurveyResponse);
router.get("/responses", listSurveyResponses);
router.get("/responses/:responseId/answers", getResponseAnswers);
router.post("/responses/:responseId/resend-review", resendSurveyResponseReviewEmail);
router.delete("/responses/:responseId", deleteSurveyResponse);

export default router;