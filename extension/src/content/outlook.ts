(() => {
  const buttonId = "threattrace-outlook-analyze-button";
  const lastSignatureKey = "threattrace-outlook-last-signature";
  let refreshTimer: number | undefined;
  let lastDiagnosticSignature: string | undefined;

  function text(selectors: string[]) {
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      const value = element?.innerText?.trim();
      if (value) return value.replace(/\s+/g, " ");
    }
    return undefined;
  }

  function mainElement() {
    return document.querySelector<HTMLElement>("[role='main']") ?? document.body;
  }

  function emailFromElement(element: Element) {
    const values = [element.getAttribute("email"), element.getAttribute("title"), element.getAttribute("aria-label"), element.getAttribute("data-email"), element.getAttribute("href")];
    return values.map((value) => value?.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]).find(Boolean);
  }

  function getOpenEmailContext() {
    const main = mainElement();
    const subject = text(["[role='main'] [data-automationid='subject']", "[role='main'] [aria-label^='Subject']", "[role='main'] h1", "[role='main'] h2"]);
    const sender = Array.from(main.querySelectorAll("[email], [data-email], [title], [aria-label], a[href^='mailto:']")).map(emailFromElement).find(Boolean) ?? main.innerText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    if (!subject && !sender) return undefined;
    return { provider: "OUTLOOK" as const, subject, sender, url: window.location.href };
  }

  function reportDiagnostic() {
    const main = mainElement();
    const subjectFound = Boolean(text(["[role='main'] [data-automationid='subject']", "[role='main'] [aria-label^='Subject']", "[role='main'] h1", "[role='main'] h2"]));
    const senderFound = Boolean(main.innerText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/));
    const toolbarFound = Boolean(document.querySelector("[role='toolbar']"));
    const diagnostic = { observedAt: new Date().toISOString(), url: window.location.href, hash: window.location.hash, toolbarFound, subjectFound, senderFound };
    const signature = `${window.location.href}:${toolbarFound}:${subjectFound}:${senderFound}`;
    if (signature === lastDiagnosticSignature) return;
    lastDiagnosticSignature = signature;
    void chrome.runtime.sendMessage({ type: "OUTLOOK_DIAGNOSTIC", diagnostic }).catch(() => undefined);
  }

  function notifyEmailDetected() {
    const email = getOpenEmailContext();
    if (!email) return;
    const signature = `${email.subject ?? ""}:${email.sender ?? ""}`;
    if (sessionStorage.getItem(lastSignatureKey) === signature) return;
    sessionStorage.setItem(lastSignatureKey, signature);
    void chrome.runtime.sendMessage({ type: "OUTLOOK_EMAIL_DETECTED", email }).catch(() => undefined);
  }

  function injectButton() {
    const toolbar = document.querySelector<HTMLElement>("[role='toolbar']");
    if (!toolbar || document.getElementById(buttonId)) return;
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "🛡 Analyze with ThreatTrace";
    button.setAttribute("aria-label", "Analyze this email with ThreatTrace");
    button.style.cssText = "margin-left:8px;border:1px solid #d1d5db;border-radius:16px;background:#fff;color:#174ea6;padding:6px 10px;font:500 12px Arial,sans-serif;cursor:pointer;";
    button.addEventListener("click", () => { const email = getOpenEmailContext(); if (email) void chrome.runtime.sendMessage({ type: "OPEN_INVESTIGATION", email }).catch(() => undefined); });
    toolbar.append(button);
  }

  function refresh() { reportDiagnostic(); notifyEmailDetected(); injectButton(); }
  function scheduleRefresh() { if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { refreshTimer = undefined; refresh(); }, 250); }
  new MutationObserver(scheduleRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleRefresh);
  window.addEventListener("hashchange", scheduleRefresh);
  window.setInterval(scheduleRefresh, 1000);
  refresh();
})();