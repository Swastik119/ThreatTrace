import type { EmailPageContext, GmailDiagnostic, GmailPageContext, InvestigationState, OutlookPageContext } from "./analysis";

export type ExtensionMessage =
  | { type: "GMAIL_EMAIL_DETECTED"; email: GmailPageContext }
  | { type: "GMAIL_DIAGNOSTIC"; diagnostic: GmailDiagnostic }
  | { type: "OUTLOOK_EMAIL_DETECTED"; email: OutlookPageContext }
  | { type: "OUTLOOK_DIAGNOSTIC"; diagnostic: GmailDiagnostic }
  | { type: "OPEN_INVESTIGATION"; email: EmailPageContext }
  | { type: "ANALYZE_CURRENT_EMAIL" }
  | { type: "GET_INVESTIGATION_STATE" }
  | { type: "RETRY_INVESTIGATION" };

export type ExtensionMessageResponse = { ok: true; state?: InvestigationState; diagnostic?: GmailDiagnostic } | { ok: false; error: string };
