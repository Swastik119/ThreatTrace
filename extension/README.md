# ThreatTrace Browser Extension — Step-by-Step Implementation Plan

## MVP implementation status

The Gmail MVP is now scaffolded as a separate Manifest V3 React/TypeScript extension. It detects an opened Gmail conversation, adds a lightweight **🛡 ThreatTrace** toolbar action, opens a side panel, and sends the Gmail conversation ID to the existing ThreatTrace backend. The backend resolves that conversation through the user's connected Gmail account, so analysis retains original raw headers and attachment bytes instead of trusting browser-scraped email content.

### Run locally

1. Start the existing backend and frontend from their respective folders.
2. In `backend/.env`, set `EXTENSION_ORIGIN` to the exact `chrome-extension://…` ID shown for the unpacked extension in `chrome://extensions`.
3. In this folder, copy `.env.example` to `.env` if your local URLs differ, then run `npm install` and `npm run build`.
4. In Chrome, enable Developer mode, choose **Load unpacked**, and select `extension/dist`.
5. Sign in to ThreatTrace and connect Gmail through the web app's Connections page. Open an email in Gmail, click the pinned ThreatTrace extension icon in Chrome, then choose **🛡 Analyze this email** in the side panel. The Gmail toolbar button is only an optional shortcut.

The initial manifest deliberately permits only Gmail and `http://localhost:4000`. Before deploying, replace that local backend host permission with the exact HTTPS ThreatTrace backend origin; do not use broad host permissions.

No API keys, Google client secrets, or threat-intelligence credentials are stored in the extension.

You are working on **ThreatTrace**, an evidence-first email threat detection and forensic intelligence platform being developed for **SIH Problem Statement 26106 — AI-Powered Email Threat Detection, Geolocation and Forensic Intelligence Platform**.

The existing project already contains a backend and frontend with email-threat analysis capabilities. Your task is to add a **browser extension** as a separate client that integrates with the existing ThreatTrace backend.

## Core Architecture

Use this architecture:

```text
Gmail / Outlook
      │
      ▼
Browser Extension
      │
      ├── Content Script
      ├── Service Worker
      ├── Side Panel UI
      └── API Client
              │
              │ HTTPS
              ▼
       ThreatTrace Backend
              │
              ├── Email/Header Analysis
              ├── URL Analysis
              ├── RDAP
              ├── PhishTank
              ├── AbuseIPDB
              ├── Attachment Analysis
              ├── ClamAV
              └── Risk/Evidence Engine
```

### Important architectural rule

The extension is a **thin client**.

Do NOT duplicate ThreatTrace's detection/intelligence logic inside the extension.

The extension should primarily:

1. Detect the current email/page.
2. Extract available information.
3. Send normalized data to the ThreatTrace backend.
4. Display the backend's evidence and risk analysis.
5. Provide links/actions to view the complete investigation.

The backend remains the source of truth for threat intelligence and analysis.

---

# STEP 1 — Inspect the Existing Repository

Before changing anything:

1. Inspect the complete repository structure.
2. Identify:

   * Backend framework
   * Frontend framework
   * Existing API routes
   * Authentication implementation
   * Existing email-analysis endpoints
   * Existing threat-intelligence modules
   * Existing TypeScript types/interfaces
   * Existing environment variables
3. Understand how the current frontend communicates with the backend.
4. Do NOT rewrite existing functionality.
5. Reuse existing APIs/types wherever practical.
6. If an API required by the extension does not exist, add it cleanly to the backend.

First produce a short implementation assessment, then begin implementation.

---

# STEP 2 — Create a Separate Extension

Create:

```text
ThreatTrace/
├── backend/
├── frontend/
└── extension/
```

The extension must remain a separate client from the existing web frontend.

Recommended technology:

* Manifest V3
* React
* TypeScript
* Vite

Use a clean structure similar to:

```text
extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── gmail.ts
│   │   ├── outlook.ts
│   │   └── extractor.ts
│   │
│   ├── adapters/
│   │   ├── gmail/
│   │   └── outlook/
│   │
│   ├── popup/
│   │   └── Popup.tsx
│   │
│   ├── sidepanel/
│   │   ├── SidePanel.tsx
│   │   └── components/
│   │       ├── RiskScore.tsx
│   │       ├── EvidenceList.tsx
│   │       ├── HeaderAnalysis.tsx
│   │       ├── URLAnalysis.tsx
│   │       └── AttachmentAnalysis.tsx
│   │
│   ├── api/
│   │   └── threattrace.ts
│   │
│   ├── types/
│   │   └── analysis.ts
│   │
│   └── utils/
│
├── public/
├── manifest.json
├── package.json
└── vite.config.ts
```

