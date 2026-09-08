"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import {
  getGmailStatus,
  getGmailRealtimeAnalysisStatus,
  gmailConnectUrl,
  setGmailRealtimeAnalysis,
  type GmailStatus,
  type GmailRealtimeAnalysisStatus,
} from "@/lib/api/gmail";
import {
  getOutlookStatus,
  outlookConnectUrl,
  type OutlookStatus,
} from "@/lib/api/outlook";
import styles from "./connections.module.css";

export default function ConnectionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>();
  const [gmail, setGmail] = useState<GmailStatus>();
  const [realtime, setRealtime] = useState<GmailRealtimeAnalysisStatus>();
  const [realtimeBusy, setRealtimeBusy] = useState(false);
  const [outlook, setOutlook] = useState<OutlookStatus>();
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([getCurrentUser(), getGmailStatus(), getGmailRealtimeAnalysisStatus(), getOutlookStatus()])
      .then(([currentUser, gmailStatus, realtimeStatus, outlookStatus]) => {
        setUser(currentUser);
        setGmail(gmailStatus);
        setRealtime(realtimeStatus);
        setOutlook(outlookStatus);
      })
      .catch((reason: unknown) => {
        if (
          reason instanceof Error &&
          reason.message.includes("Authentication")
        )
          router.replace("/login");
        else
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load connections.",
          );
      });
  }, [router]);
  async function toggleRealtimeAnalysis(enabled: boolean) {
    setRealtimeBusy(true);
    setError("");
    try { setRealtime(await setGmailRealtimeAnalysis(enabled)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update real-time analysis."); }
    finally { setRealtimeBusy(false); }
  }
  const providers = [
    {
      name: "Gmail",
      status: gmail,
      connect: gmailConnectUrl(),
      note: "Read-only mailbox access for recent messages and analysis.",
    },
    {
      name: "Outlook",
      status: outlook,
      connect: outlookConnectUrl(),
      note: "Read-only Microsoft 365 mailbox access for investigation.",
    },
  ];
  return (
    <main className={`${styles.shell} shell`}>
      <AppHeader
        user={user}
        actionHref="/analyze/upload"
        actionLabel="+ Analyze email"
      />
      <section className={styles.heading}>
        <p className="kicker">CONNECTIONS</p>
        <h1>
          Bring your inboxes
          <br />
          <em>into focus.</em>
        </h1>
        <p>
          ThreatTrace only uses connected mailboxes to show messages you choose
          to investigate. Access is read-only.
        </p>
      </section>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <section className={styles.providers}>
        {providers.map((provider) => (
          <article className={styles.provider} key={provider.name}>
            <div className={styles.providerTop}>
              <span
                className={
                  provider.status?.connected
                    ? styles.connected
                    : styles.disconnected
                }
              />
              <div>
                <h2>{provider.name}</h2>
                <p>
                  {provider.status?.connected
                    ? `Connected as ${provider.status.email}`
                    : "Not connected"}
                </p>
              </div>
            </div>
            <p className={styles.note}>{provider.note}</p>
            {provider.status?.connected ? (
              <>
                <span className={styles.scope}>
                  CONNECTED · {provider.status.scopes?.length ?? 0} PERMISSIONS
                </span>
                {provider.name === "Gmail" && <label className={styles.realtimeToggle}>
                  <input type="checkbox" checked={Boolean(realtime?.enabled)} disabled={realtimeBusy} onChange={(event) => void toggleRealtimeAnalysis(event.target.checked)} />
                  <span>Enable real-time threat analysis</span>
                </label>}
                {provider.name === "Gmail" && realtime?.enabled && !realtime.watchActive && <p className={styles.watchWarning}>Watch renewal is pending.</p>}
              </>
            ) : (
              <a className={styles.connect} href={provider.connect}>
                Connect {provider.name}
              </a>
            )}
          </article>
        ))}
      </section>
      <section className={styles.security}>
        <div>
          <p className="kicker">ANALYSIS STACK</p>
          <h2>Evidence stays visible.</h2>
        </div>
        <p>
          Deterministic rules create the baseline. ML assistance, VirusTotal,
          URLScan, and Gemini add context without replacing the evidence trail.
        </p>
      </section>
    </main>
  );
}
