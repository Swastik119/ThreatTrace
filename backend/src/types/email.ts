export type EmailSource = "EML" | "GMAIL" | "OUTLOOK";
export type ThreatVerdict = "SAFE" | "INCONCLUSIVE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FindingSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NormalizedAttachment {
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
}

export interface NormalizedEmail {
  messageId?: string;
  sender: { name?: string; email: string };
  recipients: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  subject: string;
  date?: Date;
  headers: Record<string, string | string[]>;
  text?: string;
  html?: string;
  urls: string[];
  attachments: NormalizedAttachment[];
  rawAttachments?: RawAttachment[];
  replyTo?: string;
  returnPath?: string;
  forwarded?: boolean;
  forwardedHeaders?: Record<string, string>;
  receivedHeaders?: string[];
  source: EmailSource;
}

export interface Evidence {
  field: string;
  value: string;
  expected?: string;
  source?: string;
}

export interface Finding {
  id: string;
  type: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  scoreContribution: number;
}

export interface ScoreExplanation {
  label: string;
  contribution: number;
  status: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  evidence?: string;
}

export interface AnalysisResult {
  riskScore: number;
  verdict: ThreatVerdict;
  confidence: number;
  findings: Finding[];
  authentication: { spf?: string; dkim?: string; dmarc?: string };
  assessmentNote?: string;
  urlIntelligence: UrlIntelligence[];
  relayPath: RelayHop[];
  probableOriginIp?: string;
  enrichment: EnrichmentResult;
  scoreExplanation: ScoreExplanation[];
  analystVerdict: {
    headline: string;
    assessment: string;
    supportingEvidence: string[];
    observations: string[];
    recommendedAction: string;
  };
  classification: ThreatClassification;
  entities: ExtractedEntities;
  ml?: MlPhishingSignal;
  mlAssistance?: MlAssistance;
  payloadAnalysis?: AttachmentPayloadAnalysis[];
}

export interface MlContribution {
  feature: string;
  impact: number;
  direction: "UP" | "DOWN";
  evidence?: string;
}

export interface MlAssistance {
  available: boolean;
  modelVersion?: string;
  mlRiskScore?: number;
  mlConfidence?: number;
  uncertainty?: number;
  effectiveWeight?: number;
  deterministicRiskScore?: number;
  deterministicConfidence?: number;
  topContributors?: MlContribution[];
  latencyMs?: number;
  reason?: string;
}

export interface ThreatClassification {
  phishing: number;
  businessEmailCompromise: number;
  credentialHarvesting: number;
  malware: number;
  invoiceFraud: number;
  spamMarketing: number;
  legitimate: number;
}

export interface ExtractedEntities {
  emails: string[];
  domains: string[];
  urls: string[];
  ips: string[];
  attachments: string[];
}

export interface RelayHop {
  hop: number;
  value: string;
  ipAddresses: string[];
}

export interface UrlIntelligence {
  url: string;
  domain: string;
  category: "DIRECT" | "TRACKING_REDIRECT" | "SHORTENER" | "IP_ADDRESS";
  decodedTarget?: string;
}

export interface EnrichmentResult {
  domains: DomainEnrichment[];
  ips: IpEnrichment[];
  urls: UrlReputation[];
  providers?: {
    virusTotal?: EnrichmentProviderStatus;
    urlScan?: EnrichmentProviderStatus;
    abuseIpDb?: EnrichmentProviderStatus;
    rdap?: EnrichmentProviderStatus;
  };
  completedAt: string;
}

export interface EnrichmentProviderStatus {
  configured: boolean;
  checked: number;
  succeeded: number;
  failed: number;
  message?: string;
  status?: "success" | "no_result" | "unauthorized" | "rate_limited" | "timeout" | "api_error";
}

export interface DomainEnrichment {
  domain: string;
  dns: { addresses: string[]; mx: string[] };
  rdap?: { registrar?: string; created?: string; expires?: string; status?: string[]; permalink?: string };
}

export interface IpReputation {
  ip: string;
  source: "AbuseIPDB";
  abuseConfidenceScore: number;
  totalReports: number;
  isWhitelisted: boolean;
  isp?: string;
  usageType?: string;
  countryCode?: string;
  domain?: string;
  lastReportedAt?: string;
  permalink?: string;
}

export interface IpRdap {
  networkName?: string;
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  registrant?: string;
  abuseContact?: string;
  country?: string;
  registered?: string;
  lastChanged?: string;
  permalink?: string;
}

export interface IpEnrichment {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  organization?: string;
  asn?: string;
  source?: "ipwho.is";
  retrievedAt?: string;
  rdap?: IpRdap;
  reputation?: IpReputation;
}

export interface UrlReputation {
  url: string;
  source: "VirusTotal" | "URLScan";
  verdict?: string;
  malicious?: number;
  suspicious?: number;
  permalink?: string;
}

// ───── Payload Analysis Types ─────

export type PayloadVerdict = "MALICIOUS" | "SUSPICIOUS" | "NO_THREAT_FOUND" | "NOT_ANALYZED" | "ANALYSIS_ERROR";

export interface PayloadIndicator {
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  description: string;
  detail?: string;
}

export interface VirusTotalFileResult {
  checked: boolean;
  found: boolean;
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  permalink?: string;
  error?: string;
}

export interface ClamAvResult {
  available: boolean;
  status: "clean" | "infected" | "error" | "unavailable";
  virus?: string;
  error?: string;
}

export interface YaraMatch {
  rule: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  matchedStrings?: string[];
}

export interface ArchiveEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  isEncrypted: boolean;
  isExecutable: boolean;
  isArchive: boolean;
}

export interface AttachmentPayloadAnalysis {
  filename: string;
  declaredContentType: string;
  detectedContentType: string;
  extension: string;
  size: number;
  sha256: string;
  sha1: string;
  md5: string;
  verdict: PayloadVerdict;
  indicators: PayloadIndicator[];
  extractedUrls: string[];
  virusTotal?: VirusTotalFileResult;
  clamAv?: ClamAvResult;
  yaraMatches: YaraMatch[];
  metadata?: {
    pdf?: { title?: string; author?: string; producer?: string; creationDate?: string; hasJavaScript: boolean; hasLaunchAction: boolean; hasAutoAction: boolean; hasEmbeddedFiles: boolean; formCount: number; suspiciousFilters: string[] };
    office?: { hasMacros: boolean; macroType?: string; hasExternalRelationships: boolean; externalUrls: string[]; hasOleObjects: boolean; hasDdeLinks: boolean; documentTitle?: string; documentAuthor?: string };
    archive?: { entries: ArchiveEntry[]; totalEntries: number; totalUncompressedSize: number; maxCompressionRatio: number; hasPathTraversal: boolean; nestingDepth: number };
    image?: { width?: number; height?: number; format?: string; hasScript?: boolean; hasAppendedData?: boolean };
  };
  extensionMismatch: boolean;
  doubleExtension: boolean;
  analyzedAt: string;
}

export interface RawAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  sha256: string;
  sha1: string;
  md5: string;
}

export interface MlPhishingSignal {
  prediction: "phishing" | "legitimate";
  confidence: number;
  phishingProbability: number;
  model: string;
}