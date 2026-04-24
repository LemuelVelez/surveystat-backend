import { env } from "./env.js";

export type MailConfig = {
  user: string;
  hasAppPassword: boolean;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function getMailConfig(): MailConfig {
  return {
    user: env.gmail.user,
    hasAppPassword: Boolean(env.gmail.appPassword),
  };
}

export function assertMailConfig() {
  if (!env.gmail.user) {
    throw new Error("GMAIL_USER is required.");
  }

  if (!env.gmail.appPassword) {
    throw new Error("GMAIL_APP_PASSWORD is required.");
  }
}

export function createCredentialEmailMessage(params: {
  to: string;
  name?: string;
  email: string;
  password: string;
  loginUrl?: string;
}): MailMessage {
  const displayName = params.name?.trim() || "User";
  const loginUrl = params.loginUrl?.trim();

  const textLines = [
    `Hello ${displayName},`,
    "",
    "Your SurveyStat account has been created.",
    "",
    `Email: ${params.email}`,
    `Password: ${params.password}`,
  ];

  if (loginUrl) {
    textLines.push(`Login URL: ${loginUrl}`);
  }

  textLines.push("", "Please change your password after signing in.");

  const htmlLines = [
    `<p>Hello ${escapeHtml(displayName)},</p>`,
    "<p>Your SurveyStat account has been created.</p>",
    "<p>",
    `<strong>Email:</strong> ${escapeHtml(params.email)}<br />`,
    `<strong>Password:</strong> ${escapeHtml(params.password)}`,
    "</p>",
  ];

  if (loginUrl) {
    htmlLines.push(
      `<p><strong>Login URL:</strong> <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`,
    );
  }

  htmlLines.push("<p>Please change your password after signing in.</p>");

  return {
    to: params.to,
    subject: "Your SurveyStat Login Credentials",
    text: textLines.join("\n"),
    html: htmlLines.join("\n"),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
