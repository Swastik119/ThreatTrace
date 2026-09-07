import { ConfidentialClientApplication, type AccountInfo, type AuthenticationResult } from "@azure/msal-node";
import { env } from "../../config/env.js";
import { OutlookAccountModel } from "../../models/OutlookAccount.js";
import { decryptSecret, encryptSecret } from "../../utils/secrets.js";
import type { NormalizedEmail } from "../../types/email.js";
import { parseEml } from "../email/parse-eml.js";

const scopes = ["openid", "profile", "email", "User.Read", "Mail.Read", "offline_access"];

export function createMicrosoftClient() {
  return new ConfidentialClientApplication({ auth: { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}` } });
}

export function getOutlookAuthorizationUrl(state: string, redirectUri = env.OUTLOOK_CALLBACK_URL) {
  return createMicrosoftClient().getAuthCodeUrl({ scopes, redirectUri, state, prompt: "select_account" });
}

export async function saveOutlookAccount(userId: string, client: ConfidentialClientApplication, result: AuthenticationResult) {
  if (!result.account) throw new Error("Microsoft authorization did not return an account.");
  await OutlookAccountModel.findOneAndUpdate({ userId }, {
    userId,
    microsoftAccountId: result.account.homeAccountId,
    email: result.account.username,
    tokenCache: encryptSecret(client.getTokenCache().serialize()),
    scopes,
  }, { upsert: true, new: true });
}

async function getAccessToken(userId: string): Promise<string> {
  const accountRecord = await OutlookAccountModel.findOne({ userId });
  if (!accountRecord) throw new Error("Connect Outlook before requesting messages.");
  const client = createMicrosoftClient();
  const cache = client.getTokenCache();
  cache.deserialize(decryptSecret(accountRecord.tokenCache));
  const account = await cache.getAllAccounts().then((accounts) => accounts.find((item) => item.homeAccountId === accountRecord.microsoftAccountId));
  if (!account) throw new Error("Outlook authorization expired. Reconnect Outlook.");
  const result = await client.acquireTokenSilent({ account, scopes: ["User.Read", "Mail.Read"] });
  if (!result?.accessToken) throw new Error("Outlook authorization expired. Reconnect Outlook.");
  return result.accessToken;
}

async function graphRequest<T>(userId: string, path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken(userId);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(options?.headers ?? {}) } });
  if (!response.ok) {
    const error = new Error(`Microsoft Graph request failed (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function getOutlookStatus(userId: string) {
  const account = await OutlookAccountModel.findOne({ userId }).select("email scopes updatedAt").lean();
  return account ? { connected: true, email: account.email, scopes: account.scopes } : { connected: false };
}

export async function disconnectOutlook(userId: string) {
  await OutlookAccountModel.deleteOne({ userId });
}

interface GraphMessage { id: string; conversationId?: string; subject?: string; receivedDateTime?: string; bodyPreview?: string; from?: { emailAddress?: { address?: string } }; toRecipients?: { emailAddress?: { address?: string } }[]; }

export async function listOutlookMessages(userId: string) {
  const result = await graphRequest<{ value?: GraphMessage[] }>(userId, "/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime%20DESC&$select=id,conversationId,subject,receivedDateTime,bodyPreview,from,toRecipients");
  return (result.value ?? []).map((message) => ({ id: message.id, threadId: message.conversationId, from: message.from?.emailAddress?.address, to: message.toRecipients?.map((recipient) => recipient.emailAddress?.address).filter(Boolean).join(", "), subject: message.subject ?? "(no subject)", date: message.receivedDateTime, snippet: message.bodyPreview }));
}

export async function fetchOutlookEmail(userId: string, messageId: string): Promise<NormalizedEmail> {
  const token = await getAccessToken(userId);
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/$value`, { headers: { Authorization: `Bearer ${token}`, Accept: "message/rfc822" } });
  if (!response.ok) throw new Error(`Microsoft Graph message request failed (${response.status}).`);
  return parseEml(Buffer.from(await response.arrayBuffer()));
}
