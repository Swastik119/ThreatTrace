import { apiRequest } from "./client";

export type OnboardingStatus = "in_progress" | "dismissed" | "completed";
export type OnboardingIntake = "gmail" | "outlook" | "upload";

export interface OnboardingState {
  status: OnboardingStatus;
  intake?: OnboardingIntake;
  startedAt?: string;
  dismissedAt?: string;
  completedAt?: string;
}

export interface CurrentUser { id?: string; email: string; name: string; username?: string; avatarUrl?: string; emailVerified?: boolean; googleId?: string; microsoftId?: string; onboarding?: OnboardingState; }

export function getCurrentUser() {
  return apiRequest<CurrentUser>("/api/v1/auth/me");
}

export function getOnboarding() {
  return apiRequest<OnboardingState>("/api/v1/auth/onboarding");
}

export function updateOnboarding(input: Partial<Pick<OnboardingState, "status" | "intake">>) {
  return apiRequest<OnboardingState>("/api/v1/auth/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function googleLoginUrl() {
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/auth/google`;
}

export function microsoftLoginUrl() {
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/auth/microsoft`;
}

export function logout() {
  return apiRequest<void>("/api/v1/auth/logout", { method: "POST" });
}

export function registerAccount(input: { name: string; email: string; username: string; password: string }) {
  return apiRequest<{ id: string; email: string; name: string; username: string }>("/api/v1/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function loginAccount(input: { identifier: string; password: string }) {
  return apiRequest<{ id: string; email: string; name: string; username: string }>("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function updateProfile(input: { name?: string; username?: string }) {
  return apiRequest<CurrentUser>("/api/v1/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function updateAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  return apiRequest<CurrentUser>("/api/v1/auth/profile/avatar", { method: "PATCH", body: formData });
}

export function deleteAccount() {
  return apiRequest<void>("/api/v1/auth/account", { method: "DELETE" });
}
