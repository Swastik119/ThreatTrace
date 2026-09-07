import { google } from "googleapis";
import { env } from "../../config/env.js";
import { GmailAccountModel } from "../../models/GmailAccount.js";
import { decryptSecret, encryptSecret } from "../../utils/secrets.js";
import type { NormalizedEmail } from "../../types/email.js";
import { parseEml } from "../email/parse-eml.js";

export function createGoogleClient() { return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GMAIL_CALLBACK_URL); }

export async function getGmailProfile(client: InstanceType<typeof google.auth.OAuth2>) {
  const gmail = google.gmail({ version: "v1", auth: client });
  const result = await gmail.users.getProfile({ userId: "me" });
  return { emailAddress: result.data.emailAddress };
}

export async function saveGmailAccount(userId: string, tokens: { refresh_token?: string | null; scope?: string | null }, profile: { sub: string; email: string }) {
  const existing = await GmailAccountModel.findOne({ userId });
  if (!tokens.refresh_token && !existing?.refreshToken) throw new Error("Google did not return a refresh token for the first Gmail connection.");
  await GmailAccountModel.findOneAndUpdate({ userId }, {
    userId,
    googleAccountId: profile.sub,
    email: profile.email,
    refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing?.refreshToken,
    scopes: tokens.scope?.split(" ") ?? existing?.scopes ?? [],
  }, { upsert: true, returnDocument: 'after' });
}

async function gmailForUser(userId: string) {
  const account = await GmailAccountModel.findOne({ userId });
  if (!account) throw new Error("Connect Gmail before requesting messages.");
  const client = createGoogleClient();
  client.setCredentials({ refresh_token: decryptSecret(account.refreshToken) });
  return google.gmail({ version: "v1", auth: client });
}

export async function getGmailStatus(userId: string) { const account = await GmailAccountModel.findOne({ userId }).select("email scopes updatedAt").lean(); return account ? { connected: true, email: account.email, scopes: account.scopes } : { connected: false }; }

export async function disconnectGmail(userId: string) {
  const account = await GmailAccountModel.findOne({ userId }).select("refreshToken").lean();
  if (!account) return;
  const client = createGoogleClient();
  try { await client.revokeToken(decryptSecret(account.refreshToken)); } catch { /* The local credential is still removed if Google revocation is unavailable. */ }
  await GmailAccountModel.deleteOne({ userId });
}

export async function listGmailMessages(userId: string) {
  const gmail = await gmailForUser(userId);
  const result = await gmail.users.messages.list({ userId: "me", maxResults: 25, q: "-in:trash" });
  const messageResults = await Promise.allSettled((result.data.messages ?? []).slice(0, 25).filter((message) => message.id).map(async (message) => {
    const detail = await gmail.users.messages.get({ userId: "me", id: message.id!, format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] });
    const headers = Object.fromEntries((detail.data.payload?.headers ?? []).map((header) => [header.name?.toLowerCase() ?? "", header.value ?? ""]));
    return { id: message.id, threadId: message.threadId, from: headers.from, to: headers.to, subject: headers.subject ?? "(no subject)", date: headers.date, snippet: detail.data.snippet };
  }));
  const rejected = messageResults.filter((item) => item.status === "rejected");
  if (rejected.length) console.warn(`Gmail metadata lookup failed for ${rejected.length} message(s):`, rejected[0].reason);
  return messageResults.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
}

export async function fetchGmailEmail(userId: string, messageId: string): Promise<NormalizedEmail> {
  const gmail = await gmailForUser(userId);
  const result = await gmail.users.messages.get({ userId: "me", id: messageId, format: "raw" });
  if (!result.data.raw) throw new Error("Gmail returned no message content.");
  return parseEml(Buffer.from(result.data.raw, "base64url"));
}

/**
 * Gmail's web URL identifies a thread rather than one concrete RFC822 message.
 * Resolve it through the user's connected Gmail account so analysis still uses
 * Gmail's original raw message, headers, and attachment bytes.
 */
export async function fetchLatestGmailThreadEmail(userId: string, threadId: string) {
  const gmail = await gmailForUser(userId);
  const thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "minimal" });
  const latestMessage = thread.data.messages?.at(-1);
  if (!latestMessage?.id) throw new Error("Gmail conversation contains no analyzable messages.");
  return { messageId: latestMessage.id, email: await fetchGmailEmail(userId, latestMessage.id) };
}

/**
 * Gmail's rendered UI exposes an opaque conversation token (for example
 * FMfcgz...), which is not the Gmail API id. Resolve it using only the visible
 * sender and subject, then fetch the matching raw message from the connected
 * Gmail account. Email contents are never accepted from the browser.
 */
export async function findGmailMessageByVisibleMetadata(userId: string, input: { sender: string; subject: string }) {
  const gmail = await gmailForUser(userId);
  const sender = input.sender.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase();
  if (!sender) throw new Error("Gmail did not expose a usable sender address for this email.");
  const subject = input.subject.trim().replace(/["\\]/g, "\\$&");
  if (!subject) throw new Error("Gmail did not expose a usable subject for this email.");
  const search = await gmail.users.messages.list({ userId: "me", q: `from:${sender} subject:"${subject}"`, maxResults: 10 });
  const messageId = search.data.messages?.[0]?.id;
  if (!messageId) throw new Error("ThreatTrace could not find this email in the connected Gmail account.");
  return { messageId, email: await fetchGmailEmail(userId, messageId) };
}
