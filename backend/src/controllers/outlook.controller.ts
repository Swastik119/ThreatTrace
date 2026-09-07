import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { createInvestigation } from "../services/analysis/create-investigation.service.js";
import { createMicrosoftClient, disconnectOutlook, fetchOutlookEmail, findOutlookMessageByVisibleMetadata, getOutlookAuthorizationUrl, getOutlookStatus, listOutlookMessages, saveOutlookAccount } from "../services/outlook/outlook.service.js";
import { completeOnboardingForUser } from "../services/onboarding/onboarding.service.js";

export async function connectOutlook(request: Request, response: Response) {
  const state = crypto.randomUUID();
  request.session.outlookState = state;
  const authorizationUrl = await getOutlookAuthorizationUrl(state);
  request.session.save((error) => {
    if (error) return response.status(500).send("Unable to start Outlook authorization.");
    return response.redirect(authorizationUrl);
  });
}

export async function completeOutlookConnection(request: Request, response: Response) {
  if (typeof request.query.state !== "string" || request.query.state !== request.session.outlookState) return response.status(400).send("Invalid OAuth state. Start Outlook connection again.");
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  if (!code) return response.status(400).send("Missing Outlook authorization code.");
  const client = createMicrosoftClient();
  const result = await client.acquireTokenByCode({ code, scopes: ["openid", "profile", "email", "User.Read", "Mail.Read", "offline_access"], redirectUri: env.OUTLOOK_CALLBACK_URL });
  await saveOutlookAccount(request.session.userId!, client, result);
  delete request.session.outlookState;
  return response.redirect(`${env.FRONTEND_ORIGIN}/connections`);
}

export async function getOutlookConnectionStatus(request: Request, response: Response) { return response.json(await getOutlookStatus(request.session.userId!)); }

export async function disconnectOutlookAccount(request: Request, response: Response) {
  await disconnectOutlook(request.session.userId!);
  return response.status(204).send();
}

export async function getOutlookMessages(request: Request, response: Response) { return response.json(await listOutlookMessages(request.session.userId!)); }

export async function analyzeOutlookMessage(request: Request, response: Response) {
  const messageId = typeof request.params.messageId === "string" ? request.params.messageId : undefined;
  if (!messageId) return response.status(400).json({ error: "An Outlook message ID is required." });
  const normalized = await fetchOutlookEmail(request.session.userId!, messageId);
  const result = await createInvestigation(normalized, request.session.userId!, "OUTLOOK", messageId);
  await completeOnboardingForUser(request.session.userId!);
  return response.status(201).json(result);
}

export async function resolveAndAnalyzeOutlookMessage(request: Request, response: Response) {
  const { sender, subject } = request.body as Record<string, unknown>;
  if (typeof sender !== "string" || typeof subject !== "string" || sender.length > 320 || subject.length > 998) {
    return response.status(400).json({ error: "An Outlook sender and subject are required." });
  }
  const connection = await getOutlookStatus(request.session.userId!);
  if (!connection.connected) return response.status(409).json({ error: "Connect Outlook in ThreatTrace before analyzing messages." });
  const { messageId, email } = await findOutlookMessageByVisibleMetadata(request.session.userId!, { sender, subject });
  const result = await createInvestigation(email, request.session.userId!, "OUTLOOK", messageId);
  await completeOnboardingForUser(request.session.userId!);
  return response.status(201).json(result);
}
