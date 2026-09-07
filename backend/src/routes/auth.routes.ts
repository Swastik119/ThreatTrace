import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { completeGoogleLogin, completeMicrosoftLogin, deleteAccount, getCurrentUser, getOnboarding, login, logout, register, startGoogleLogin, startMicrosoftLogin, updateAvatar, updateOnboarding, updateProfile } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { avatarUpload } from "../middleware/upload.js";

export const authRouter = Router();

authRouter.get("/google", startGoogleLogin);
authRouter.get("/google/callback", asyncHandler(completeGoogleLogin));
authRouter.get("/microsoft", asyncHandler(startMicrosoftLogin));
authRouter.get("/microsoft/callback", asyncHandler(completeMicrosoftLogin));
authRouter.post("/register", asyncHandler(register));
authRouter.post("/login", asyncHandler(login));
authRouter.get("/me", asyncHandler(getCurrentUser));
authRouter.get("/onboarding", requireAuth, asyncHandler(getOnboarding));
authRouter.patch("/onboarding", requireAuth, asyncHandler(updateOnboarding));
authRouter.patch("/profile", requireAuth, asyncHandler(updateProfile));
authRouter.patch("/profile/avatar", requireAuth, avatarUpload.single("avatar"), asyncHandler(updateAvatar));
authRouter.delete("/account", requireAuth, asyncHandler(deleteAccount));
authRouter.post("/logout", logout);
