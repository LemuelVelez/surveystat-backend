export const TABLES = {
  respondents: "respondents",
  surveyForms: "survey_forms",
  surveySections: "survey_sections",
  surveyItems: "survey_items",
  surveyResponses: "survey_responses",
  surveyAnswers: "survey_answers",
} as const;

export const LIKERT_SCALE = [
  {
    value: 5,
    label: "Strongly Agree",
    meanRange: "4.21 - 5.00",
    minMean: 4.21,
    maxMean: 5,
  },
  {
    value: 4,
    label: "Agree",
    meanRange: "3.41 - 4.20",
    minMean: 3.41,
    maxMean: 4.2,
  },
  {
    value: 3,
    label: "Neutral",
    meanRange: "2.61 - 3.40",
    minMean: 2.61,
    maxMean: 3.4,
  },
  {
    value: 2,
    label: "Disagree",
    meanRange: "1.81 - 2.60",
    minMean: 1.81,
    maxMean: 2.6,
  },
  {
    value: 1,
    label: "Strongly Disagree",
    meanRange: "1.00 - 1.80",
    minMean: 1,
    maxMean: 1.8,
  },
] as const;

export const QUESTIONNAIRE_TITLE =
  "Development of a Digital Repository System for AACCUP Accreditation Documents in Jose Rizal Memorial State University-Tampilisan Campus (JRMSU-TC)";


export const QUESTIONNAIRE_DOCUMENT_HEADER = {
  documentCode: "JRMSU-CCS-TC-044",
  country: "Republic of the Philippines",
  university: "JOSE RIZAL MEMORIAL STATE UNIVERSITY",
  tagline: "The Premier University in Zamboanga del Norte",
  college: "COLLEGE OF COMPUTING STUDIES",
  contactNumber: "0917-630-6056",
  email: "ccs.tampilisan@jrmsu.edu.ph",
  address: "ZNAC, Tampilisan, Zamboanga del Norte",
} as const;

export const QUESTIONNAIRE_INTRODUCTION = [
  "Good day!",
  "We, the researchers, are currently conducting a study entitled “Development of a Digital Repository System for AACCUP Accreditation Documents in Jose Rizal Memorial State University-Tampilisan Campus (JRMSU-TC)”",
  "The purpose of these checklist questionnaires is to evaluate the existing processes employed by QA personnel and to assess the quality of the Digital Repository System using Garvin’s Eight Dimensions of Quality as the evaluation framework. The data gathered will be used to examine current practices, system functionality, and usability, and to identify opportunities for further improvement.",
  "All information provided will be kept strictly confidential and will be used solely for academic and research purposes. Your sincere and honest responses are highly valued and will contribute greatly to the success of this study.",
  "Thank you very much for your time and cooperation.",
].join("\n\n");

export const QUESTIONNAIRE_RESEARCHERS = [
  "MILYN N. BUCA",
  "JHONLY P. SALAC",
  "WHOWARD JHON V. TOME",
  "LEMUEL T. VELEZ",
] as const;

export const QUESTIONNAIRE_ADVISER = "ERSON A. RODRIGUEZ, LPT, MSIT";

export const EXISTING_PROCESS_VOLUNTARY_NOTE =
  "Participation in this survey is completely voluntary. I have chosen to answer this questionnaire willingly, and no one has forced or coerced me to participate.";

export const SYSTEM_EVALUATION_VOLUNTARY_NOTE =
  "Participation in this survey is completely voluntary. I am willingly chosen to answer this questionnaire, and no one has been forced or coerced to obtain my participation.";

export const RESPONDENT_SIGNATURE_LABEL = "Respondent's Signature";

export const VOLUNTARY_PARTICIPATION_NOTE = EXISTING_PROCESS_VOLUNTARY_NOTE;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
export type LikertValue = 1 | 2 | 3 | 4 | 5;
export type SurveyFormCode = string;
export type LikertScaleOption = {
  value: LikertValue;
  label: string;
  description?: string | null;
  meanRange?: string;
  minMean?: number;
  maxMean?: number;
};
export type LikertScale = readonly LikertScaleOption[];
export type RespondentRole = "qa_personnel" | "system_user" | "validator" | "accreditor" | "researcher" | "other";

