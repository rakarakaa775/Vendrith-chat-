"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
};
type Conversation = {
  id: string;
  created_at: string;
  otherUserId: string;
  messages: Message[];
};
type PendingMessage = { conversationId: string; clientMessageId: string; body: string };

export default function ServerChat({ userId, email }: { userId: string; email?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading your server conversations…");
  const [failedRequest, setFailedRequest] = useState<PendingMessage | null>(null);

  const loadConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("chat_members").select("conversation_id").eq("user_id", userId);
    if (membershipError) throw membershipError;
    const ids = [...new Set((memberships ?? []).map((row: { conversation_id: string }) => row.conversation_id))];
    if (!ids.length) {
      setConversations([]); setActiveId(""); setStatus("No conversations yet. Start one using another test player's Auth UUID."); return;
    }
    const rows = await Promise.all(ids.map(async (id) => {
      const [conversationResult, memberResult, messageResult] = await Promise.all([
        supabase.from("chat_conversations").select("id,created_at").eq("id", id).single(),
        supabase.from("chat_members").select("user_id").eq("conversation_id", id),
        supabase.from("chat_messages").select("id,conversation_id,sender_id,client_message_id,body,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50)
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const other = (memberResult.data ?? []).find((member: { user_id: string }) => member.user_id !== userId);
      return {
        id: conversationResult.data.id,
        created_at: conversationResult.data.created_at,
        otherUserId: other?.user_id ?? "unknown",
        messages: ((messageResult.data ?? []) as Message[]).reverse()
      };
    }));
    rows.sort((a, b) => (b.messages.at(-1)?.created_at ?? b.created_at).localeCompare(a.messages.at(-1)?.created_at ?? a.created_at));
    setConversations(rows);
    setActiveId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    setStatus(`${rows.length} server-backed conversation(s) loaded.`);
  }, [userId]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { await loadConversations(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load server conversations.");
      setStatus("Server conversation load failed.");
    } finally { setLoading(false); }
  }, [loadConversations]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !recipientId.trim()) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await createSupabaseBrowserClient().rpc("chat_create_direct_conversation", { p_other_user_id: recipientId.trim() });
      if (rpcError) throw rpcError;
      await loadConversations();
      setActiveId(data as string); setRecipientId("");
      setStatus("Direct conversation created or reopened on the non-production server.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the conversation."); }
    finally { setBusy(false); }
  }

  async function sendMessage(request: PendingMessage) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await createSupabaseBrowserClient().rpc("chat_send_message", {
        p_conversation_id: request.conversationId,
        p_client_message_id: request.clientMessageId,
        p_body: request.body
      });
      if (rpcError) throw rpcError;
      setDraft((current) => current === request.body ? "" : current);
      setFailedRequest(null);
      await loadConversations();
      setStatus("Message committed by the non-production server.");
    } catch (cause) {
      setFailedRequest(request);
      setError(cause instanceof Error ? cause.message : "The server did not confirm this message.");
    } finally { setBusy(false); }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || busy) return;
    void sendMessage({ conversationId: activeId, clientMessageId: crypto.randomUUID(), body: draft });
  }

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  return <main className="backend-test-page">
    <header className="backend-test-header">
      <div><p className="auth-eyebrow">NON-PRODUCTION SERVER CHAT</p><h1>Vendrith Chat</h1><p>Messages are stored in the isolated E2E database. This is not the production game account.</p></div>
      <div className="server-chat-actions"><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button><button type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
    </header>
    <section className="backend-identity"><strong>{email ?? "Verified test player"}</strong><code>{userId}</code><span>Verified Supabase Auth identity · Non-production only</span></section>
    <section className="backend-create"><h2>Start a direct conversation</h2><form onSubmit={createConversation}><input aria-label="Recipient player UUID" placeholder="Other test player's Auth UUID" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /><button disabled={busy || !recipientId.trim()}>Create / open</button></form></section>
    <div className="backend-columns">
      <aside className="backend-conversations"><h2>Conversations</h2>{conversations.map((conversation) => <button type="button" key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}><strong>Player {conversation.otherUserId.slice(0, 8)}</strong><small>{conversation.messages.at(-1)?.body ?? "No messages yet"}</small></button>)}{!conversations.length && <p>{loading ? "Loading…" : "No server conversations yet."}</p>}</aside>
      <section className="backend-thread"><h2>{active ? `Player ${active.otherUserId.slice(0, 8)}` : "Select a conversation"}</h2>
        {active && <><p className="backend-id">Conversation ID: {active.id}</p><div className="backend-messages">{active.messages.map((message) => <article key={message.id} className={message.sender_id === userId ? "mine" : "theirs"}><p>{message.body}</p><small>{message.sender_id === userId ? "You" : "Other player"} · {new Date(message.created_at).toLocaleString()}</small></article>)}</div><form className="backend-composer" onSubmit={handleSend}><input aria-label="Message composer" maxLength={4000} placeholder="Write a server-backed message…" value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); }} /><button disabled={busy || !draft.trim()}>Send</button></form>{failedRequest && <button className="backend-retry" type="button" disabled={busy} onClick={() => void sendMessage(failedRequest)}>Retry with same message ID</button>}</>}
      </section>
    </div>
    <div className="backend-status" role="status"><strong>{status}</strong>{error && <p>{error}</p>}<small>History currently loads the latest 50 messages per conversation. Refresh to check for messages from the other player; Realtime is not enabled yet.</small></div>
  </main>;
}
