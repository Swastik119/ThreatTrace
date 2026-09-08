import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { EmailModel } from "../../models/Email.js";
import { GmailAccountModel } from "../../models/GmailAccount.js";
import { GmailProcessedMessageModel } from "../../models/GmailProcessedMessage.js";
import { createInvestigation } from "../analysis/create-investigation.service.js";
import { createThreatAlertIfNeeded } from "../alerts/threat-alert.service.js";
import { fetchGmailEmail, gmailForAccount } from "./gmail.service.js";

const PROCESSING_LEASE_MS = 15 * 60 * 1000;

function isHistoryExpired(error: unknown) {
  const candidate = error as { code?: number; response?: { status?: number; data?: { error?: { errors?: Array<{ reason?: string }> } } } };
  return candidate.code === 404 || candidate.response?.status === 404 || candidate.response?.data?.error?.errors?.some((item) => item.reason === "historyIdInvalid");
}

function errorCategory(error: unknown) {
  const candidate = error as { code?: number; response?: { status?: number; data?: { error?: string } } };
  if (candidate.code === 401 || candidate.response?.status === 401 || /invalid_grant/i.test(candidate.response?.data?.error ?? "")) return "OAUTH";
  return "GMAIL_PROCESSING";
}

async function reserveMessage(gmailAccountId: mongoose.Types.ObjectId, gmailMessageId: string) {
  const lease = new Date(Date.now() + PROCESSING_LEASE_MS);
  try {
    await GmailProcessedMessageModel.create({ gmailAccountId, gmailMessageId, status: "PROCESSING", processingLeaseUntil: lease });
    return true;
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    const record = await GmailProcessedMessageModel.findOne({ gmailAccountId, gmailMessageId });
    if (!record || record.status === "COMPLETED" || record.processingLeaseUntil > new Date()) return false;
    const claimed = await GmailProcessedMessageModel.updateOne(
      { _id: record._id, status: { $in: ["FAILED", "PROCESSING"] }, processingLeaseUntil: { $lte: new Date() } },
      { $set: { status: "PROCESSING", processingLeaseUntil: lease, lastErrorCategory: undefined } },
    );
    return claimed.modifiedCount === 1;
  }
}

async function processMessage(account: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId }, gmailMessageId: string) {
  if (!(await reserveMessage(account._id, gmailMessageId))) return;
  try {
    // Messages manually investigated before real-time analysis was enabled are
    // already authoritative and must not create a second investigation.
    const existing = await EmailModel.exists({ userId: account.userId.toString(), source: "GMAIL", gmailMessageId });
    if (existing) {
      await GmailProcessedMessageModel.updateOne({ gmailAccountId: account._id, gmailMessageId }, { $set: { status: "COMPLETED", processingLeaseUntil: new Date(0) } });
      return;
    }
    const email = await fetchGmailEmail(account.userId.toString(), gmailMessageId);
    const investigation = await createInvestigation(email, account.userId.toString(), "GMAIL", gmailMessageId);
    await GmailProcessedMessageModel.updateOne({ gmailAccountId: account._id, gmailMessageId }, { $set: { status: "COMPLETED", processingLeaseUntil: new Date(0), investigationId: investigation.id } });
    console.info(JSON.stringify({ event: "INVESTIGATION_CREATED", gmailAccountId: account._id.toString(), gmailMessageId, investigationId: investigation.id }));
    await createThreatAlertIfNeeded({ userId: account.userId.toString(), investigationId: investigation.id, riskScore: investigation.analysis.riskScore, source: "GMAIL" });
    console.info(JSON.stringify({ event: "GMAIL_MESSAGE_PROCESSED", gmailAccountId: account._id.toString(), gmailMessageId }));
  } catch (error) {
    await GmailProcessedMessageModel.updateOne({ gmailAccountId: account._id, gmailMessageId }, { $set: { status: "FAILED", processingLeaseUntil: new Date(0), lastErrorCategory: errorCategory(error) } });
    throw error;
  }
}

async function inboxMessageIdsSince(account: { refreshToken: string }, startHistoryId: string) {
  const gmail = await gmailForAccount(account);
  const messageIds = new Set<string>();
  let pageToken: string | undefined;
  let newestHistoryId: string | undefined;
  do {
    const result = await gmail.users.history.list({ userId: "me", startHistoryId, historyTypes: ["messageAdded"], labelId: "INBOX", pageToken });
    newestHistoryId = result.data.historyId ?? newestHistoryId;
    for (const change of result.data.history ?? []) {
      for (const addition of change.messagesAdded ?? []) {
        const message = addition.message;
        // labelId on the request guarantees inbox relevance. Keep the local
        // check for responses that do include labels as defence in depth.
        if (message?.id && (!message.labelIds || message.labelIds.includes("INBOX"))) messageIds.add(message.id);
      }
    }
    pageToken = result.data.nextPageToken ?? undefined;
  } while (pageToken);
  console.info(JSON.stringify({ event: "GMAIL_HISTORY_FETCHED", startHistoryId, messageCount: messageIds.size }));
  return { messageIds: [...messageIds], newestHistoryId };
}

