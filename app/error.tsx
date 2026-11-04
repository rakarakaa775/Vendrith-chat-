"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Do not emit error messages, request payloads, tokens, or user content.
    // A deployment-level log can correlate this digest with the runtime event.
    // eslint-disable-next-line no-console
    console.error("[vendrith-chat] route_error", { digest: error.digest ?? null });
  }, [error.digest]);

  return (
    <main className="auth-status" role="alert" aria-live="assertive">
      <p className="auth-eyebrow">VENDRITH CHAT</p>
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. Your saved conversation history remains on the server.</p>
      <button type="button" onClick={() => reset()}>Try again</button>
      <a href="/">Return to chat</a>
    </main>
  );
}
