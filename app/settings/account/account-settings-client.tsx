"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { getSupabaseConfig } from "../../../lib/supabase/config";

type SessionRecord = { id: string; created_at: string; updated_at: string; refreshed_at: string | null; user_agent: string | null; tag: string | null; is_current: boolean };

export default function AccountSettingsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Loading account security details…");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([supabase.auth.getUser(), supabase.auth.getSession(), supabase.rpc("chat_list_my_sessions")]).then(([userResult, sessionResult, sessionsResult]) => {
      if (cancelled) return;
      if (userResult.error) setError(userResult.error.message);
      else setEmail(userResult.data.user?.email ?? "");
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

  async function exportAccountData() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("Preparing your private Vendrith Chat data export…");
    try {
      const config = getSupabaseConfig();
      if (!config) throw new Error("Non-Production Supabase is not configured.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in again to export account data.");
      const response = await fetch(`${config.url}/functions/v1/export-chat-account`, {
        method: "POST",
        headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 401 && payload.error === "recent_sign_in_required") throw new Error("Please sign in again, then retry the export. A recent sign-in (within 10 minutes) is required.");
        if (response.status === 429) throw new Error("An export was recently created. Please wait before requesting another one.");
        throw new Error("Your export could not be prepared. Please try again later.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `vendrith-chat-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice("Your private Chat data export has been downloaded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export account data.");
      setNotice("");
    } finally { setBusy(false); }
  }

  async function requestAccountDeletion() {
    if (busy) return;
    const confirmation = window.prompt('This permanently deletes your Vendrith Chat account data after a short processing period. Type exactly: DELETE MY VENDRITH ACCOUNT');
    if (confirmation !== "DELETE MY VENDRITH ACCOUNT") {
      if (confirmation !== null) setError("The confirmation phrase did not match. No deletion was requested.");
      return;
    }
    if (!window.confirm("Final confirmation: queue deletion of this Chat account? Shared conversation history is preserved, and the account cannot be restored.")) return;
    setBusy(true); setError(""); setNotice("Submitting your account deletion request…");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("delete-chat-account", {
        body: { confirmation },
      });
      if (invokeError) throw invokeError;
      const result = data as { status?: string; error?: string } | null;
      if (result?.status !== "queued" && result?.status !== "completed") {
        throw new Error("The deletion service did not confirm that your request was queued.");
      }
      setNotice("Your deletion request was accepted. Chat access is being revoked and trusted cleanup will finish processing.");
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign("/login?accountDeletion=queued");
    } catch (cause) {
      setNotice("");
      setError(cause instanceof Error ? cause.message : "Could not submit the account deletion request.");
    } finally { setBusy(false); }
  }

  return <main className="account-settings-page">
    <header className="community-header"><div><p className="auth-eyebrow">VENDRITH CHAT SECURITY</p><h1>Account & sessions</h1><p>Manage the password and active sign-in sessions for this Non-Production Chat account.</p></div><div className="community-header-actions"><a href="/">Back to chat</a></div></header>
    <section className="account-settings-card">
      <h2>Current account</h2><p><strong>Email:</strong> {email || "Unavailable"}</p><p><strong>Current session expires:</strong> {expiresAt ? new Date(expiresAt * 1000).toLocaleString() : "Unavailable"}</p>
      <p className="community-profile-note">Session identifiers and tokens are never displayed. Device details are approximate metadata supplied by the session record.</p>
      <h3>Signed-in sessions</h3>
      <div className="account-session-list">{sessions.map((session) => <article className="account-session" key={session.id}><strong>{session.is_current ? "This device" : session.tag || "Other device"}</strong><span>{session.user_agent || "Device details unavailable"}</span><small>Started {new Date(session.created_at).toLocaleString()} · Last refreshed {session.refreshed_at ? new Date(session.refreshed_at).toLocaleString() : "Unknown"}</small>{session.is_current && <small>Current session</small>}</article>)}{sessions.length === 0 && <p>No session records were returned.</p>}</div>
      <button type="button" className="community-danger-button" disabled={busy} onClick={() => void signOutOtherSessions()}>Sign out other sessions</button>
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
      <h2>Your data</h2>
      <p>Download a JSON copy of your Chat-owned profile, authored messages, memberships, social relationships, notifications, and related records. Other people’s private data, private attachment bytes, credentials, and World of Vendrith game data are excluded.</p>
      <button type="button" disabled={busy} onClick={() => void exportAccountData()}>{busy ? "Please wait…" : "Download my Chat data"}</button>
    </section>
    <section className="account-settings-card">
      <h2>Delete Vendrith Chat account</h2>
      <p>This queues permanent deletion of your Chat account. Your Chat profile is hidden and membership access is revoked immediately; trusted cleanup removes eligible Chat-owned data and the Auth account. Shared conversation history is retained for other participants.</p>
      <p className="community-profile-note">Deletion is blocked if this Auth identity is referenced by World of Vendrith data or if you still own a group. Sign in again first if your last sign-in was more than 10 minutes ago.</p>
      <button type="button" className="community-danger-button" disabled={busy} onClick={() => void requestAccountDeletion()}>{busy ? "Please wait…" : "Permanently delete Chat account"}</button>
    </section>
    <footer className="community-status" role="status"><strong>{notice}</strong>{error && <p>{error}</p>}</footer>
  </main>;
}
