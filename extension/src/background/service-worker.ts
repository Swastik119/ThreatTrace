import { analyzeGmailConversation, ThreatTraceApiError } from "../api/threattrace";
import type { GmailDiagnostic, InvestigationState } from "../types/analysis";
import type { ExtensionMessage, ExtensionMessageResponse } from "../types/messages";

const stateKey = "investigation-state";
const diagnosticKey = "gmail-diagnostic";

async function getState(): Promise<InvestigationState> {
  const stored = await chrome.storage.session.get(stateKey);
  return (stored[stateKey] as InvestigationState | undefined) ?? { status: "idle" };
}

async function setState(state: InvestigationState) {
  await chrome.storage.session.set({ [stateKey]: state });
}

async function getDiagnostic(): Promise<GmailDiagnostic | undefined> {
  const stored = await chrome.storage.session.get(diagnosticKey);
  return stored[diagnosticKey] as GmailDiagnostic | undefined;
}

async function openSidePanel(tabId?: number) {
  if (tabId !== undefined) await chrome.sidePanel.open({ tabId });
}

async function startInvestigation(email: Extract<ExtensionMessage, { type: "OPEN_INVESTIGATION" }>['email']) {
  await setState({ status: "loading", email });
  if (!email.sender || !email.subject) {
    await setState({ status: "error", email, message: "Gmail is still loading this email. Wait a moment for its sender and subject, then retry.", retryable: true });
    return;
  }
  try {
    const result = await analyzeGmailConversation(email);
    await setState({ status: "ready", email, result });
  } catch (error) {
    const message = error instanceof ThreatTraceApiError ? error.message : "Unable to reach ThreatTrace. Check your connection and try again.";
    await setState({ status: "error", email, message, retryable: true });
  }
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse: (response: ExtensionMessageResponse) => void) => {
  void (async () => {
    try {
      if (message.type === "GMAIL_EMAIL_DETECTED") {
        await setState({ status: "email-detected", email: message.email });
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "GMAIL_DIAGNOSTIC") {
        await chrome.storage.session.set({ [diagnosticKey]: message.diagnostic });
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "OPEN_INVESTIGATION") {
        await openSidePanel(sender.tab?.id);
        await startInvestigation(message.email);
        sendResponse({ ok: true, state: await getState() });
        return;
      }
      if (message.type === "ANALYZE_CURRENT_EMAIL") {
        const state = await getState();
        const email = "email" in state ? state.email : undefined;
        if (!email) throw new Error("Open an email in Gmail first.");
        await startInvestigation(email);
        sendResponse({ ok: true, state: await getState() });
        return;
      }
      if (message.type === "GET_INVESTIGATION_STATE") {
        sendResponse({ ok: true, state: await getState(), diagnostic: await getDiagnostic() });
        return;
      }
      if (message.type === "RETRY_INVESTIGATION") {
        const state = await getState();
        const email = "email" in state ? state.email : undefined;
        if (!email) throw new Error("Open a Gmail email before retrying.");
        await startInvestigation(email);
        sendResponse({ ok: true, state: await getState() });
        return;
      }
      sendResponse({ ok: false, error: "Unsupported extension message." });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unexpected extension error." });
    }
  })();
  return true;
});
