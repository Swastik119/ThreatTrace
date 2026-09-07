import type { GmailPageContext, InvestigationResult, OutlookPageContext } from "../types/analysis";

const apiUrl = import.meta.env.VITE_THREATTRACE_API_URL ?? "http://localhost:4000";

export class ThreatTraceApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Gmail's route id is an opaque UI token, not a Gmail API id. The backend uses
 * this visible metadata only to locate the original raw message in the user's
 * already-connected Gmail account.
 */
export async function analyzeGmailConversation(email: GmailPageContext): Promise<InvestigationResult> {
  if (!email.sender || !email.subject) throw new ThreatTraceApiError("Wait for Gmail to finish loading the sender and subject, then try again.");
  const response = await fetch(`${apiUrl}/api/v1/gmail/messages/resolve-and-analyze`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: email.sender, subject: email.subject })
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & Partial<InvestigationResult>;
  if (!response.ok) {
    const message = response.status === 401
      ? "Sign in to ThreatTrace and connect Gmail before analyzing messages."
      : response.status === 409
        ? "Connect Gmail in ThreatTrace before analyzing messages."
      : payload.error ?? "ThreatTrace could not analyze this Gmail conversation.";
    throw new ThreatTraceApiError(message, response.status);
  }
  return payload as InvestigationResult;
}

export async function analyzeOutlookMessage(email: OutlookPageContext): Promise<InvestigationResult> {
  if (!email.sender || !email.subject) throw new ThreatTraceApiError("Wait for Outlook to finish loading the sender and subject, then try again.");
  const response = await fetch(`${apiUrl}/api/v1/outlook/messages/resolve-and-analyze`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: email.sender, subject: email.subject })
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & Partial<InvestigationResult>;
  if (!response.ok) {
    const message = response.status === 401
      ? "Sign in to ThreatTrace and connect Outlook before analyzing messages."
      : response.status === 409
        ? "Connect Outlook in ThreatTrace before analyzing messages."
        : payload.error ?? "ThreatTrace could not analyze this Outlook message.";
    throw new ThreatTraceApiError(message, response.status);
  }
  return payload as InvestigationResult;
}
