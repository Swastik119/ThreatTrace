import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import crypto from "node:crypto";
import { createMicrosoftClient, getOutlookAuthorizationUrl } from "../services/outlook/outlook.service.js";
import { uploadAvatar } from "../services/storage/cloudinary.service.js";
import { GmailAccountModel } from "../models/GmailAccount.js";
import { OutlookAccountModel } from "../models/OutlookAccount.js";
import { EmailModel } from "../models/Email.js";
import { InvestigationModel } from "../models/Investigation.js";
import { AnalysisModel } from "../models/Analysis.js";
import { CopilotConversationModel } from "../models/CopilotConversation.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);

type OnboardingStatus = "in_progress" | "dismissed" | "completed";
type OnboardingIntake = "gmail" | "outlook" | "upload";

function onboardingResponse(onboarding?: {
  status?: OnboardingStatus;
  intake?: OnboardingIntake | null;
  startedAt?: Date | null;
  dismissedAt?: Date | null;
  completedAt?: Date | null;
} | null) {
  return {
    status: onboarding?.status ?? "in_progress",
    intake: onboarding?.intake ?? undefined,
    startedAt: onboarding?.startedAt ?? undefined,
    dismissedAt: onboarding?.dismissedAt ?? undefined,
    completedAt: onboarding?.completedAt ?? undefined,
  };
}

export function startGoogleLogin(_request: Request, response: Response) {
  const url = googleClient.generateAuthUrl({ access_type: "offline", scope: ["openid", "email", "profile"], prompt: "select_account" });
  return response.redirect(url);
}

export async function startMicrosoftLogin(request: Request, response: Response) {
  const state = crypto.randomUUID();
  request.session.microsoftAuthState = state;
  return response.redirect(await getOutlookAuthorizationUrl(state, env.MICROSOFT_AUTH_CALLBACK_URL));
}

export async function completeMicrosoftLogin(request: Request, response: Response) {
  if (typeof request.query.state !== "string" || request.query.state !== request.session.microsoftAuthState) return response.status(400).send("Invalid Microsoft authorization state.");
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  if (!code) return response.status(400).send("Missing Microsoft authorization code.");
  const client = createMicrosoftClient();
  const result = await client.acquireTokenByCode({ code, scopes: ["openid", "profile", "email", "User.Read", "Mail.Read", "offline_access"], redirectUri: env.MICROSOFT_AUTH_CALLBACK_URL });
  if (!result.account?.username || !result.account.homeAccountId) return response.status(400).send("Microsoft did not return a usable profile.");
  let user = await UserModel.findOne({ $or: [{ microsoftId: result.account.homeAccountId }, { email: result.account.username.toLowerCase() }] });
  const isNewUser = !user;
  if (!user) {
    const baseUsername = result.account.username.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "analyst";
    let username = baseUsername;
    let suffix = 1;
    while (await UserModel.exists({ username })) username = `${baseUsername}${suffix++}`.slice(0, 24);
    user = await UserModel.create({ microsoftId: result.account.homeAccountId, email: result.account.username.toLowerCase(), username, name: result.account.name ?? result.account.username, emailVerified: true });
  } else { user.microsoftId = result.account.homeAccountId; await user.save(); }
  request.session.userId = user._id.toString();
  delete request.session.microsoftAuthState;
  return response.redirect(`${env.FRONTEND_ORIGIN}/${isNewUser ? "onboarding" : "dashboard"}`);
}

export async function completeGoogleLogin(request: Request, response: Response) {
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  if (!code) return response.status(400).send("Missing Google authorization code.");
  const { tokens } = await googleClient.getToken(code);
  const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email) return response.status(400).send("Google did not return a usable profile.");
  let user = await UserModel.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] });
  const isNewUser = !user;
  if (user) {
    user.googleId = profile.sub;
    user.name = user.name || profile.name || profile.email;
    user.avatarUrl = user.avatarUrl || profile.picture;
    await user.save();
  } else {
    user = await UserModel.create({ googleId: profile.sub, email: profile.email, username: profile.email.split("@")[0], name: profile.name ?? profile.email, avatarUrl: profile.picture, emailVerified: true });
  }
  request.session.userId = user._id.toString();
  return response.redirect(`${env.FRONTEND_ORIGIN}/${isNewUser ? "onboarding" : "dashboard"}`);
}

export async function register(request: Request, response: Response) {
  const { email, name, username, password } = request.body as Record<string, unknown>;
  if (typeof email !== "string" || typeof name !== "string" || typeof username !== "string" || typeof password !== "string") return response.status(400).json({ error: "Name, email, username, and password are required." });
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return response.status(400).json({ error: "Enter a valid email address." });
  if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) return response.status(400).json({ error: "Username must be 3-24 characters using letters, numbers, or underscores." });
  if (password.length < 8) return response.status(400).json({ error: "Password must be at least 8 characters." });
  if (name.trim().length < 2) return response.status(400).json({ error: "Name must be at least 2 characters." });
  const existing = await UserModel.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).select("email username").lean();
  if (existing?.email === normalizedEmail) return response.status(409).json({ error: "An account with that email already exists." });
  if (existing?.username === normalizedUsername) return response.status(409).json({ error: "That username is already taken." });
  const user = await UserModel.create({ email: normalizedEmail, username: normalizedUsername, name: name.trim(), passwordHash: await bcrypt.hash(password, 12), emailVerified: false });
  request.session.userId = user._id.toString();
  return response.status(201).json({ id: user._id.toString(), email: user.email, username: user.username, name: user.name });
}

