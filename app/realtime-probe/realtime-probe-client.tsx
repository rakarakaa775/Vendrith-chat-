"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function RealtimeProbeClient({ userId }: { userId: string }) {
  const [conversationId, setConversationId] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [eventCount, setEventCount] = useState(0);
  const [lastEventAt, setLastEventAt] = useState("");
  const [error, setError] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  async function stop() {
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) await createSupabaseBrowserClient().removeChannel(channel);
    setStatus("Stopped");
  }

  async function start() {
    setError("");
    setEventCount(0);
    setLastEventAt("");
    if (!UUID_PATTERN.test(conversationId.trim())) {
      setError("Enter a valid conversation UUID.");
      return;
    }
    await stop();
    const targetId = conversationId.trim();
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`vendrith-nonmember-probe:${userId}:${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${targetId}`,
      }, () => {
        setEventCount((count) => count + 1);
        setLastEventAt(new Date().toLocaleTimeString());
      });
    channelRef.current = channel;
    setStatus("Connecting…");
    channel.subscribe((channelStatus: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED", channelError?: Error) => {
      setStatus(channelStatus);
      if (channelError) setError(channelError.message);
    });
  }

  useEffect(() => () => {
    const channel = channelRef.current;
    if (channel) void createSupabaseBrowserClient().removeChannel(channel);
  }, []);

  return (
    <main className="auth-page" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>
      <p className="auth-eyebrow">NON-PRODUCTION SECURITY DIAGNOSTIC</p>
      <h1>Realtime membership probe</h1>
      <p>Signed-in Auth UUID: <code>{userId}</code></p>
      <p>Enter a conversation UUID that this account does not belong to. This page listens only for INSERT events and records event metadata, never message contents.</p>
      <label htmlFor="probe-conversation">Target conversation UUID</label>
      <input id="probe-conversation" value={conversationId} onChange={(event) => setConversationId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" spellCheck={false} style={{ width: "100%", margin: "8px 0 14px", padding: 12 }} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void start()}>Start subscription</button>
        <button type="button" onClick={() => void stop()}>Stop subscription</button>
      </div>
      <section aria-live="polite" style={{ marginTop: 24, padding: 16, border: "1px solid currentColor", borderRadius: 12 }}>
        <h2>Probe result</h2>
        <p>Channel status: <strong>{status}</strong></p>
        <p>INSERT events received: <strong>{eventCount}</strong></p>
        <p>Last event time: <strong>{lastEventAt || "None"}</strong></p>
        {error && <p role="alert">Error: {error}</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>How to interpret</h2>
        <ol>
          <li>Sign in as the third test account (not a member of the target conversation).</li>
          <li>Start the subscription and wait until the channel status is SUBSCRIBED.</li>
          <li>Ask one of the two conversation members to send a uniquely identifiable test message.</li>
          <li>Wait 30 seconds. The expected non-member result is zero INSERT events.</li>
          <li>Repeat while signed in as a member of that conversation. The positive control should receive the INSERT event.</li>
        </ol>
        <p><strong>Important:</strong> SUBSCRIBED means the WebSocket channel joined; it does not prove row access. The decisive observation is whether a non-member receives an INSERT event. Run the positive member control too, so a broken connection is not mistaken for successful authorization.</p>
        <p><a href="/">Return to Vendrith Chat</a></p>
      </section>
    </main>
  );
}
