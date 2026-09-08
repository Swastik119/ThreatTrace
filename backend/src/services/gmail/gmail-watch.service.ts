import { env } from "../../config/env.js";
import { GmailAccountModel } from "../../models/GmailAccount.js";
import { gmailForAccount } from "./gmail.service.js";

type GmailAccount = { _id: { toString(): string }; refreshToken: string; gmailWatchHistoryId?: string | null; email: string };

function watchState(data: { historyId?: string | null; expiration?: string | null }) {
  if (!data.historyId || !data.expiration) throw new Error("Gmail returned an incomplete watch state.");
  const expiration = new Date(Number(data.expiration));
  if (Number.isNaN(expiration.getTime())) throw new Error("Gmail returned an invalid watch expiration.");
  return { historyId: String(data.historyId), expiration };
}

/** Starts a Gmail Inbox watch using the connection's existing refresh token. */
export async function startGmailWatch(account: GmailAccount, options: { preserveHistoryId?: boolean } = {}) {
  const gmail = await gmailForAccount(account);
  const result = await gmail.users.watch({ userId: "me", requestBody: { topicName: env.GMAIL_PUBSUB_TOPIC, labelIds: ["INBOX"] } });
  const state = watchState(result.data);
  // A renewal must not replace an unconsumed cursor: messages arriving between
  // the old cursor and this new watch response are still read via History API.
  await GmailAccountModel.updateOne(
    { _id: account._id },
    { $set: {
      autoAnalysisEnabled: true,
      gmailWatchExpiration: state.expiration,
      ...(options.preserveHistoryId && account.gmailWatchHistoryId ? {} : { gmailWatchHistoryId: state.historyId }),
      gmailWatchRenewalLeaseUntil: null,
      gmailAuthErrorAt: null,
    } },
  );
  console.info(JSON.stringify({ event: options.preserveHistoryId ? "WATCH_RENEWED" : "WATCH_CREATED", gmailAccountId: account._id.toString(), historyId: state.historyId, expiration: state.expiration.toISOString() }));
  return state;
}

export async function stopGmailWatch(account: GmailAccount) {
  let stopError: unknown;
  try {
    const gmail = await gmailForAccount(account);
    await gmail.users.stop({ userId: "me" });
  } catch (error) { stopError = error; }
  // Disabling must be effective locally even when Google's best-effort stop
  // call is unavailable; an eventual notification is ignored by the webhook.
  await GmailAccountModel.updateOne({ _id: account._id }, { $set: { autoAnalysisEnabled: false, gmailWatchHistoryId: null, gmailWatchExpiration: null, gmailProcessingLeaseUntil: null, gmailWatchRenewalLeaseUntil: null } });
  console.info(JSON.stringify({ event: "WATCH_STOPPED", gmailAccountId: account._id.toString() }));
  if (stopError) console.warn(JSON.stringify({ event: "PROCESSING_FAILED", category: "WATCH_STOP", gmailAccountId: account._id.toString(), message: stopError instanceof Error ? stopError.message : "unknown" }));
}

export async function renewExpiringGmailWatches() {
  const now = new Date();
  const dueBy = new Date(now.getTime() + env.GMAIL_WATCH_RENEWAL_WINDOW_MS);
  const accounts = await GmailAccountModel.find({ autoAnalysisEnabled: true, gmailWatchExpiration: { $lte: dueBy } }).select("email refreshToken gmailWatchHistoryId");
  for (const account of accounts) {
    const leaseUntil = new Date(Date.now() + 10 * 60 * 1000);
    const locked = await GmailAccountModel.findOneAndUpdate({ _id: account._id, $or: [{ gmailWatchRenewalLeaseUntil: null }, { gmailWatchRenewalLeaseUntil: { $exists: false } }, { gmailWatchRenewalLeaseUntil: { $lt: now } }] }, { $set: { gmailWatchRenewalLeaseUntil: leaseUntil } }, { returnDocument: "after" });
    if (!locked) continue;
    try { await startGmailWatch(locked, { preserveHistoryId: true }); }
    catch (error) {
      await GmailAccountModel.updateOne({ _id: account._id }, { $set: { gmailWatchRenewalLeaseUntil: null } });
      console.error(JSON.stringify({ event: "PROCESSING_FAILED", category: "WATCH_RENEWAL", gmailAccountId: account._id.toString(), message: error instanceof Error ? error.message : "unknown" }));
    }
  }
}

export function startGmailWatchRenewalScheduler() {
  const timer = setInterval(() => { void renewExpiringGmailWatches(); }, env.GMAIL_WATCH_RENEWAL_INTERVAL_MS);
  timer.unref();
  void renewExpiringGmailWatches();
}
