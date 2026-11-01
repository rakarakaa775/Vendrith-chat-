"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
};

type ChatConversation = {
  id: string;
  created_at: string;
  otherUserId: string;
  messages: ChatMessage[];
};

type PendingMessage = { conversationId: string; clientMessageId: string; body: string };

export default function ChatBackendConsole({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading non-production conversations…");
  const [failedRequest, setFailedRequest] = useState<PendingMessage | null>(null);

  const loadConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("chat_members")
      .select("conversation_id")
      .eq("user_id", userId);
    if (membershipError) throw membershipError;

    const rows: ChatConversation[] = await Promise.all((memberships ?? []).map(async (membership: { conversation_id: string }) => {
      const [conversationResult, memberResult, messageResult] = await Promise.all([
        supabase.from("chat_conversations").select("id,created_at").eq("id", membership.conversation_id).single(),
        supabase.from("chat_members").select("user_id").eq("conversation_id", membership.conversation_id),
        supabase.from("chat_messages").select("id,conversation_id,sender_id,client_message_id,body,created_at").eq("conversation_id", membership.conversation_id).order("created_at", { ascending: true }).limit(50)
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const other = (memberResult.data ?? []).find((member: { user_id: string }) => member.user_id !== userId);
      return {
        id: conversationResult.data.id,
        created_at: conversationResult.data.created_at,
        otherUserId: other?.user_id ?? "unknown",
        messages: (messageResult.data ?? []) as ChatMessage[]
      };
    }));

    rows.sort((a, b) => {
      const aLast = a.messages.at(-1)?.created_at ?? a.created_at;
      const bLast = b.messages.at(-1)?.created_at ?? b.created_at;
      return bLast.localeCompare(aLast);
    });
    setConversations(rows);
    setActiveId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    setStatus(rows.length ? `${rows.length} server-backed conversation(s) loaded.` : "No server-backed conversations yet. Create one with another non-production test player's UUID.");
  }, [userId]);

  useEffect(() => {
    let active = true;
    void loadConversations().catch((cause) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Could not load server-backed conversations.");
        setStatus("Conversation load failed.");
      }
    });
    return () => { active = false; };
  }, [loadConversations]);

  async function handleCreateConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !recipientId.trim()) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc("chat_create_direct_conversation", { p_other_user_id: recipientId.trim() });
      if (rpcError) throw rpcError;
      const conversationId = data as string;
      setRecipientId("");
      await loadConversations();
      setActiveId(conversationId);
      setStatus("Direct conversation created or recovered on the non-production server.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the direct conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(request: PendingMessage) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcError } = await supabase.rpc("chat_send_message", {
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
      setError(cause instanceof Error ? cause.message : "Message was not confirmed by the server.");
    } finally {
      setBusy(false);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || busy) return;
    void sendRequest({ conversationId: activeId, clientMessageId: crypto.randomUUID(), body: draft });
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null;

  return (
    <main className="backend-test-page">
      <header className="backend-test-header">
        <div><p className="auth-eyebrow">NON-PRODUCTION BACKEND TEST</p><h1>Vendrith Chat · Server test console</h1><p>All operations target the isolated E2E project. No production data is used.</p></div>
        <Link href="/">Back to chat preview</Link>
      </header>
      <section className="backend-identity"><strong>Your verified Auth UUID</strong><code>{userId}</code><span>Share this UUID only with another trusted non-production tester to open a direct conversation.</span></section>
      <section className="backend-create">
        <h2>Start a direct conversation</h2>
        <form onSubmit={handleCreateConversation}><input aria-label="Recipient player UUID" placeholder="Other test player's Auth UUID" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /><button disabled={busy || !recipientId.trim()}>Create / open</button></form>
      </section>
      <div className="backend-columns">
        <aside className="backend-conversations"><h2>Conversations</h2>{conversations.map((conversation) => <button type="button" key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}><strong>Player {conversation.otherUserId.slice(0, 8)}</strong><small>{conversation.messages.at(-1)?.body ?? "No messages yet"}</small></button>)}{!conversations.length && <p>No conversations yet.</p>}</aside>
        <section className="backend-thread"><h2>{activeConversation ? `Player ${activeConversation.otherUserId.slice(0, 8)}` : "Select a conversation"}</h2>{activeConversation && <><p className="backend-id">Conversation ID: {activeConversation.id}</p><div className="backend-messages">{activeConversation.messages.map((message) => <article key={message.id} className={message.sender_id === userId ? "mine" : "theirs"}><p>{message.body}</p><small>{message.sender_id === userId ? "You" : "Other player"} · {new Date(message.created_at).toLocaleString()}</small></article>)}</div><form className="backend-composer" onSubmit={handleSend}><input aria-label="Server message composer" maxLength={4000} placeholder="Write a server-backed message…" value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); }} /><button disabled={busy || !draft.trim()}>Send to server</button></form>{failedRequest && <button className="backend-retry" type="button" disabled={busy} onClick={() => void sendRequest(failedRequest)}>Retry with same message ID</button>}</>}</section>
      </div>
      <div className="backend-status" role="status"><strong>{status}</strong>{error && <p>{error}</p>}</div>
    </main>
  );
}
