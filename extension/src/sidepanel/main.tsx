import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import type { Finding, GmailDiagnostic, InvestigationAnalysis, InvestigationState } from "../types/analysis";
import type { ExtensionMessageResponse } from "../types/messages";
import styles from "./sidepanel.module.css";

const webUrl = import.meta.env.VITE_THREATTRACE_WEB_URL ?? "http://localhost:3000";

function colorFor(value: string) {
  if (["CRITICAL", "HIGH", "MALICIOUS"].includes(value)) return "#c5221f";
  if (["MEDIUM", "SUSPICIOUS"].includes(value)) return "#b06000";
  if (["SAFE", "LOW", "NO_THREAT_FOUND"].includes(value)) return "#188038";
  return "#087f78";
}

function Header({ ready = false }: { ready?: boolean }) {
  return <header className={styles.header}><div className={styles.brand}><span className={styles.brandMark}>◈</span><span className={styles.brandText}><strong>THREATTRACE</strong><small>EVIDENCE FIRST</small></span></div><span className={styles.status}>{ready ? "ANALYSIS READY" : "GMAIL"}</span></header>;
}

function EmailCard({ subject, sender }: { subject?: string; sender?: string }) {
  return <section className={styles.emailCard}><p className={styles.emailLabel}>CURRENT EMAIL</p><h1 className={styles.subject}>{subject || "Untitled email"}</h1>{sender && <p className={styles.sender}>From {sender}</p>}</section>;
}

function FindingCard({ finding }: { finding: Finding }) {
  const style = { "--finding-color": colorFor(finding.severity) } as CSSProperties;
  return <article className={styles.finding} style={style}><div className={styles.findingTop}><span className={styles.severity}>{finding.severity} SIGNAL</span><span className={styles.eyebrow}>+{finding.scoreContribution}</span></div><h3>{finding.title}</h3><p>{finding.description}</p>{finding.evidence.length > 0 && <details><summary>View supporting evidence</summary>{finding.evidence.map((item, index) => <div className={styles.evidenceLine} key={`${item.field}-${index}`}><strong>{item.field}{item.source ? ` · ${item.source}` : ""}</strong>{item.value}{item.expected ? ` (expected: ${item.expected})` : ""}</div>)}</details>}</article>;
}

function Authentication({ analysis }: { analysis: InvestigationAnalysis }) {
  const entries = [["SPF", analysis.authentication.spf], ["DKIM", analysis.authentication.dkim], ["DMARC", analysis.authentication.dmarc]];
  return <section className={styles.section}><div className={styles.sectionHeader}><h2>Authentication</h2><span>HEADER SIGNALS</span></div><div className={styles.dataCard}>{entries.map(([name, value]) => <div className={styles.dataLine} key={name}><span>{name}</span><strong className={value?.toLowerCase().includes("pass") ? styles.pass : value ? undefined : styles.unknown}>{value || "Not available"}</strong></div>)}</div></section>;
}

function Urls({ analysis }: { analysis: InvestigationAnalysis }) {
  if (!analysis.urlIntelligence.length) return null;
  return <section className={styles.section}><div className={styles.sectionHeader}><h2>URLs</h2><span>{analysis.urlIntelligence.length} ANALYZED</span></div><div className={styles.dataCard}>{analysis.urlIntelligence.map((item) => <div className={styles.listItem} key={item.url}><code title={item.url}>{item.url}</code><small>{item.domain} · {item.category.replaceAll("_", " ")}</small></div>)}</div></section>;
}

function Attachments({ analysis }: { analysis: InvestigationAnalysis }) {
  if (!analysis.payloadAnalysis?.length) return null;
  return <section className={styles.section}><div className={styles.sectionHeader}><h2>Attachments</h2><span>{analysis.payloadAnalysis.length} ANALYZED</span></div><div className={styles.dataCard}>{analysis.payloadAnalysis.map((item) => <div className={styles.listItem} key={item.sha256}><div className={styles.attachmentName}>{item.filename}</div><div className={styles.attachmentMeta} style={{ color: colorFor(item.verdict) }}>{item.verdict.replaceAll("_", " ")}</div>{item.indicators.slice(0, 2).map((indicator, index) => <small key={index}>{indicator.severity} · {indicator.description}</small>)}</div>)}</div></section>;
}