export async function login(request: Request, response: Response) {
  const { identifier, password } = request.body as Record<string, unknown>;
  if (typeof identifier !== "string" || typeof password !== "string") return response.status(400).json({ error: "Username or email and password are required." });
  const user = await UserModel.findOne({ $or: [{ email: identifier.trim().toLowerCase() }, { username: identifier.trim().toLowerCase() }] });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ error: "Invalid username/email or password." });
  request.session.userId = user._id.toString();
  return response.json({ id: user._id.toString(), email: user.email, username: user.username, name: user.name });
}

export async function getCurrentUser(request: Request, response: Response) {
  if (!request.session.userId) return response.status(401).json({ error: "Authentication required." });
  const user = await UserModel.findById(request.session.userId).select("email name username avatarUrl emailVerified googleId microsoftId onboarding").lean();
  if (!user) return response.status(401).json({ error: "Authentication required." });
  return response.json({ ...user, onboarding: onboardingResponse(user.onboarding) });
}

export async function getOnboarding(request: Request, response: Response) {
  const user = await UserModel.findById(request.session.userId).select("onboarding").lean();
  if (!user) return response.status(401).json({ error: "Authentication required." });
  return response.json(onboardingResponse(user.onboarding));
}

export async function updateOnboarding(request: Request, response: Response) {
  const { status, intake } = request.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    if (status !== "in_progress" && status !== "dismissed" && status !== "completed") {
      return response.status(400).json({ error: "Provide a valid onboarding status." });
    }
    updates["onboarding.status"] = status;
    if (status === "dismissed") updates["onboarding.dismissedAt"] = new Date();
    if (status === "completed") updates["onboarding.completedAt"] = new Date();
  }
  if (intake !== undefined) {
    if (intake !== "gmail" && intake !== "outlook" && intake !== "upload") {
      return response.status(400).json({ error: "Provide a valid intake method." });
    }
    updates["onboarding.intake"] = intake;
  }
  if (!Object.keys(updates).length) return response.status(400).json({ error: "Provide an onboarding update." });
  const user = await UserModel.findByIdAndUpdate(request.session.userId, { $set: updates }, { new: true, runValidators: true }).select("onboarding").lean();
  if (!user) return response.status(404).json({ error: "User not found." });
  return response.json(onboardingResponse(user.onboarding));
}

export async function updateProfile(request: Request, response: Response) {
  const { name, username } = request.body as Record<string, unknown>;
  const updates: { name?: string; username?: string } = {};
  if (typeof name === "string" && name.trim().length >= 2) updates.name = name.trim();
  if (typeof username === "string" && /^[a-z0-9_]{3,24}$/i.test(username.trim())) updates.username = username.trim().toLowerCase();
  if (!Object.keys(updates).length) return response.status(400).json({ error: "Provide a valid name or username." });
  if (updates.username) {
    const conflict = await UserModel.findOne({ username: updates.username, _id: { $ne: request.session.userId } }).lean();
    if (conflict) return response.status(409).json({ error: "That username is already taken." });
  }
  const user = await UserModel.findByIdAndUpdate(request.session.userId, updates, { new: true }).select("email name username avatarUrl emailVerified googleId microsoftId onboarding").lean();
  if (!user) return response.status(404).json({ error: "User not found." });
  return response.json({ ...user, onboarding: onboardingResponse(user.onboarding) });
}

export async function updateAvatar(request: Request, response: Response) {
  if (!request.file) return response.status(400).json({ error: "An image file is required." });
  const uploaded = await uploadAvatar(request.file.buffer, request.session.userId!);
  const user = await UserModel.findByIdAndUpdate(request.session.userId, { avatarUrl: uploaded.secureUrl }, { new: true }).select("email name username avatarUrl emailVerified googleId microsoftId onboarding").lean();
  if (!user) return response.status(404).json({ error: "User not found." });
  return response.json({ ...user, onboarding: onboardingResponse(user.onboarding) });
}

export async function deleteAccount(request: Request, response: Response, next: (error?: unknown) => void) {
  const userId = request.session.userId!;
  const emails = await EmailModel.find({ userId }).select("_id").lean();
  const emailIds = emails.map((email) => email._id);
  const investigations = await InvestigationModel.find({ userId }).select("analysisId").lean();
  const analysisIds = investigations.map((investigation) => investigation.analysisId);
  await Promise.all([
    GmailAccountModel.deleteOne({ userId }),
    OutlookAccountModel.deleteOne({ userId }),
    CopilotConversationModel.deleteMany({ userId }),
    InvestigationModel.deleteMany({ userId }),
    AnalysisModel.deleteMany({ _id: { $in: analysisIds } }),
    EmailModel.deleteMany({ _id: { $in: emailIds } }),
  ]);
  await UserModel.deleteOne({ _id: userId });
  return request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("connect.sid");
    return response.status(204).send();
  });
}

export function logout(request: Request, response: Response, next: (error?: unknown) => void) {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("connect.sid");
    return response.status(204).send();
  });
}
