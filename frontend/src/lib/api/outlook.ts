import { apiRequest } from "./client";

export interface OutlookMessage { id: string; threadId?: string; from?: string; to?: string; subject: string; date?: string; snippet?: string; }
export interface OutlookStatus { connected: boolean; email?: string; scopes?: string[]; }

export function getOutlookStatus() { return apiRequest<OutlookStatus>("/api/v1/outlook/status"); }
export function listOutlookMessages() { return apiRequest<OutlookMessage[]>("/api/v1/outlook/messages"); }
export function analyzeOutlookMessage(id: string) { return apiRequest<{ id: string }>(`/api/v1/outlook/messages/${encodeURIComponent(id)}/analyze`, { method: "POST" }); }
export function outlookConnectUrl() { return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/outlook/connect`; }
export function disconnectOutlook() { return apiRequest<void>("/api/v1/outlook/connection", { method: "DELETE" }); }
