"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type SessionRecord = { id: string; created_at: string; updated_at: string; refreshed_at: string | null; user_agent: string | null; tag: string | null; is_current: boolean };
const DELETE_CONFIRMATION = "DELETE MY VENDRITH ACCOUNT";

export default function AccountSettingsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [dangerError, setDangerError] = useState("");
  const [notice, setNotice] = useState("Loading account security details…");
  const [privacyNotice, setPrivacyNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([supabase.auth.getUser(), supabase.auth.getSession(), supabase.rpc("chat_list_my_sessions")]).then(([userResult, sessionResult, sessionsResult]) => {
      if (cancelled) return;
      if (userResult.error) setError(userResult.error.message);
      else {
        setEmail(userResult.data.user?.email ?? "");
        setAccountId(userResult.data.user?.id ?? "");
      }
      if (sessionResult.error) setError(sessionResult.error.message);
      else setExpiresAt(sessionResult.data.session?.expires_at ?? null);
      if (sessionsResult.error) setError(sessionsResult.error.message);
      else setSessions((sessionsResult.data ?? []) as SessionRecord[]);
      setNotice("Account and authorized session list loaded.");
    });
    return () => { cancelled = true; };
  }, [supabase]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12) { setError("Use at least 12 characters for the new password."); return; }
    if (password !== confirmPassword) { setError("The password confirmation does not match."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(""); setConfirmPassword("");
      setNotice("Password updated for this account.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update password."); }
    finally { setBusy(false); }
  }

  async function signOutOtherSessions() {
    if (busy) return;
    if (!window.confirm("Sign out every other session for this account? This current session will remain signed in.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
      if (signOutError) throw signOutError;
      setNotice("Other refresh-token sessions were revoked. Previously issued access tokens can remain valid until they expire.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke other sessions."); }
    finally { setBusy(false); }
  }

  async function reauthenticate() {
    if (!email || !reauthPassword) throw new Error("Enter your current password to continue.");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: reauthPassword });
    if (authError || !data.user || data.user.id !== accountId) throw new Error("Password verification failed for this account.");
    return data.session;
  }

  async function exportPersonalData() {
    if (exporting || deleting) return;
    setExporting(true); setDangerError(""); setPrivacyNotice("");
    try {
      const session = await reauthenticate();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Non-Production export service is not configured.");
      const response = await fetch(`${url}/functions/v1/export-chat-account`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.error === "string" ? payload.error : "Personal data export is unavailable.";
        throw new Error(message === "export_rate_limited" ? "Please wait 10 minutes before requesting another export." : message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fallbackDate = new Date().toISOString().slice(0, 10);
      const filename = match?.[1] ?? `vendrith-chat-export-${fallbackDate}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setPrivacyNotice("Your Chat-only personal data export was prepared. Private attachment files, other users’ messages, credentials, and World of Vendrith data are excluded.");
      setReauthPassword("");
    } catch (cause) { setDangerError(cause instanceof Error ? cause.message : "Could not export personal data."); }
    finally { setExporting(false); }
  }

  async function requestAccountDeletion() {
    if (exporting || deleting) return;
    if (deleteConfirmation !== DELETE_CONFIRMATION) {
      setDangerError(`Type exactly: ${DELETE_CONFIRMATION}`); return;
    }
    if (!window.confirm("This will hide your Chat identity immediately, revoke conversation access, and queue deletion of your Chat Auth account. Shared messages remain as Deleted account. Continue?")) return;
    setDeleting(true); setDangerError(""); setPrivacyNotice("");
    try {
      await reauthenticate();
      const { data, error: invokeError } = await supabase.functions.invoke("delete-chat-account", {
        body: { confirmation: DELETE_CONFIRMATION },
      });
      if (invokeError) throw new Error(invokeError.message || "Account deletion request could not be submitted.");
      if (data?.status !== "queued" && data?.status !== "completed") throw new Error("The deletion service returned an unexpected status.");
      await supabase.auth.signOut();
      setPrivacyNotice("Your deletion request was accepted. You have been signed out. The trusted Non-Production worker will finish cleanup; shared messages remain labelled Deleted account.");
      window.location.assign("/login");
    } catch (cause) { setDangerError(cause instanceof Error ? cause.message : "Could not request account deletion."); }
    finally { setDeleting(false); }
  }

  return <main className="account-settings-page">
    <header className="community-header"><div><p className="auth-eyebrow">VENDRITH CHAT SECURITY</p><h1>Account & sessions</h1><p>Manage the password, personal data, and active sign-in sessions for this Non-Production Chat account.</p></div><div className="community-header-actions"><a href="/">Back to chat</a></div></header>
    <section className="account-settings-card">
      <h2>Current account</h2><p><strong>Email:</strong> {email || "Unavailable"}</p><p><strong>Current session expires:</strong> {expiresAt ? new Date(expiresAt * 1000).toLocaleString() : "Unavailable"}</p>
      <p className="community-profile-note">Session identifiers and tokens are never displayed. Device details are approximate metadata supplied by the session record.</p>
      <h3>Signed-in sessions</h3>
      <div className="account-session-list">{sessions.map((session) => <article className="account-session" key={session.id}><strong>{session.is_current ? "This device" : session.tag || "Other device"}</strong><span>{session.user_agent || "Device details unavailable"}</span><small>Started {new Date(session.created_at).toLocaleString()} · Last refreshed {session.refreshed_at ? new Date(session.refreshed_at).toLocaleString() : "Unknown"}</small>{session.is_current && <small>Current session</small>}</article>)}{sessions.length === 0 && <p>No session records were returned.</p>}</div>
      <button type="button" className="community-danger-button" disabled={busy || exporting || deleting} onClick={() => void signOutOtherSessions()}>Sign out other sessions</button>
    </section>
    <section className="account-settings-card">
      <h2>Change password</h2>
      <form className="account-password-form" onSubmit={updatePassword}>
        <label>New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <button type="submit" disabled={busy || !password || !confirmPassword}>{busy ? "Saving…" : "Update password"}</button>
      </form>
    </section>
    <section className="account-settings-card">
      <h2>Export personal data</h2>
      <p>Download a JSON copy of your Vendrith Chat profile, conversations you belong to, messages you authored, and your Chat-owned social and notification records.</p>
      <p className="community-profile-note">Other participants’ messages and private profile data, private attachment files and paths, credentials, and World of Vendrith game/editor data are excluded. A recent password check is required. Exports are limited to one every 10 minutes.</p>
      <label>Current password<input type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} /></label>
      <button type="button" disabled={exporting || deleting || !reauthPassword} onClick={() => void exportPersonalData()}>{exporting ? "Preparing export…" : "Download my data"}</button>
    </section>
    <section className="account-settings-card account-danger-zone">
      <h2>Delete Vendrith Chat account</h2>
      <p>This action is irreversible for your Chat account. Your public profile will be hidden and your conversation access revoked. Shared message history is preserved and displayed as <strong>Deleted account</strong>.</p>
      <p className="community-profile-note">Deletion is blocked if this Auth identity still owns World of Vendrith records or owns a Chat group. Transfer group ownership first. The trusted worker removes Chat-owned private data and then deletes the Chat Auth user; backup copies follow the provider’s backup expiry schedule.</p>
      <label>Type <strong>{DELETE_CONFIRMATION}</strong> to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
      <button type="button" className="community-danger-button" disabled={exporting || deleting || !reauthPassword || deleteConfirmation !== DELETE_CONFIRMATION} onClick={() => void requestAccountDeletion()}>{deleting ? "Submitting deletion request…" : "Request permanent deletion"}</button>
    </section>
    <footer className="community-status" role="status"><strong>{notice}</strong>{error && <p>{error}</p>}{privacyNotice && <p>{privacyNotice}</p>}{dangerError && <p role="alert">{dangerError}</p>}</footer>
  </main>;
}
