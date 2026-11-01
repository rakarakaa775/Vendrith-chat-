"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmationPending(false);

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        window.location.assign("/");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.assign("/");
        return;
      }

      setConfirmationPending(true);
      setNotice(
        "If this address can be registered, Supabase will send a confirmation email. If you already have an account, sign in or use Forgot password. Check Spam and Promotions too."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setResending(true);
    setError("");
    setNotice("");
    try {
      const { error: resendError } = await createSupabaseBrowserClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (resendError) throw resendError;
      setNotice("If a confirmation is still required, a new email has been requested. Check your inbox and Spam folder.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not request another confirmation email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>V</span><div><strong>VENDRITH</strong><small>PLAYER MESSENGER</small></div></div>
        <p className="auth-eyebrow">NON-PRODUCTION TEST ENVIRONMENT</p>
        <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-description">
          Use your email address and a password of at least 8 characters. This test environment is separate from the production World of Vendrith account.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="auth-feedback" role="alert">{error}</p>}
          {notice && <p className="auth-feedback" role="status">{notice}</p>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
        </form>
        {confirmationPending && (
          <button className="auth-switch" type="button" disabled={resending} onClick={resendConfirmation}>
            {resending ? "Requesting email…" : "Resend confirmation email"}
          </button>
        )}
        {mode === "sign-in" && <a className="auth-switch" href="/forgot-password">Forgot password?</a>}
        <button className="auth-switch" type="button" onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError("");
          setNotice("");
          setConfirmationPending(false);
        }}>
          {mode === "sign-in" ? "Need an account? Create one" : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}