Adjust the structure if the existing repository has a better convention, but preserve separation between adapters, UI, API, and background logic.

---

# STEP 3 — Define a Normalized Email Interface

Create a provider-independent data model.

For example:

```typescript
interface EmailData {
    sender: string;
    recipients: string[];
    subject: string;
    body: string;
    headers?: Record<string, string>;
    urls: string[];
    attachments: Attachment[];
}

interface Attachment {
    filename: string;
    mimeType?: string;
    size?: number;
    id?: string;
}
```

The exact structure can be improved based on the existing backend API.

IMPORTANT:

The analysis layer must not depend directly on Gmail-specific or Outlook-specific DOM structures.

Use:

```text
Gmail Adapter
      ↓
EmailData
      ↓
ThreatTrace API
```

and eventually:

```text
Outlook Adapter
      ↓
EmailData
      ↓
ThreatTrace API
```

This makes the system extensible.

---

# STEP 4 — Implement Manifest V3

Create a proper Manifest V3 configuration.

The extension should support:

* Content scripts
* Service worker
* Side panel
* Popup
* Required permissions only
* Gmail integration initially

Do NOT request broad permissions unnecessarily.

Follow least-privilege principles.

Do NOT place any third-party API keys in the extension.

---

# STEP 5 — Build the Service Worker

The service worker should coordinate:

```text
Content Script
      ↕
Service Worker
      ↕
ThreatTrace Backend
      ↕
Side Panel
```

Responsibilities:

* Receive messages from content scripts.
* Request analysis from backend.
* Handle authentication/token retrieval.
* Handle API errors.
* Forward analysis results to UI.
* Manage extension-level state where necessary.

Keep backend communication centralized instead of having every UI component independently call the API.

---

# STEP 6 — Build Gmail Integration First

Do NOT implement Outlook first.

Implement Gmail first.

When the user opens an email in Gmail, ThreatTrace should:

1. Detect that an email is open.
2. Extract:

   * Sender
   * Recipients if available
   * Subject
   * Body
   * Links
   * Attachment metadata
   * Available headers if accessible
3. Convert the information to the normalized `EmailData` format.
4. Make a ThreatTrace analysis request.

Avoid excessive dependence on fragile Gmail DOM selectors.

Keep Gmail-specific extraction logic isolated inside:

```text
adapters/gmail/
```

or:

```text
content/gmail.ts
```

---

# STEP 7 — Add ThreatTrace Button

When an email is open, provide a visible ThreatTrace action.

Example:

```text
Gmail toolbar

Archive | Report Spam | Delete | 🛡 ThreatTrace
```

Clicking it should open the ThreatTrace side panel.

Do not attempt to redesign Gmail.

Keep the integration lightweight and unobtrusive.

---

# STEP 8 — Build the Side Panel

The main investigation UI should be a browser side panel rather than a tiny popup.

Initial UI:

```text
┌──────────────────────────────┐
│ 🛡 ThreatTrace               │
├──────────────────────────────┤
│                              │
│ HIGH RISK                    │
│ 87 / 100                     │
│                              │
│ Why?                         │
│                              │
│ 🔴 Phishing URL              │
│ 🔴 Suspicious domain         │
│ 🟠 SPF failure               │
│ 🟠 Sender mismatch           │
│                              │
│ ───────────────────────────  │
│                              │
│ SENDER                       │
│ attacker@example.com         │
│                              │
│ DOMAIN                       │
│ example.com                  │
│                              │
│ URLs                         │
│ 3 analyzed                   │
│                              │
│ ATTACHMENTS                  │
│ 1 analyzed                   │
│                              │
│ [View Full Investigation]    │
└──────────────────────────────┘
```

The UI must prioritize **evidence**, not merely the final verdict.

---

# STEP 9 — Backend Analysis API

Inspect the existing backend first.

If an appropriate email-analysis endpoint already exists, reuse it.

Otherwise implement something conceptually similar to:

```http
POST /api/analyze/email
```

Input:

```json
{
    "sender": "...",
    "recipients": [],
    "subject": "...",
    "body": "...",
    "headers": {},
    "urls": [],
    "attachments": []
}
```

Return structured evidence.

Example:

```json
{
    "riskScore": 87,
    "severity": "HIGH",
    "verdict": "SUSPICIOUS",
    "evidence": [
        {
            "type": "DOMAIN",
            "severity": "HIGH",
            "title": "Suspicious domain",
            "description": "Domain was recently registered."
        },
        {
            "type": "URL",
            "severity": "HIGH",
            "title": "Threat intelligence match",
            "description": "URL appears in phishing intelligence."
        }
    ],
    "sender": {},
    "authentication": {},
    "urls": [],
    "attachments": []
}
```