export type Respondent = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: RespondentRole | null;
  office?: string | null;
  program?: string | null;
  consentGiven: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SurveyForm = {
  id: string;
  code: SurveyFormCode;
  surveySeriesId?: string | null;
  surveyStepNumber: number;
  surveySeriesTitle?: string | null;
  title: string;
  description: string;
  studyTitle?: string | null;
  documentHeader?: typeof QUESTIONNAIRE_DOCUMENT_HEADER | Record<string, unknown> | null;
  introduction?: string | null;
  researchers?: string[] | null;
  adviser?: string | null;
  instruction: string;
  scale: LikertScale;
  voluntaryNote?: string | null;
  signatureLabel?: string | null;
  respondentInformationRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SurveySection = {
  id: string;
  formId: string;
  code: string;
  title: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SurveyItem = {
  id: string;
  sectionId: string;
  code: string;
  statement: string;
  sortOrder: number;
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SurveyResponse = {
  id: string;
  formId: string;
  respondentId?: string | null;
  respondentSignature?: string | null;
  voluntaryConsent: boolean;
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SurveyAnswer = {
  id: string;
  responseId: string;
  itemId: string;
  rating: LikertValue;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionnaireItemSeed = {
  code: string;
  statement: string;
  sortOrder: number;
  isRequired?: boolean;
};

export type QuestionnaireSectionSeed = {
  code: string;
  title: string;
  sortOrder: number;
  items: QuestionnaireItemSeed[];
};

export type QuestionnaireFormSeed = {
  code: SurveyFormCode;
  surveySeriesId?: string | null;
  surveyStepNumber?: number;
  surveySeriesTitle?: string | null;
  title: string;
  description: string;
  studyTitle: string;
  documentHeader: typeof QUESTIONNAIRE_DOCUMENT_HEADER;
  introduction: string;
  researchers: readonly string[];
  adviser: string;
  instruction: string;
  voluntaryNote: string;
  signatureLabel: string;
  respondentInformationRequired: boolean;
  sections: QuestionnaireSectionSeed[];
};

export const QUESTIONNAIRE_FORMS: QuestionnaireFormSeed[] = [
  {
    code: "existing_process_assessment",
    title: "Existing Process Assessment Checklist",
    description:
      "Assessment of existing processes employed by QA Personnel during AACCUP accreditation at JRMSU-TC in terms of collection, organization, submission, and validation of accreditation evidence.",
    studyTitle: QUESTIONNAIRE_TITLE,
    documentHeader: QUESTIONNAIRE_DOCUMENT_HEADER,
    introduction: QUESTIONNAIRE_INTRODUCTION,
    researchers: QUESTIONNAIRE_RESEARCHERS,
    adviser: QUESTIONNAIRE_ADVISER,
    voluntaryNote: EXISTING_PROCESS_VOLUNTARY_NOTE,
    signatureLabel: RESPONDENT_SIGNATURE_LABEL,
    respondentInformationRequired: true,
    instruction:
      "Please examine the existing processes employed by QA Personnel during AACCUP accreditation at JRMSU-TC in terms of the collection, organization, submission, and validation of accreditation evidence. Carefully read each statement and place a check mark (✓) under the number that best describes your assessment of the current practices. Please provide honest and objective responses based on actual institutional procedures and experiences.",
    sections: [
      {
        code: "collection_of_documents",
        title: "Collection of Documents",
        sortOrder: 1,
        items: [
          {
            code: "existing_collection_01",
            statement: "I collect available documents from different offices manually.",
            sortOrder: 1,
          },
          {
            code: "existing_collection_02",
            statement: "I observe a lack of standardized document formatting, which leads to duplication.",
            sortOrder: 2,
          },
          {
            code: "existing_collection_03",
            statement: "I find the collection of documents time-consuming.",
            sortOrder: 3,
          },
          {
            code: "existing_collection_04",
            statement:
              "I observe that documents often do not match the required templates and are arranged in an unorganized manner.",
            sortOrder: 4,
          },
          {
            code: "existing_collection_05",
            statement: "I experience delays in retrieving available documents.",
            sortOrder: 5,
          },
          {
            code: "existing_collection_06",
            statement: "I find physical documents too heavy or bulky after the accreditation process.",
            sortOrder: 6,
          },
          {
            code: "existing_collection_07",
            statement: "I observe that physical documents are susceptible to loss or damage.",
            sortOrder: 7,
          },
          {
            code: "existing_collection_08",
            statement: "I experience a lack of digital access and control over collected documents.",
            sortOrder: 8,
          },
        ],
      },
      {
        code: "organization_of_documents",
        title: "Organization of Documents",
        sortOrder: 2,
        items: [
          {
            code: "existing_organization_01",
            statement: "I observe that the manual filing system often results in disorganized documents.",
            sortOrder: 1,
          },
          {
            code: "existing_organization_02",
            statement: "I experience the absence of a centralized digital management system for documents.",
            sortOrder: 2,
          },
          {
            code: "existing_organization_03",
            statement: "I observe a lack of standardized templates for organizing documents.",
            sortOrder: 3,
          },
          {
            code: "existing_organization_04",
            statement: "I find the volume of required paperwork excessive.",
            sortOrder: 4,
          },
          {
            code: "existing_organization_05",
            statement:
              "I observe that Google Drive or shared links sometimes result in documents not being viewed by accreditors.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "submission_of_documents",
        title: "Submission of Documents",
        sortOrder: 3,
        items: [
          {
            code: "existing_submission_01",
            statement: "I find the submission of physical documents too heavy and burdensome.",
            sortOrder: 1,
          },
          {
            code: "existing_submission_02",
            statement: "I observe that submitted documents often contain incomplete or missing data.",
            sortOrder: 2,
          },
          {
            code: "existing_submission_03",
            statement: "I experience rushed submission due to the lack of a digital system.",
            sortOrder: 3,
          },
          {
            code: "existing_submission_04",
            statement:
              "I observe that the local task force experiences additional burden because of an unsystematic submission process.",
            sortOrder: 4,
          },
          {
            code: "existing_submission_05",
            statement: "I observe that the local task force lacks sufficient knowledge in Google Form submission.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "validation_of_documents",
        title: "Validation of Documents",
        sortOrder: 4,
        items: [
          {
            code: "existing_validation_01",
            statement: "I observe a high possibility of human error in the validation process.",
            sortOrder: 1,
          },
          {
            code: "existing_validation_02",
            statement: "I find validation too bulky or burdensome for validators or accreditors.",
            sortOrder: 2,
          },
          {
            code: "existing_validation_03",
            statement: "I observe that documents being validated are often unclear or difficult to review.",
            sortOrder: 3,
          },
          {
            code: "existing_validation_04",
            statement: "I observe that documents are often missing, or the links provided are unresponsive.",
            sortOrder: 4,
          },
          {
            code: "existing_validation_05",
            statement: "I observe that comments from accreditors are not properly addressed.",
            sortOrder: 5,
          },
        ],
      },
    ],
  },
  {
    code: "system_evaluation",
    title: "System Evaluation Checklist",
    description:
      "Evaluation of the developed Digital Repository System for AACCUP accreditation based on Dr. Garvin's Eight Dimensions of Quality Framework.",
    studyTitle: QUESTIONNAIRE_TITLE,
    documentHeader: QUESTIONNAIRE_DOCUMENT_HEADER,
    introduction: QUESTIONNAIRE_INTRODUCTION,
    researchers: QUESTIONNAIRE_RESEARCHERS,
    adviser: QUESTIONNAIRE_ADVISER,
    voluntaryNote: SYSTEM_EVALUATION_VOLUNTARY_NOTE,
    signatureLabel: RESPONDENT_SIGNATURE_LABEL,
    respondentInformationRequired: true,
    instruction:
      "Please evaluate the developed Digital Repository System for AACCUP accreditation based on Dr. Garvin's Eight Dimensions of Quality Framework, namely: performance, features, reliability, conformance, durability, serviceability, aesthetics, and perceived quality. Carefully read and assess each indicator, then place a check mark (✓) under the appropriate number that best reflects your evaluation of the system. Your responses should be based on your personal experience, observation, and actual use of the system.",
    sections: [
      {
        code: "performance",
        title: "Performance",
        sortOrder: 1,
        items: [
          {
            code: "system_performance_01",
            statement: "I can get search results quickly for common queries such as program, area, and parameter.",
            sortOrder: 1,
          },
          {
            code: "system_performance_02",
            statement:
              "I can upload evidence such as PDFs, videos, and images reliably without having to start from zero, because the upload resumes where it left off.",
            sortOrder: 2,
          },
          {
            code: "system_performance_03",
            statement: "I can efficiently narrow results by filtering through program, area, and parameter.",
            sortOrder: 3,
          },
          {
            code: "system_performance_04",
            statement: "I can use the system smoothly even during peak periods such as near survey visits.",
            sortOrder: 4,
          },
          {
            code: "system_performance_05",
            statement: "I am satisfied with the system's speed and responsiveness.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "features",
        title: "Features",
        sortOrder: 2,
        items: [
          {
            code: "system_features_01",
            statement: "I find that the area-to-parameter mapping fits AACCUP's structure.",
            sortOrder: 1,
          },
          {
            code: "system_features_02",
            statement:
              "I find that the role-based workflow of submit, review, comments, and notes support our actual process.",
            sortOrder: 2,
          },
          {
            code: "system_features_03",
            statement: "I can clearly see who made changes, what was changed, and when it was changed through the audit trail.",
            sortOrder: 3,
          },
          {
            code: "system_features_04",
            statement:
              "I find the reports and dashboards useful for preparation, especially for readiness, gaps, and metadata quality.",
            sortOrder: 4,
          },
          {
            code: "system_features_05",
            statement: "I find that the system's features are focused and free from unnecessary redundancy.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "reliability",
        title: "Reliability",
        sortOrder: 3,
        items: [
          {
            code: "system_reliability_01",
            statement: "I find that the system functions as expected with minimal errors.",
            sortOrder: 1,
          },
          {
            code: "system_reliability_02",
            statement: "I rarely experience failed uploads or corrupted files.",
            sortOrder: 2,
          },
          {
            code: "system_reliability_03",
            statement: "I experience consistent and accurate synchronization between web and mobile devices.",
            sortOrder: 3,
          },
          {
            code: "system_reliability_04",
            statement: "I rarely encounter crashes, timeouts, or unexplained errors while using the system.",
            sortOrder: 4,
          },
          {
            code: "system_reliability_05",
            statement: "I am confident in the system's reliability for daily use.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "conformance",
        title: "Conformance",
        sortOrder: 4,
        items: [
          {
            code: "system_conformance_01",
            statement: "I find that the metadata rules properly enforce correct program, area, and parameter tagging.",
            sortOrder: 1,
          },
          {
            code: "system_conformance_02",
            statement:
              "I find that the system aligns with R.A. 10173 or the Data Privacy Act through least privilege, consent or notice, and access logs.",
            sortOrder: 2,
          },
          {
            code: "system_conformance_03",
            statement:
              "I find that the records lifecycle follows R.A. 9470 through proper retention, disposition, and provenance.",
            sortOrder: 3,
          },
          {
            code: "system_conformance_04",
            statement: "I find that the system consistently adheres to required standards and policies.",
            sortOrder: 4,
          },
          {
            code: "system_conformance_05",
            statement: "I believe that the repository conforms to AACCUP and institutional policies.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "durability",
        title: "Durability",
        sortOrder: 5,
        items: [
          {
            code: "system_durability_01",
            statement: "I find that the system remains stable under heavy loads involving many users and files.",
            sortOrder: 1,
          },
          {
            code: "system_durability_02",
            statement: "I trust that backups and restore procedures protect the long-term integrity of evidence.",
            sortOrder: 2,
          },
          {
            code: "system_durability_03",
            statement: "I can continue to access evidence over time without any issues.",
            sortOrder: 3,
          },
          {
            code: "system_durability_04",
            statement: "I find that updates and fixes do not disrupt existing workflows.",
            sortOrder: 4,
          },
          {
            code: "system_durability_05",
            statement: "I can continue using the system without needing reinstallation or system wipes.",
            sortOrder: 5,
          },
        ],
      },
      {
        code: "serviceability",
        title: "Serviceability",
        sortOrder: 6,
        items: [
          {
            code: "system_serviceability_01",
            statement: "I can easily find and follow the help guides and training materials.",
            sortOrder: 1,
          },
          {
            code: "system_serviceability_02",
            statement: "I find that error messages are clear and helpful in resolving issues.",
            sortOrder: 2,
          },
          {
            code: "system_serviceability_03",
            statement: "I find that support requests are handled promptly and effectively.",
            sortOrder: 3,
          },
          {
            code: "system_serviceability_04",
            statement: "I receive fixes or assistance within a reasonable timeframe after reporting a problem.",
            sortOrder: 4,
          },
          {
            code: "system_serviceability_05",
            statement: "I find that updates for web and mobile arrive automatically without disruption.",
            sortOrder: 5,
          },
          {
            code: "system_serviceability_06",
            statement: "I would use the support or service channels again in the future.",
            sortOrder: 6,
          },
        ],
      },
      {
        code: "aesthetics",
        title: "Aesthetics",
        sortOrder: 7,
        items: [
          {
            code: "system_aesthetics_01",
            statement: "I find the interface visually clear and uncluttered.",
            sortOrder: 1,
          },
          {
            code: "system_aesthetics_02",
            statement: "I find that the labels and icons are consistent and easy to understand.",
            sortOrder: 2,
          },
          {
            code: "system_aesthetics_03",
            statement: "I find that the page layouts make tasks such as upload and review straightforward.",
            sortOrder: 3,
          },
          {
            code: "system_aesthetics_04",
            statement: "I find that the color, contrast, and readability support long work sessions.",
            sortOrder: 4,
          },
          {
            code: "system_aesthetics_05",
            statement: "I find that the visual design helps me stay focused and does not distract from the work.",
            sortOrder: 5,
          },
          {
            code: "system_aesthetics_06",
            statement: "I find that the overall design is professional and appropriate for accreditation.",
            sortOrder: 6,
          },
        ],
      },
      {
        code: "perceived_quality",
        title: "Perceived Quality",
        sortOrder: 8,
        items: [
          {
            code: "system_perceived_quality_01",
            statement: "I trust this system to support AACCUP accreditation activities.",
            sortOrder: 1,
          },
          {
            code: "system_perceived_quality_02",
            statement:
              "I find this system to be a clear improvement over past practices such as email, flash drives, and ad hoc folders.",
            sortOrder: 2,
          },
          {
            code: "system_perceived_quality_03",
            statement: "I would recommend this repository to colleagues involved in accreditation.",
            sortOrder: 3,
          },
          {
            code: "system_perceived_quality_04",
            statement: "I find that the system's overall quality meets or exceeds my expectations.",
            sortOrder: 4,
          },
          {
            code: "system_perceived_quality_05",
            statement: "I am confident relying on this system during actual survey visits.",
            sortOrder: 5,
          },
        ],
      },
    ],
  },

  {
    code: "respondent_system_experience",
    title: "System Respondent Experience Checklist",
    description:
      "Evaluation of the respondent experience while answering surveys and using the Digital Repository System survey workflow.",
    studyTitle: QUESTIONNAIRE_TITLE,
    documentHeader: QUESTIONNAIRE_DOCUMENT_HEADER,
    introduction: QUESTIONNAIRE_INTRODUCTION,
    researchers: QUESTIONNAIRE_RESEARCHERS,
    adviser: QUESTIONNAIRE_ADVISER,
    voluntaryNote: EXISTING_PROCESS_VOLUNTARY_NOTE,
    signatureLabel: RESPONDENT_SIGNATURE_LABEL,
    respondentInformationRequired: false,
    instruction:
      "Please evaluate your experience as a respondent of the Digital Repository System survey workflow. Carefully read each statement and place a check mark (✓) under the appropriate number that best reflects your experience.",
    sections: [
      {
        code: "respondent_accessibility",
        title: "Accessibility and Ease of Use",
        sortOrder: 1,
        items: [
          {
            code: "respondent_accessibility_01",
            statement: "I can access the survey page without difficulty using the provided link.",
            sortOrder: 1,
          },
          {
            code: "respondent_accessibility_02",
            statement: "I can understand the survey instructions before answering the checklist.",
            sortOrder: 2,
          },
          {
            code: "respondent_accessibility_03",
            statement: "I can move through the respondent information and checklist steps easily.",
            sortOrder: 3,
          },
          {
            code: "respondent_accessibility_04",
            statement: "I find the survey page readable on the device I use.",
            sortOrder: 4,
          },
        ],
      },
      {
        code: "respondent_submission_experience",
        title: "Submission Experience",
        sortOrder: 2,
        items: [
          {
            code: "respondent_submission_01",
            statement: "I can clearly identify which checklist items still need to be answered before submission.",
            sortOrder: 1,
          },
          {
            code: "respondent_submission_02",
            statement: "I can submit my response without confusion or unnecessary steps.",
            sortOrder: 2,
          },
          {
            code: "respondent_submission_03",
            statement: "I receive clear feedback when my survey response is submitted successfully.",
            sortOrder: 3,
          },
        ],
      },
      {
        code: "respondent_privacy_confidence",
        title: "Privacy and Confidence",
        sortOrder: 3,
        items: [
          {
            code: "respondent_privacy_01",
            statement: "I understand that my participation in the survey is voluntary.",
            sortOrder: 1,
          },
          {
            code: "respondent_privacy_02",
            statement: "I feel confident that my response will be used only for academic and research purposes.",
            sortOrder: 2,
          },
          {
            code: "respondent_privacy_03",
            statement: "I am comfortable answering the survey using this online system.",
            sortOrder: 3,
          },
        ],
      },
    ],
  },
];

export function getLikertInterpretation(mean: number) {
  return LIKERT_SCALE.find((scale) => mean >= scale.minMean && mean <= scale.maxMean) ?? LIKERT_SCALE[LIKERT_SCALE.length - 1];
}