import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";

const googleIssuer = new Set(["accounts.google.com", "https://accounts.google.com"]);

export class PubSubAuthenticationError extends Error {
  constructor(public readonly status: 401 | 403, message: string) { super(message); }
}

export async function verifyPubSubPushToken(authorization?: string) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new PubSubAuthenticationError(401, "Missing Pub/Sub authorization token.");
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: match[1], audience: env.GMAIL_PUBSUB_AUDIENCE });
    const payload = ticket.getPayload();
    if (!payload || !googleIssuer.has(payload.iss ?? "")) throw new PubSubAuthenticationError(401, "Invalid Pub/Sub token issuer.");
    if (payload.email !== env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT || payload.email_verified !== true) throw new PubSubAuthenticationError(403, "Unexpected Pub/Sub service account.");
    return payload;
  } catch (error) {
    if (error instanceof PubSubAuthenticationError) throw error;
    throw new PubSubAuthenticationError(401, "Invalid Pub/Sub authorization token.");
  }
}