Use the existing ThreatTrace schemas if available.

---

# STEP 10 — Integrate Existing Threat Intelligence

The extension should consume results from the existing backend modules.

Relevant intelligence includes:

```text
Email Headers
    ├── SPF
    ├── DKIM
    └── DMARC

URLs
    ├── URL normalization
    ├── Redirect analysis
    ├── Domain extraction
    ├── RDAP
    ├── PhishTank
    ├── AbuseIPDB
    └── reputation checks

Attachments
    ├── MIME/type validation
    ├── SHA-256
    ├── ClamAV
    ├── macro detection
    ├── embedded URL extraction
    └── suspicious content analysis
```

Do not implement API calls to these external services directly inside the extension.

All secrets and third-party API keys remain on the backend.

---

# STEP 11 — Evidence-First Results

The UI must NOT simply say:

```text
PHISHING
```

Instead display:

```text
HIGH RISK — 87/100

Why?

🔴 Phishing URL
URL matched known phishing intelligence.

🔴 Suspicious domain
Domain was recently registered.

🟠 Authentication failure
SPF/DKIM authentication failed.

🟠 Sender mismatch
Display name differs from sender domain.
```

Each evidence item should be expandable where practical.

The user should be able to understand:

* What was detected?
* Why is it suspicious?
* What evidence supports the finding?
* Which external intelligence source contributed?
* What confidence/severity does the evidence have?

---

# STEP 12 — URL Investigation

For every extracted URL, allow the user to inspect its analysis.

Display things such as:

```text
URL Analysis

example.com/login

Risk: HIGH

PhishTank
🔴 MATCH

Domain age
🔴 8 days

IP reputation
🟠 Suspicious

Redirects
🔴 3 redirects
```

Use backend-generated evidence.

Do not fabricate missing intelligence.

If information is unavailable, display:

```text
Not available
```

rather than guessing.

---

# STEP 13 — Attachment Analysis

The extension should initially send attachment metadata or securely supported attachment data to the backend.

Do NOT implement heavy malware scanning in the browser.

Backend responsibilities:

```text
Attachment
    ↓
File identification
    ↓
SHA-256
    ↓
MIME validation
    ↓
ClamAV
    ↓
Macro detection
    ↓
Embedded URL extraction
    ↓
Suspicious content analysis
```

The UI should eventually display:

```text
📎 invoice.xlsm

Risk: CRITICAL

🔴 Contains macros
🔴 External URL detected
🟠 File extension mismatch

SHA-256
xxxxxxxx...

[View Attachment Analysis]
```

Ensure files are handled securely and avoid unnecessary permanent storage.

---

# STEP 14 — Authentication

Integrate the extension with the existing ThreatTrace authentication system.

If Google OAuth is already implemented, reuse the existing backend authentication architecture.

Desired flow:

```text
Extension
   ↓
Sign in
   ↓
ThreatTrace authentication
   ↓
Access token/session
   ↓
Authenticated API requests
```

Never hardcode:

* Google client secrets
* AbuseIPDB keys
* PhishTank credentials
* Any other private credentials

inside the extension.

---

# STEP 15 — AI Explanation Layer

If ThreatTrace already has an AI explanation layer, integrate it with the structured evidence.

Correct architecture:

```text
Detectors
    ↓
Evidence JSON
    ↓
Risk Engine
    ↓
AI Explanation
    ↓
Human-readable explanation
```

The AI must explain known evidence.

It must NOT invent:

* domains
* IP addresses
* threat-intelligence matches
* malware findings
* authentication failures
* registration dates

If a fact is not present in the evidence, don't claim it.

---

# STEP 16 — Error and Loading States

Implement polished states:

### Loading

```text
🛡 Analyzing email...

Checking:
✓ Email structure
✓ URLs
⏳ Threat intelligence
⏳ Attachments
```

### Safe

```text
LOW RISK — 8/100

No significant threats detected.
```

### Suspicious

```text
MEDIUM RISK — 52/100
```

### High risk

```text
HIGH RISK — 87/100
```

### Backend unavailable

```text
Unable to reach ThreatTrace.

Check your connection and try again.
[Retry]
```

Do not expose raw backend errors to users.

---

# STEP 17 — Full Investigation Link

The extension should be able to send the user to the existing ThreatTrace web application for detailed investigation.