/** Full Inbox reconciliation is used only after Gmail has expired a cursor. */
async function reconcileInbox(account: { refreshToken: string }) {
  const gmail = await gmailForAccount(account);
  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const result = await gmail.users.messages.list({ userId: "me", labelIds: ["INBOX"], maxResults: 500, pageToken });
    for (const message of result.data.messages ?? []) if (message.id) ids.add(message.id);
    pageToken = result.data.nextPageToken ?? undefined;
  } while (pageToken);
  const profile = await gmail.users.getProfile({ userId: "me" });
  if (!profile.data.historyId) throw new Error("Gmail did not return a recovery history ID.");
  return { messageIds: [...ids], newestHistoryId: String(profile.data.historyId) };
}

export async function processGmailNotification(input: { emailAddress: string; historyId: string }) {
  const escapedEmail = input.emailAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const account = await GmailAccountModel.findOne({ email: new RegExp(`^${escapedEmail}$`, "i"), autoAnalysisEnabled: true });
  if (!account) return { ignored: true as const, reason: "ACCOUNT_NOT_FOUND_OR_DISABLED" };
  const now = new Date();
  const lease = new Date(now.getTime() + PROCESSING_LEASE_MS);
  const locked = await GmailAccountModel.findOneAndUpdate(
    { _id: account._id, autoAnalysisEnabled: true, $or: [{ gmailProcessingLeaseUntil: null }, { gmailProcessingLeaseUntil: { $exists: false } }, { gmailProcessingLeaseUntil: { $lt: now } }] },
    { $set: { gmailProcessingLeaseUntil: lease } },
    { returnDocument: "after" },
  );
  if (!locked) return { ignored: true as const, reason: "PROCESSING_IN_PROGRESS" };
  const startHistoryId = locked.gmailWatchHistoryId;
  if (!startHistoryId) {
    await GmailAccountModel.updateOne({ _id: locked._id }, { $set: { gmailProcessingLeaseUntil: null } });
    throw new Error("Gmail real-time analysis has no history cursor.");
  }
  try {
    let changes: { messageIds: string[]; newestHistoryId?: string };
    try { changes = await inboxMessageIdsSince(locked, startHistoryId); }
    catch (error) {
      if (!isHistoryExpired(error)) throw error;
      console.warn(JSON.stringify({ event: "GMAIL_HISTORY_EXPIRED", gmailAccountId: locked._id.toString(), startHistoryId }));
      changes = await reconcileInbox(locked);
    }
    for (const gmailMessageId of changes.messageIds) {
      console.info(JSON.stringify({ event: "GMAIL_MESSAGE_FOUND", gmailAccountId: locked._id.toString(), gmailMessageId, notificationHistoryId: input.historyId }));
      await processMessage(locked, gmailMessageId);
    }
    const nextHistoryId = changes.newestHistoryId ?? input.historyId;
    // Conditional advancement prevents a late worker from ever moving the
    // cursor backwards. If the condition fails, a newer worker already won.
    await GmailAccountModel.updateOne({ _id: locked._id, gmailWatchHistoryId: startHistoryId }, { $set: { gmailWatchHistoryId: nextHistoryId, gmailProcessingLeaseUntil: null } });
    return { ignored: false as const, processed: changes.messageIds.length };
  } catch (error) {
    await GmailAccountModel.updateOne({ _id: locked._id }, { $set: { gmailProcessingLeaseUntil: null, ...(errorCategory(error) === "OAUTH" ? { gmailAuthErrorAt: new Date(), autoAnalysisEnabled: false } : {}) } });
    console.error(JSON.stringify({ event: "PROCESSING_FAILED", category: errorCategory(error), gmailAccountId: locked._id.toString(), notificationHistoryId: input.historyId, message: error instanceof Error ? error.message : "unknown" }));
    throw error;
  }
}

/** The current deployment has no durable job runner; this isolates work from the HTTP acknowledgement. */
export function enqueueGmailNotification(input: { emailAddress: string; historyId: string }) {
  setImmediate(() => { void processGmailNotification(input).catch(() => undefined); });
}
