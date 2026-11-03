"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AccountSettingsClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Loading account security details…");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]).then(([userResult, sessionResult]) => {
      if (cancelled) return;
      if (userResult.error) setError(userResult.error.message);
      else setEmail(userResult.data.user?.email ?? "");
      if (sessionResult.error) setError(sessionResult.error.message);
      else setExpiresAt(sessionResult.data.session?.expires_at ?? null);
      setNotice("Current authenticated session loaded.");
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

  return <main className="account-settings-page">
    <header className="community-header"><div><p className="auth-eyebrow">VENDRITH CHAT SECURITY</p><h1>Account & sessions</h1><p>Manage the password and active sign-in sessions for this Non-Production Chat account.</p></div><div className="community-header-actions"><a href="/">Back to chat</a></div></header>
    <section className="account-settings-card">
      <h2>Current account</h2><p><strong>Email:</strong> {email || "Unavailable"}</p><p><strong>Current session expires:</strong> {expiresAt ? new Date(expiresAt * 1000).toLocaleString() : "Unavailable"}</p>
      <p className="community-profile-note">For privacy, session tokens are never displayed. This page shows the current session only; Supabase client Auth does not provide a safe browser API to enumerate every device session.</p>
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
    <footer className="community-status" role="status"><strong>{notice}</strong>{error && <p>{error}</p>}</footer>
  </main>;
}