Example:

```text
[View Full Investigation]
```

The web app can provide the complete:

* Evidence timeline
* Header analysis
* URL intelligence
* Attachment analysis
* Geolocation
* Threat intelligence
* Forensic details

The extension should be the **fast investigation entry point**, while the main ThreatTrace web application remains the full forensic workspace.

---

# STEP 18 — Outlook Support After Gmail

Only after Gmail works reliably, add Outlook.

Create:

```text
adapters/
├── gmail/
└── outlook/
```

Both should output:

```typescript
EmailData
```

The rest of the application should not care whether the email came from Gmail or Outlook.

---

# STEP 19 — Optional V2 Features

After the Gmail MVP is stable, consider:

### Scan current webpage

```text
🛡 Analyze Page
```

Analyze:

* Current URL
* Domain
* Redirects
* Page indicators
* Login forms
* Suspicious links

### Right-click URL analysis

```text
Right click URL
       ↓
🛡 Analyze with ThreatTrace
```

### Automatic warning

Potential future feature:

```text
⚠️ ThreatTrace detected a potentially dangerous link.
```

Do NOT implement automatic blocking initially.

Focus on evidence and user control.

---

# STEP 20 — Testing

Test the extension with:

### Email cases

1. Normal email
2. Known phishing-style email
3. Suspicious sender/domain
4. Malicious-looking URL
5. Multiple URLs
6. Email with attachment
7. Email with malformed/missing fields

### UI cases

1. Loading
2. Success
3. Safe result
4. Medium risk
5. High risk
6. API failure
7. Authentication failure
8. Empty email
9. Gmail DOM changes

### Security cases

Verify:

* No API secrets are exposed.
* No credentials are hardcoded.
* Backend validates all incoming data.
* Extension requests minimal permissions.
* Untrusted email HTML is not executed.
* Email content cannot inject arbitrary extension UI.
* URLs are treated as untrusted data.
* Attachments are treated as untrusted files.

---

# STEP 21 — Build and Development Setup

Provide scripts such as:

```bash
npm install
npm run dev
npm run build
```

The production build should generate an extension package that can be loaded through:

```text
Chrome
→ Extensions
→ Developer Mode
→ Load unpacked
→ select extension/dist
```

Document the setup in:

```text
extension/README.md
```

Include:

* Installation
* Development
* Build
* Environment variables
* Backend URL configuration
* Authentication setup
* Gmail testing
* Troubleshooting

---

# STEP 22 — Do Not Break Existing ThreatTrace

This is critical.

Before making changes:

```bash
git status
```

Do not overwrite unrelated work.

Do not refactor the existing backend/frontend unnecessarily.

Do not rename existing APIs unless absolutely necessary.

Reuse existing modules.

After implementation:

```bash
git status
npm run build
```

Run the existing backend/frontend tests if available.

Run extension build/tests separately.

---

# FINAL MVP TARGET

The first complete milestone should support this flow:

```text
User opens Gmail
       ↓
Opens an email
       ↓
Clicks 🛡 ThreatTrace
       ↓
Side panel opens
       ↓
Email information is extracted
       ↓
Normalized EmailData created
       ↓
ThreatTrace backend receives it
       ↓
Backend analyzes:
    • Headers
    • Sender
    • URLs
    • Domain
    • Threat intelligence
    • Attachments
       ↓
Risk engine calculates score
       ↓
Evidence returned
       ↓
Extension displays:

HIGH RISK — 87/100

🔴 Phishing URL
🔴 Suspicious domain
🟠 SPF failure
🟠 Sender mismatch

[View Evidence]
[View Full Investigation]
```

## Implementation Priority

Implement in this exact order:

1. Inspect existing repository.
2. Create extension project.
3. Manifest V3.
4. Service worker.
5. Shared/normalized email types.
6. ThreatTrace API client.
7. Gmail adapter.
8. Gmail email extraction.
9. ThreatTrace button.
10. Side panel.
11. Backend integration.
12. Risk/evidence UI.
13. URL analysis display.
14. Attachment analysis display.
15. Authentication.
16. AI explanation integration.
17. Testing/security hardening.
18. Documentation.
19. Outlook adapter.
20. Optional webpage/right-click scanning.

## Important Development Philosophy

Do not over-engineer the first version.

Prioritize:

**Reliable Gmail extraction → backend analysis → evidence-first UI.**

The extension should make ThreatTrace feel like a real-time security investigator embedded directly inside the user's email workflow.

Before implementing anything substantial, inspect the existing codebase and adapt this plan to the project's current architecture rather than creating duplicate systems.
