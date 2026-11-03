"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { mergeRealtimeMessage } from "../lib/realtime-messages.mjs";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
};
type ConversationMember = { user_id: string; role: string; username: string; display_name: string };
type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_at: string;
  otherUserId: string;
  members: ConversationMember[];
  messages: Message[];
  unreadCount: number;
  archivedAt: string | null;
  hasMore: boolean;
};
type PendingMessage = { conversationId: string; clientMessageId: string; body: string };
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

export default function ServerChat({ userId, email }: { userId: string; email?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading your server conversations…");
  const [failedRequest, setFailedRequest] = useState<PendingMessage | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const loadConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("chat_members").select("conversation_id,archived_at").eq("user_id", userId).is("archived_at", null);
    if (membershipError) throw membershipError;
    const ids = [...new Set((memberships ?? []).map((row: { conversation_id: string }) => row.conversation_id))];
    if (!ids.length) {
      setConversations([]); setActiveId(""); setStatus("No conversations yet. Start one using another test player's Auth UUID."); return;
    }
    const { data: profileRows, error: profileError } = await supabase.rpc("chat_get_conversation_profiles", {
      p_conversation_ids: ids
    });
    if (profileError) throw profileError;
    const profiles = new Map(((profileRows ?? []) as { conversation_id: string; user_id: string; username: string; display_name: string }[])
      .map((profile) => [`${profile.conversation_id}:${profile.user_id}`, profile]));

    const [rows, unreadResult] = await Promise.all([Promise.all(ids.map(async (id) => {
      const [conversationResult, memberResult, messageResult] = await Promise.all([
        supabase.from("chat_conversations").select("id,kind,title,created_at").eq("id", id).single(),
        supabase.from("chat_members").select("user_id,role").eq("conversation_id", id),
        supabase.from("chat_messages").select("id,conversation_id,sender_id,client_message_id,body,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50)
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const members = ((memberResult.data ?? []) as { user_id: string; role: string }[]).map((member) => {
        const profile = profiles.get(`${id}:${member.user_id}`);
        return { ...member, username: profile?.username ?? "player", display_name: profile?.display_name ?? `Player ${member.user_id.slice(0, 8)}` };
      });
      const other = members.find((member) => member.user_id !== userId);
      return {
        id: conversationResult.data.id,
        kind: conversationResult.data.kind as "direct" | "group",
        title: conversationResult.data.title ?? null,
        created_at: conversationResult.data.created_at,
        otherUserId: other?.user_id ?? "unknown",
        members,
        messages: ((messageResult.data ?? []) as Message[]).reverse(),
        unreadCount: 0,
        archivedAt: null,
        hasMore: (messageResult.data ?? []).length === 50
      };
    })), supabase.rpc("chat_list_unread_counts")]);
    if (unreadResult.error) throw unreadResult.error;
    const unreadByConversation = new Map(((unreadResult.data ?? []) as { conversation_id: string; unread_count: number }[]).map((row) => [row.conversation_id, Number(row.unread_count)]));
    rows.forEach((row) => { row.unreadCount = unreadByConversation.get(row.id) ?? 0; });
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

  // Reading is recorded server-side against the authenticated membership row.
  useEffect(() => {
    if (!activeId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    void supabase.rpc("chat_mark_conversation_read", { p_conversation_id: activeId }).then(({ error: readError }) => {
      if (cancelled) return;
      if (readError) {
        setError(readError.message);
        return;
      }
      setConversations((current) => current.map((item) => item.id === activeId ? { ...item, unreadCount: 0 } : item));
    });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) { setReactions([]); return; }
    let cancelled = false;
    void createSupabaseBrowserClient().from("chat_message_reactions")
      .select("id,message_id,user_id,emoji")
      .eq("conversation_id", activeId)
      .then(({ data, error: reactionError }) => {
        if (cancelled) return;
        if (reactionError) setError(reactionError.message);
        else setReactions((data ?? []) as Reaction[]);
      });
    return () => { cancelled = true; };
  }, [activeId]);

  async function toggleReaction(messageId: string, emoji: string) {
    const { error: reactionError } = await createSupabaseBrowserClient().rpc("chat_toggle_message_reaction", {
      p_message_id: messageId, p_emoji: emoji
    });
    if (reactionError) { setError(reactionError.message); return; }
    const { data, error: refreshError } = await createSupabaseBrowserClient().from("chat_message_reactions")
      .select("id,message_id,user_id,emoji").eq("conversation_id", activeId);
    if (refreshError) setError(refreshError.message);
    else setReactions((data ?? []) as Reaction[]);
  }

  // Subscribe to every visible conversation so the inbox preview and unread badges
  // stay current even while another conversation is open.
  const conversationKey = conversations.map((conversation) => conversation.id).sort().join(",");
  useEffect(() => {
    if (!conversationKey) return;
    const supabase = createSupabaseBrowserClient();
    const ids = conversationKey.split(",");
    const channels = ids.map((conversationId) => supabase
      .channel(`vendrith-chat:${userId}:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`
      }, (payload: { new: Message }) => {
        const incoming = payload.new;
        if (incoming.conversation_id !== conversationId) return;
        setConversations((current) => current.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const messages = mergeRealtimeMessage(conversation.messages, incoming, 50);
          const isUnread = incoming.sender_id !== userId && conversationId !== activeId;
          return { ...conversation, messages, unreadCount: isUnread ? conversation.unreadCount + 1 : conversation.unreadCount };
        }).sort((a, b) =>
          (b.messages.at(-1)?.created_at ?? b.created_at).localeCompare(a.messages.at(-1)?.created_at ?? a.created_at)
        ));
        if (incoming.sender_id !== userId && conversationId === activeId) {
          void supabase.rpc("chat_mark_conversation_read", { p_conversation_id: conversationId });
        }
        setStatus("Live conversation updates connected.");
      })
      .subscribe((channelStatus: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED", channelError?: Error) => {
        if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
          setStatus("Live updates disconnected. Reconnecting…");
          if (channelError) setError(channelError.message);
        }
      }));
    return () => { channels.forEach((channel) => { void supabase.removeChannel(channel); }); };
  }, [conversationKey, userId, activeId]);

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

  async function loadOlderMessages() {
    if (!active || loadingOlder || !active.hasMore) return;
    const oldest = active.messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    setError("");
    try {
      const { data, error: pageError } = await createSupabaseBrowserClient()
        .from("chat_messages")
        .select("id,conversation_id,sender_id,client_message_id,body,created_at")
        .eq("conversation_id", active.id)
        .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (pageError) throw pageError;
      const older = ((data ?? []) as Message[]).reverse();
      setConversations((current) => current.map((item) => item.id === active.id
        ? { ...item, messages: [...older, ...item.messages], hasMore: older.length === 50 }
        : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function archiveActiveConversation() {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: archiveError } = await createSupabaseBrowserClient().rpc("chat_set_conversation_archived", {
        p_conversation_id: active.id,
        p_archived: true
      });
      if (archiveError) throw archiveError;
      await loadConversations();
      setStatus("Conversation archived for your account. Other members keep their history.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive this conversation.");
    } finally {
      setBusy(false);
    }
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
      <div className="server-chat-actions"><a href="/community">Community</a><a href="/notifications">Notifications</a><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button><button type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
    </header>
    <section className="backend-identity"><strong>{email ?? "Verified test player"}</strong><code>{userId}</code><span>Verified Supabase Auth identity · Non-production only</span></section>
    <section className="backend-create"><h2>Start a direct conversation</h2><form onSubmit={createConversation}><input aria-label="Recipient player UUID" placeholder="Other test player's Auth UUID" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /><button disabled={busy || !recipientId.trim()}>Create / open</button></form></section>
    <div className="backend-columns">
      <aside className="backend-conversations"><h2>Conversations</h2>{conversations.map((conversation) => <button type="button" key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}><strong>{conversation.kind === "group" ? conversation.title || "Group conversation" : conversation.members.find((member) => member.user_id === conversation.otherUserId)?.display_name ?? `Player ${conversation.otherUserId.slice(0, 8)}`}</strong><small>{conversation.messages.at(-1)?.body ?? "No messages yet"}</small>{conversation.unreadCount > 0 && <span className="conversation-unread-count" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}</button>)}{!conversations.length && <p>{loading ? "Loading…" : "No server conversations yet."}</p>}</aside>
      <section className="backend-thread"><h2>{active ? active.kind === "group" ? active.title || "Group conversation" : active.members.find((member) => member.user_id === active.otherUserId)?.display_name ?? `Player ${active.otherUserId.slice(0, 8)}` : "Select a conversation"}</h2>
        {active && <><div className="backend-thread-tools"><p className="backend-id">Conversation ID: {active.id}</p><button type="button" onClick={() => void archiveActiveConversation()} disabled={busy}>Archive for me</button></div><div className="backend-messages">{active.hasMore && <button type="button" className="backend-load-older" disabled={loadingOlder} onClick={() => void loadOlderMessages()}>{loadingOlder ? "Loading older messages…" : "Load older messages"}</button>}{active.messages.map((message) => {
          const messageReactions = reactions.filter((reaction) => reaction.message_id === message.id);
          return <article key={message.id} className={message.sender_id === userId ? "mine" : "theirs"}>
            <p>{message.body}</p>
            <small>{message.sender_id === userId ? "You" : active.members.find((member) => member.user_id === message.sender_id)?.display_name ?? "Other player"} · {new Date(message.created_at).toLocaleString()}</small>
            <div className="message-reactions">{["👍","❤️","😂","😮","😢","🙏"].map((emoji) => {
              const matching = messageReactions.filter((reaction) => reaction.emoji === emoji);
              const selected = matching.some((reaction) => reaction.user_id === userId);
              return <button type="button" key={emoji} className={selected ? "selected" : ""} aria-label={`React with ${emoji}`} onClick={() => void toggleReaction(message.id, emoji)}>{emoji}{matching.length > 0 && <span>{matching.length}</span>}</button>;
            })}</div>
          </article>;
        })}</div><form className="backend-composer" onSubmit={handleSend}><input aria-label="Message composer" maxLength={4000} placeholder="Write a server-backed message…" value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); }} /><button disabled={busy || !draft.trim()}>Send</button></form>{failedRequest && <button className="backend-retry" type="button" disabled={busy} onClick={() => void sendMessage(failedRequest)}>Retry with same message ID</button>}</>}
      </section>
    </div>
    <div className="backend-status" role="status"><strong>{status}</strong>{error && <p>{error}</p>}<small>Live updates subscribe only to the selected conversation. If the connection drops, the client reconnects and reloads recent history. The server remains the source of truth.</small></div>
  </main>;
}
