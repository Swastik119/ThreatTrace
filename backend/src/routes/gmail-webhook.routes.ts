import { Router } from "express";
import { gmailPubSubWebhook } from "../controllers/gmail-webhook.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

// Intentionally has no requireAuth: Google Pub/Sub authenticates with OIDC.
export const gmailWebhookRouter = Router();
gmailWebhookRouter.post("/gmail", asyncHandler(gmailPubSubWebhook));
