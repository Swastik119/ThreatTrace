export type ThreatVerdict = "SAFE" | "INCONCLUSIVE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Evidence {
  field: string;
  value: string;
  expected?: string;
  source?: string;
}

export interface Finding {
  id: string;
  type: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  evidence: Evidence[];
  scoreContribution: number;
}

export interface InvestigationAnalysis {
  riskScore: number;
  verdict: ThreatVerdict;
  confidence: number;
  findings: Finding[];
  authentication: { spf?: string; dkim?: string; dmarc?: string };
  assessmentNote?: string;
  urlIntelligence: Array<{ url: string; domain: string; category: string; decodedTarget?: string }>;
  payloadAnalysis?: Array<{ filename: string; verdict: string; sha256: string; indicators: Array<{ severity: string; description: string }> }>;
}

export interface InvestigationResult {
  id: string;
  emailId: string;
  status: "COMPLETED";
  analysis: InvestigationAnalysis;
}

export interface GmailPageContext {
  provider: "GMAIL";
  threadId?: string;
  subject?: string;
  sender?: string;
  url: string;
}

export interface GmailDiagnostic {
  observedAt: string;
  url: string;
  hash: string;
  threadId?: string;
  toolbarFound: boolean;
  subjectFound: boolean;
  senderFound: boolean;
}

export type InvestigationState =
  | { status: "idle" }
  | { status: "email-detected"; email: GmailPageContext }
  | { status: "loading"; email: GmailPageContext }
  | { status: "ready"; email: GmailPageContext; result: InvestigationResult }
  | { status: "error"; email?: GmailPageContext; message: string; retryable: boolean };