function ReadyView({ state, openFull }: { state: Extract<InvestigationState, { status: "ready" }>; openFull: () => void }) {
  const { analysis } = state.result;
  const riskStyle = { "--risk-color": colorFor(analysis.verdict), "--score": analysis.riskScore } as CSSProperties;
  return <><Header ready /><main className={styles.content}><EmailCard subject={state.email.subject} sender={state.email.sender} /><section className={styles.scoreCard} style={riskStyle}><div className={styles.ring}><div className={styles.ringInner}><strong>{analysis.riskScore}</strong><span>/ 100</span></div></div><div className={styles.riskCopy}><p className={styles.verdict}>{analysis.verdict} RISK</p><h1>{analysis.riskScore >= 60 ? "Review before acting." : analysis.riskScore >= 30 ? "Proceed with caution." : "No major signals found."}</h1><p className={styles.confidence}>{Math.round(analysis.confidence * 100)}% CONFIDENCE</p></div></section><section className={styles.section}><div className={styles.sectionHeader}><h2>Why this result</h2><span>{analysis.findings.length} SIGNAL{analysis.findings.length === 1 ? "" : "S"}</span></div>{analysis.findings.length ? analysis.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />) : <p className={styles.empty}>No significant threats were detected in the available evidence.</p>}</section>{analysis.assessmentNote && <p className={styles.assessment}>{analysis.assessmentNote}</p>}<Authentication analysis={analysis} /><Urls analysis={analysis} /><Attachments analysis={analysis} /><button className={styles.fullLink} onClick={openFull}>OPEN FULL INVESTIGATION ↗</button></main></>;
}

function SidePanel() {
  const [state, setState] = useState<InvestigationState>({ status: "idle" });
  const [diagnostic, setDiagnostic] = useState<GmailDiagnostic>();
  const refresh = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GET_INVESTIGATION_STATE" }) as ExtensionMessageResponse;
    if (response.ok && response.state) { setState(response.state); setDiagnostic(response.diagnostic); }
  }, []);
  useEffect(() => { void refresh(); const listener = () => void refresh(); chrome.storage.onChanged.addListener(listener); return () => chrome.storage.onChanged.removeListener(listener); }, [refresh]);
  const retry = async () => { await chrome.runtime.sendMessage({ type: "RETRY_INVESTIGATION" }); await refresh(); };
  const analyze = async () => { await chrome.runtime.sendMessage({ type: "ANALYZE_CURRENT_EMAIL" }); await refresh(); };
  const connect = async () => { await chrome.tabs.create({ url: `${webUrl}/connections` }); };
  const openFull = async () => { if (state.status === "ready") await chrome.tabs.create({ url: `${webUrl}/investigations/${state.result.id}` }); };

  if (state.status === "ready") return <div className={styles.shell}><ReadyView state={state} openFull={() => void openFull()} /></div>;
  if (state.status === "loading") return <div className={styles.shell}><Header /><main className={styles.content}><div className={styles.loadingCard}><div className={styles.scanner} /><h1>Investigating this email</h1><p>ThreatTrace is collecting evidence from the original message.</p><div className={styles.checks}><span>✓ Email structure</span><span>✓ Sender and authentication</span><span>◌ URLs and infrastructure</span><span>◌ Attachment evidence</span></div></div></main></div>;
  if (state.status === "email-detected") return <div className={styles.shell}><Header /><main className={styles.content}><EmailCard subject={state.email.subject} sender={state.email.sender} /><button className={styles.primaryButton} onClick={() => void analyze()}>🛡 Analyze this email</button><p className={styles.helper}>ThreatTrace will inspect the original message through your connected Gmail account. No email content is sent from the browser.</p></main></div>;
  if (state.status === "error") return <div className={styles.shell}><Header /><main className={styles.content}><div className={styles.error}><h1>Investigation needs attention</h1><p>{state.message}</p><button className={styles.primaryButton} onClick={() => void connect()}>Sign in / connect Gmail</button><button className={styles.secondaryButton} onClick={() => void retry()}>Try again</button></div></main></div>;
  return <div className={styles.shell}><Header /><main className={styles.content}><div className={styles.loadingCard}><div className={styles.brandMark} style={{ margin: "0 auto 14px" }}>◈</div><h1>Ready when you are</h1><p>Open an email in Gmail. ThreatTrace will recognize it automatically.</p></div><details className={styles.debug}><summary>Debug information</summary><pre>{JSON.stringify(diagnostic ?? "No Gmail email detected yet", null, 2)}</pre></details></main></div>;
}

createRoot(document.getElementById("root")!).render(<SidePanel />);
