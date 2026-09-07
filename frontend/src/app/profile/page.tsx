"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, getCurrentUser, updateAvatar, updateProfile, type CurrentUser } from "@/lib/api/auth";
import { disconnectGmail, getGmailStatus, gmailConnectUrl, type GmailStatus } from "@/lib/api/gmail";
import { disconnectOutlook, getOutlookStatus, outlookConnectUrl, type OutlookStatus } from "@/lib/api/outlook";
import { AppHeader } from "@/components/app-header";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>();
  const [gmail, setGmail] = useState<GmailStatus>();
  const [outlook, setOutlook] = useState<OutlookStatus>();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState<"gmail" | "outlook" | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    Promise.all([getCurrentUser(), getGmailStatus(), getOutlookStatus()]).then(([currentUser, gmailStatus, outlookStatus]) => { setUser(currentUser); setName(currentUser.name); setUsername(currentUser.username ?? ""); setGmail(gmailStatus); setOutlook(outlookStatus); }).catch(() => router.replace("/login"));
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try { const updated = await updateProfile({ name, username }); setUser(updated); setMessage("Profile updated."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update profile."); }
    finally { setBusy(false); }
  }

  async function changeAvatar(file?: File) {
    if (!file) return;
    setError(""); setMessage(""); setAvatarBusy(true);
    try { const updated = await updateAvatar(file); setUser(updated); setMessage("Avatar updated."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update avatar."); }
    finally { setAvatarBusy(false); }
  }

  async function disconnect(provider: "gmail" | "outlook") {
    if (!window.confirm(`Disconnect ${provider === "gmail" ? "Gmail" : "Outlook"}? ThreatTrace will no longer be able to read messages from this mailbox.`)) return;
    setError(""); setMessage(""); setConnectionBusy(provider);
    try {
      if (provider === "gmail") { await disconnectGmail(); setGmail({ connected: false }); }
      else { await disconnectOutlook(); setOutlook({ connected: false }); }
      setMessage(`${provider === "gmail" ? "Gmail" : "Outlook"} disconnected.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to disconnect ${provider}.`); }
    finally { setConnectionBusy(null); }
  }

  async function removeAccount() {
    if (!window.confirm("Delete your ThreatTrace account and all saved investigations? This cannot be undone.")) return;
    setError(""); setDeleteBusy(true);
    try { await deleteAccount(); router.replace("/"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete your account."); setDeleteBusy(false); }
  }

  return <main className={styles.page}><AppHeader user={user} actionHref="/analyze/upload" actionLabel="+ New analysis" /><section className={styles.heading}><p className="kicker">ACCOUNT PROFILE</p><h1>Your workspace identity.</h1><p>Manage your profile and connected mail providers from one place.</p></section><div className={styles.grid}><section className={styles.card}><h2>Profile details</h2>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.message}>{message}</p>}<div className={styles.avatarArea}>{user?.avatarUrl ? <img className={styles.avatar} src={user.avatarUrl} alt="Profile avatar" /> : <span className={styles.avatarFallback}>{user?.name?.slice(0, 1).toUpperCase() ?? "?"}</span>}<label className={styles.avatarButton}>{avatarBusy ? "Uploading..." : "Change avatar"}<input type="file" accept="image/*" onChange={(event) => void changeAvatar(event.target.files?.[0])} disabled={avatarBusy} /></label><small>PNG, JPG, or WEBP up to 5 MB</small></div><form onSubmit={save}><label className={styles.field}>NAME<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className={styles.field}>USERNAME<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className={styles.field}>EMAIL<input value={user?.email ?? ""} disabled /></label><button className={styles.save} disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></form></section><section className={styles.card}><h2>Connected mail</h2><div className={styles.provider}><div><strong>Gmail</strong><span>{gmail?.connected ? `Connected as ${gmail.email}` : "Not connected"}</span></div>{gmail?.connected ? <button className={styles.disconnect} onClick={() => void disconnect("gmail")} disabled={connectionBusy !== null}>{connectionBusy === "gmail" ? "Disconnecting..." : "Disconnect"}</button> : <a className={styles.connect} href={gmailConnectUrl()}>Connect Gmail</a>}</div><div className={styles.provider}><div><strong>Outlook</strong><span>{outlook?.connected ? `Connected as ${outlook.email}` : "Not connected"}</span></div>{outlook?.connected ? <button className={styles.disconnect} onClick={() => void disconnect("outlook")} disabled={connectionBusy !== null}>{connectionBusy === "outlook" ? "Disconnecting..." : "Disconnect"}</button> : <a className={styles.connect} href={outlookConnectUrl()}>Connect Outlook</a>}</div></section></div><section className={styles.danger}><div><h2>Delete account</h2><p>Remove your profile, connected mail credentials, investigations, and saved analysis data permanently.</p></div><button className={styles.deleteButton} onClick={() => void removeAccount()} disabled={deleteBusy}>{deleteBusy ? "Deleting account..." : "Delete account"}</button></section><footer><span>Evidence-first email security</span><span>PROFILE / v1</span></footer></main>;
}
