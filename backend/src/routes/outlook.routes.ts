import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { analyzeOutlookMessage, completeOutlookConnection, connectOutlook, disconnectOutlookAccount, getOutlookConnectionStatus, getOutlookMessages } from "../controllers/outlook.controller.js";

export const outlookRouter = Router();
outlookRouter.use(requireAuth);
outlookRouter.get("/connect", asyncHandler(connectOutlook));
outlookRouter.get("/callback", asyncHandler(completeOutlookConnection));
outlookRouter.get("/status", asyncHandler(getOutlookConnectionStatus));
outlookRouter.delete("/connection", asyncHandler(disconnectOutlookAccount));
outlookRouter.get("/messages", asyncHandler(getOutlookMessages));
outlookRouter.post("/messages/:messageId/analyze", asyncHandler(analyzeOutlookMessage));
