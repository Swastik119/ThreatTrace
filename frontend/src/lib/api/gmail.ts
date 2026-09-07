import { apiRequest } from "./client";

export interface GmailMessage { id: string; threadId?: string; from?: string; to?: string; subject: string; date?: string; snippet?: string; }
export interface GmailStatus { connected: boolean; email?: string; scopes?: string[]; }

export function getGmailStatus() { return apiRequest<GmailStatus>("/api/v1/gmail/status"); }
export function listGmailMessages() { return apiRequest<GmailMessage[]>("/api/v1/gmail/messages"); }
export function analyzeGmailMessage(id: string) { return apiRequest<{ id: string }>(`/api/v1/gmail/messages/${encodeURIComponent(id)}/analyze`, { method: "POST" }); }
export function gmailConnectUrl() { return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/gmail/connect`; }
export function disconnectGmail() { return apiRequest<void>("/api/v1/gmail/connection", { method: "DELETE" }); }
