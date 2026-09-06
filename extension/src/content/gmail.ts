(() => {
  const buttonId = "threattrace-analyze-button";
  const lastSignatureKey = "threattrace-last-signature";
  let refreshTimer: number | undefined;
  let lastDiagnosticSignature: string | undefined;

  function getThreadId() {
    const route = window.location.hash.slice(1).split("/").filter(Boolean);
    const candidate = route.at(-1);
    // Gmail routes such as #inbox/FMfcgz... identify a conversation. Inbox alone does not.
    return route.length >= 2 && candidate && /^[a-zA-Z0-9]+$/.test(candidate) ? candidate : undefined;
  }

  function getOpenEmailContext() {
    const threadId = getThreadId();
    if (!threadId) return undefined;
    const subject = document.querySelector<HTMLElement>("h2.hP")?.innerText?.trim();
    const sender = document.querySelector<HTMLElement>(".gD[email]")?.getAttribute("email") ?? undefined;
    return { provider: "GMAIL" as const, threadId, subject, sender, url: window.location.href };
  }

  function notifyEmailDetected() {
    const email = getOpenEmailContext();
    if (!email) return;
    const signature = `${email.threadId}:${email.subject ?? ""}:${email.sender ?? ""}`;
    if (sessionStorage.getItem(lastSignatureKey) === signature) return;
    sessionStorage.setItem(lastSignatureKey, signature);
    void chrome.runtime.sendMessage({ type: "GMAIL_EMAIL_DETECTED", email }).catch((error: unknown) => console.debug("[ThreatTrace] Could not save Gmail context", error));
  }

  function reportDiagnostic(toolbarFound: boolean) {
    const diagnostic = {
      observedAt: new Date().toISOString(),
      url: window.location.href,
      hash: window.location.hash,
      threadId: getThreadId(),
      toolbarFound,
      subjectFound: Boolean(document.querySelector("h2.hP")),
      senderFound: Boolean(document.querySelector(".gD[email]"))
    };
    const signature = `${diagnostic.hash}:${diagnostic.threadId ?? ""}:${toolbarFound}:${diagnostic.subjectFound}:${diagnostic.senderFound}`;
    if (signature === lastDiagnosticSignature) return;
    lastDiagnosticSignature = signature;
    console.debug("[ThreatTrace] Gmail diagnostic", diagnostic);
    void chrome.runtime.sendMessage({ type: "GMAIL_DIAGNOSTIC", diagnostic }).catch((error: unknown) => console.debug("[ThreatTrace] Could not save diagnostic", error));
  }

  function injectButton() {
    const toolbar = document.querySelector<HTMLElement>("div[role='toolbar']");
    reportDiagnostic(Boolean(toolbar));
    if (!toolbar || document.getElementById(buttonId)) return;
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "🛡 Analyze with ThreatTrace";
    button.setAttribute("aria-label", "Analyze this email with ThreatTrace (optional shortcut)");
    button.style.cssText = "margin-left:8px;border:1px solid #dadce0;border-radius:16px;background:#fff;color:#174ea6;padding:6px 10px;font:500 12px Arial,sans-serif;cursor:pointer;";
    button.addEventListener("click", () => {
      const email = getOpenEmailContext();
      if (email) void chrome.runtime.sendMessage({ type: "OPEN_INVESTIGATION", email }).catch((error: unknown) => console.debug("[ThreatTrace] Could not start investigation", error));
    });
    toolbar.append(button);
  }

  function refresh() {
    notifyEmailDetected();
    injectButton();
  }

  function scheduleRefresh() {
    if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = undefined;
      refresh();
    }, 150);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleRefresh);
  refresh();
})();
