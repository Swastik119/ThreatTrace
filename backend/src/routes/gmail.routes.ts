import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { analyzeGmailMessage, analyzeGmailThread, completeGmailConnection, connectGmail, disconnectGmailAccount, getGmailConnectionStatus, getGmailMessages, getRealtimeAnalysisStatus, resolveAndAnalyzeGmailMessage, setRealtimeAnalysis } from "../controllers/gmail.controller.js";

export const gmailRouter = Router();
gmailRouter.use(requireAuth);
gmailRouter.get("/connect", connectGmail);
gmailRouter.get("/callback", asyncHandler(completeGmailConnection));
gmailRouter.get("/status", asyncHandler(getGmailConnectionStatus));
gmailRouter.get("/real-time-analysis", asyncHandler(getRealtimeAnalysisStatus));
gmailRouter.post("/real-time-analysis", asyncHandler(setRealtimeAnalysis));
gmailRouter.delete("/connection", asyncHandler(disconnectGmailAccount));
gmailRouter.get("/messages", asyncHandler(getGmailMessages));
gmailRouter.post("/messages/resolve-and-analyze", asyncHandler(resolveAndAnalyzeGmailMessage));
gmailRouter.post("/messages/:messageId/analyze", asyncHandler(analyzeGmailMessage));
gmailRouter.post("/threads/:threadId/analyze", asyncHandler(analyzeGmailThread));
