"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { data: { user }, error: userError } = await createSupabaseBrowserClient().auth.getUser();
      if (userError || !user) {
        throw new Error("This reset link is invalid or has expired. Request a new reset link.");
      }
      const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not update your password. Request a new reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>V</span><div><strong>VENDRITH</strong><small>PLAYER MESSENGER</small></div></div>
        <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password</h1>
        <p className="auth-description">Set a new password for your Vendrith Chat account. Use at least 8 characters.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {error && <p className="auth-feedback" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
        <a className="auth-back" href="/login">Back to sign in</a>
      </section>
    </main>
  );
}
