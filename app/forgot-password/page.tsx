"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not request a password reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>V</span><div><strong>VENDRITH</strong><small>PLAYER MESSENGER</small></div></div>
        <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p className="auth-description">Enter the email address for your Vendrith Chat account. If it is eligible, Supabase will send a secure password-reset link.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {error && <p className="auth-feedback" role="alert">{error}</p>}
          {sent && <p className="auth-feedback" role="status">If an account matches this address, a reset email has been requested. Check Inbox, Spam, and Promotions.</p>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button>
        </form>
        <a className="auth-back" href="/login">Back to sign in</a>
      </section>
    </main>
  );
}
