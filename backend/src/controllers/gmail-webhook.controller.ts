import type { Request, Response } from "express";
import { enqueueGmailNotification } from "../services/gmail/gmail-notification.service.js";
import { PubSubAuthenticationError, verifyPubSubPushToken } from "../services/gmail/pubsub-auth.service.js";

function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error("Invalid base64 payload.");
  return Buffer.from(value, "base64").toString("utf8");
}

export async function gmailPubSubWebhook(request: Request, response: Response) {
  try { await verifyPubSubPushToken(request.header("authorization")); }
  catch (error) {
    const failure = error instanceof PubSubAuthenticationError ? error : new PubSubAuthenticationError(401, "Invalid Pub/Sub authorization token.");
    console.warn(JSON.stringify({ event: "PUBSUB_AUTH_FAILED", status: failure.status }));
    return response.status(failure.status).json({ error: failure.message });
  }
  const body = request.body as { message?: { data?: unknown; messageId?: unknown } };
  if (typeof body?.message?.data !== "string") return response.status(400).json({ error: "Malformed Pub/Sub payload." });
  try {
    const notification = JSON.parse(decodeBase64(body.message.data)) as { emailAddress?: unknown; historyId?: unknown };
    if (typeof notification.emailAddress !== "string" || !notification.emailAddress || typeof notification.historyId !== "string" || !notification.historyId) throw new Error("Malformed Gmail notification.");
    console.info(JSON.stringify({ event: "PUBSUB_NOTIFICATION_RECEIVED", emailAddress: notification.emailAddress, notificationHistoryId: notification.historyId, messageId: typeof body.message.messageId === "string" ? body.message.messageId : undefined }));
    enqueueGmailNotification({ emailAddress: notification.emailAddress, historyId: notification.historyId });
    return response.status(200).json({ accepted: true });
  } catch {
    return response.status(400).json({ error: "Malformed Pub/Sub payload." });
  }
}
