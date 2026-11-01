"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } });
      if (result.error) throw result.error;
      if (mode === "sign-up" && !result.data.session) {
        setError("Registration received. Check the test email inbox to confirm your account, then sign in.");
        return;
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>V</span><div><strong>VENDRITH</strong><small>PLAYER MESSENGER</small></div></div>
        <p className="auth-eyebrow">NON-PRODUCTION TEST ENVIRONMENT</p>
        <h1>{mode === "sign-in" ? "Welcome back" : "Create a test account"}</h1>
        <p className="auth-description">Sign in with a dedicated test account. This environment is separate from your production World of Vendrith account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="auth-feedback" role="status">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create test account"}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}>{mode === "sign-in" ? "Need a test account? Create one" : "Already registered? Sign in"}</button>
      </section>
    </main>
  );
}
