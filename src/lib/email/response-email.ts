import nodemailer from "nodemailer";

import { env } from "../env.js";
import type { SurveyResponseAnswer, SurveyResponseSummary } from "../../services/survey.services.js";

export type SurveyResponseReviewEmailParams = {
  to: string;
  response: SurveyResponseSummary;
  answers: SurveyResponseAnswer[];
  reviewUrl?: string;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function isImageSignature(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function getTransporter() {
  if (!env.gmail.user) {
    throw new Error("GMAIL_USER is required.");
  }

  if (!env.gmail.appPassword) {
    throw new Error("GMAIL_APP_PASSWORD is required.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.gmail.user,
      pass: env.gmail.appPassword,
    },
  });
}

export function createSurveyResponseReviewEmail(params: SurveyResponseReviewEmailParams) {
  const displayName = params.response.respondentFullName?.trim() || "Respondent";
  const signature = params.response.respondentSignature?.trim() || "";
  const textLines = [
    `Hello ${displayName},`,
    "",
    "Thank you for submitting your SurveyStat response. Below is a copy of your submitted answers for review.",
    "",
    `Survey: ${params.response.formTitle}`,
    `Submitted: ${formatDate(params.response.submittedAt)}`,
    `Answer Count: ${params.response.answerCount}`,
    `Weighted Mean: ${formatNumber(params.response.weightedMean)}`,
    `Interpretation: ${params.response.interpretation || "No data"}`,
    "",
    "Answers:",
    ...params.answers.map(
      (answer, index) =>
        `${index + 1}. [${answer.sectionTitle}] ${answer.itemCode} - ${answer.itemStatement} | Rating: ${answer.rating} (${answer.interpretation})`,
    ),
  ];

  if (signature) {
    textLines.push("", `Signature: ${signature}`);
  }

  if (params.reviewUrl) {
    textLines.push("", `Review URL: ${params.reviewUrl}`);
  }

  const answerRows = params.answers
    .map(
      (answer, index) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:800;">${index + 1}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(answer.sectionTitle)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">${escapeHtml(answer.itemCode)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#334155;line-height:1.6;">${escapeHtml(answer.itemStatement)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#0891b2;font-weight:900;">${escapeHtml(answer.rating)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f766e;font-weight:800;">${escapeHtml(answer.interpretation)}</td>
        </tr>`,
    )
    .join("");

  const signatureHtml = signature
    ? isImageSignature(signature)
      ? `
        <div style="margin-top:18px;padding:16px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p style="margin:0 0 10px;color:#475569;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;">Respondent Signature</p>
          <img src="${escapeHtml(signature)}" alt="Respondent signature" style="max-width:280px;max-height:110px;border-radius:14px;background:#ffffff;border:1px solid #cbd5e1;padding:10px;" />
        </div>`
      : `
        <div style="margin-top:18px;padding:16px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;">Respondent Signature</p>
          <p style="margin:0;color:#0f172a;font-size:18px;font-weight:900;font-family:Georgia,serif;">${escapeHtml(signature)}</p>
        </div>`
    : "";

  const reviewButton = params.reviewUrl
    ? `
      <a href="${escapeHtml(params.reviewUrl)}" style="display:inline-block;margin-top:20px;border-radius:999px;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:900;padding:13px 18px;">
        Review response online
      </a>`
    : "";

  const html = `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:960px;margin:0 auto;padding:32px 16px;">
        <div style="overflow:hidden;border-radius:28px;background:#ffffff;box-shadow:0 24px 80px rgba(15,23,42,.12);">
          <div style="background:linear-gradient(135deg,#0f172a,#164e63 48%,#0891b2);padding:32px;color:#ffffff;">
            <p style="margin:0 0 10px;color:#a5f3fc;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;">SurveyStat Response Review</p>
            <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:950;">Thank you, ${escapeHtml(displayName)}.</h1>
            <p style="margin:12px 0 0;color:#cffafe;line-height:1.7;">Your submitted answers are attached below for your review and records.</p>
            ${reviewButton}
          </div>

          <div style="padding:28px;">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:22px;">
              <div style="border-radius:18px;background:#ecfeff;border:1px solid #a5f3fc;padding:16px;">
                <p style="margin:0;color:#0e7490;font-size:12px;font-weight:900;text-transform:uppercase;">Survey</p>
                <p style="margin:8px 0 0;color:#0f172a;font-size:17px;font-weight:900;">${escapeHtml(params.response.formTitle)}</p>
              </div>
              <div style="border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;">
                <p style="margin:0;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase;">Submitted</p>
                <p style="margin:8px 0 0;color:#0f172a;font-size:17px;font-weight:900;">${escapeHtml(formatDate(params.response.submittedAt))}</p>
              </div>
              <div style="border-radius:18px;background:#f0fdfa;border:1px solid #99f6e4;padding:16px;">
                <p style="margin:0;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase;">Weighted Mean</p>
                <p style="margin:8px 0 0;color:#0f172a;font-size:24px;font-weight:950;">${escapeHtml(formatNumber(params.response.weightedMean))}</p>
              </div>
              <div style="border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;">
                <p style="margin:0;color:#c2410c;font-size:12px;font-weight:900;text-transform:uppercase;">Interpretation</p>
                <p style="margin:8px 0 0;color:#0f172a;font-size:17px;font-weight:900;">${escapeHtml(params.response.interpretation || "No data")}</p>
              </div>
            </div>

            <div style="overflow:auto;border-radius:20px;border:1px solid #e2e8f0;">
              <table style="width:100%;border-collapse:collapse;min-width:760px;background:#ffffff;">
                <thead>
                  <tr style="background:#0f172a;color:#ffffff;">
                    <th style="padding:13px;text-align:left;">#</th>
                    <th style="padding:13px;text-align:left;">Section</th>
                    <th style="padding:13px;text-align:left;">Code</th>
                    <th style="padding:13px;text-align:left;">Checklist Item</th>
                    <th style="padding:13px;text-align:center;">Rating</th>
                    <th style="padding:13px;text-align:left;">Interpretation</th>
                  </tr>
                </thead>
                <tbody>${answerRows}</tbody>
              </table>
            </div>

            ${signatureHtml}

            <p style="margin:24px 0 0;color:#64748b;line-height:1.7;font-size:13px;">
              This email was generated automatically by SurveyStat after your form submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    from: env.gmail.user,
    to: params.to,
    subject: `SurveyStat Response Review - ${params.response.formTitle}`,
    text: textLines.join("\n"),
    html,
  };
}

export async function sendSurveyResponseReviewEmail(params: SurveyResponseReviewEmailParams) {
  const transporter = getTransporter();
  const message = createSurveyResponseReviewEmail(params);

  await transporter.sendMail(message);

  return message;
}