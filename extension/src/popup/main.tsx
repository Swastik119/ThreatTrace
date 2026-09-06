import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { GmailDiagnostic, InvestigationState } from "../types/analysis";
import type { ExtensionMessageResponse } from "../types/messages";

function Popup() {
  const [state, setState] = useState<InvestigationState>();
  const [diagnostic, setDiagnostic] = useState<GmailDiagnostic>();
  const [error, setError] = useState("");
  useEffect(() => { void chrome.runtime.sendMessage({ type: "GET_INVESTIGATION_STATE" }).then((response: ExtensionMessageResponse) => {
    if (!response.ok) { setError(response.error); return; }
    setState(response.state); setDiagnostic(response.diagnostic);
  }).catch(() => setError("The ThreatTrace service worker is unavailable.")); }, []);
  return <main style={{ fontFamily: "system-ui", minWidth: 290, padding: 16 }}>
    <strong>🛡 ThreatTrace</strong>
    <p style={{ color: "#4b5563" }}>Open an email in Gmail, then select <strong>Analyze this email</strong> in the ThreatTrace side panel.</p>
    <details>
      <summary>Debug information</summary>
      {error ? <p>{error}</p> : <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify({ state: state?.status ?? "unavailable", gmail: diagnostic ?? "No Gmail page detected yet" }, null, 2)}</pre>}
    </details>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Popup />);
