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
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
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
  closedAt: string | null;
  hasMore: boolean;
};
type PendingMessage = { conversationId: string; clientMessageId: string; body: string; replyToMessageId?: string | null };
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type Attachment = { id: string; conversation_id: string; uploader_id: string; object_path: string; original_name: string; mime_type: string; byte_size: number; created_at: string };

export default function ServerChat({ userId, email }: { userId: string; email?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading your server conversations…");
  const [failedRequest, setFailedRequest] = useState<PendingMessage | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const loadConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("chat_members").select("conversation_id,archived_at").eq("user_id", userId);
    if (membershipError) throw membershipError;
    const visibleMemberships = (memberships ?? []).filter((row: { archived_at: string | null }) => showArchived ? Boolean(row.archived_at) : !row.archived_at);
    const membershipByConversation = new Map<string, string | null>(visibleMemberships.map((row: { conversation_id: string; archived_at: string | null }): [string, string | null] => [row.conversation_id, row.archived_at]));
    const ids: string[] = Array.from(new Set<string>(visibleMemberships.map((row: { conversation_id: string }) => row.conversation_id)));
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
        supabase.from("chat_conversations").select("id,kind,title,created_at,closed_at").eq("id", id).single(),
        supabase.from("chat_members").select("user_id,role").eq("conversation_id", id),
        supabase.from("chat_messages").select("id,conversation_id,sender_id,client_message_id,body,created_at,reply_to_message_id,edited_at,is_deleted").eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50)
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
        archivedAt: membershipByConversation.get(id) ?? null,
        closedAt: conversationResult.data.closed_at ?? null,
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
  }, [userId, showArchived]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { await loadConversations(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load server conversations.");
      setStatus("Server conversation load failed.");
    } finally { setLoading(false); }
  }, [loadConversations]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (deepLinkApplied) return;
    const requestedId = new URLSearchParams(window.location.search).get("conversation");
    if (!requestedId) { setDeepLinkApplied(true); return; }
    if (conversations.some((conversation) => conversation.id === requestedId)) {
      setActiveId(requestedId);
      setDeepLinkApplied(true);
    }
  }, [conversations, deepLinkApplied]);

  // Reading is recorded server-side against the authenticated membership row.
  useEffect(() => {
    if (!activeId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    void supabase.rpc("chat_mark_conversation_read", { p_conversation_id: activeId }).then((result: { error: { message: string } | null }) => {
      const readError = result.error;
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
      .then((result: { data: unknown[] | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (result.error) setError(result.error.message);
        else setReactions((result.data ?? []) as Reaction[]);
      });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) { setAttachments([]); return; }
    let cancelled = false;
    async function loadAttachments() {
      const { data, error: attachmentError } = await createSupabaseBrowserClient()
        .from("chat_attachments")
        .select("id,conversation_id,uploader_id,object_path,original_name,mime_type,byte_size,created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (attachmentError) setError(attachmentError.message);
      else setAttachments((data ?? []) as Attachment[]);
    }
    void loadAttachments();
    return () => { cancelled = true; };
  }, [activeId]);

  async function uploadAttachment(file: File) {
    if (!active || busy) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) { setError("This file type is not allowed."); return; }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) { setError("Files must be between 1 byte and 10 MB."); return; }
    setBusy(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: preparedData, error: prepareError } = await supabase.rpc("chat_prepare_attachment", {
        p_conversation_id: active.id,
        p_original_name: file.name,
        p_mime_type: file.type,
        p_byte_size: file.size
      });
      if (prepareError) throw prepareError;
      const prepared = (preparedData as { attachment_id: string; object_path: string }[] | null)?.[0];
      if (!prepared?.attachment_id || !prepared.object_path) throw new Error("The server did not authorize this upload.");
      const { error: uploadError } = await supabase.storage.from("vendrith-chat-attachments")
        .upload(prepared.object_path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: confirmed, error: confirmError } = await supabase.rpc("chat_confirm_attachment", {
        p_attachment_id: prepared.attachment_id
      });
      if (confirmError) throw confirmError;
      if (confirmed !== true) throw new Error("The server could not confirm the uploaded file.");
      const { data, error: listError } = await supabase.from("chat_attachments")
        .select("id,conversation_id,uploader_id,object_path,original_name,mime_type,byte_size,created_at")
        .eq("conversation_id", active.id).order("created_at", { ascending: true });
      if (listError) throw listError;
      setAttachments((data ?? []) as Attachment[]);
      setStatus("Private attachment uploaded and authorized for conversation members.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this attachment.");
    } finally { setBusy(false); }
  }

  async function downloadAttachment(attachment: Attachment) {
    setError("");
    try {
      const { data, error: downloadError } = await createSupabaseBrowserClient()
        .storage.from("vendrith-chat-attachments").download(attachment.object_path);
      if (downloadError) throw downloadError;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this attachment.");
    }
  }

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
          const alreadyPresent = conversation.messages.some((message) => message.id === incoming.id);
          const messages = mergeRealtimeMessage(conversation.messages, incoming, 50);
          const isUnread = !alreadyPresent && incoming.sender_id !== userId && conversationId !== activeId;
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
      const { error: rpcError } = await createSupabaseBrowserClient().rpc(
        request.replyToMessageId ? "chat_send_message_with_reply" : "chat_send_message",
        {
          p_conversation_id: request.conversationId,
          p_client_message_id: request.clientMessageId,
          p_body: request.body,
          ...(request.replyToMessageId ? { p_reply_to_message_id: request.replyToMessageId } : {})
        }
      );
      if (rpcError) throw rpcError;
      setDraft((current) => current === request.body ? "" : current);
      setReplyTo(null);
      setFailedRequest(null);
      await loadConversations();
      setStatus("Message committed by the non-production server.");
    } catch (cause) {
      setFailedRequest(request);
      setError(cause instanceof Error ? cause.message : "The server did not confirm this message.");
    } finally { setBusy(false); }
  }

  async function editMessage(message: Message) {
    const nextBody = window.prompt("Edit your message (up to 4000 characters):", message.body);
    if (nextBody === null || !nextBody.trim()) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await createSupabaseBrowserClient().rpc("chat_edit_message", { p_message_id: message.id, p_body: nextBody });
      if (rpcError) throw rpcError;
      await loadConversations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not edit message."); }
    finally { setBusy(false); }
  }

  async function deleteMessage(message: Message) {
    if (!window.confirm("Delete this message? It will be replaced with a deletion notice.")) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await createSupabaseBrowserClient().rpc("chat_delete_message", { p_message_id: message.id });
      if (rpcError) throw rpcError;
      await loadConversations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete message."); }
    finally { setBusy(false); }
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

  async function setActiveConversationArchived(archived: boolean) {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: archiveError } = await createSupabaseBrowserClient().rpc("chat_set_conversation_archived", {
        p_conversation_id: active.id,
        p_archived: archived
      });
      if (archiveError) throw archiveError;
      await loadConversations();
      setStatus(archived ? "Conversation archived for your account. Other members keep their history." : "Conversation restored to your active list.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this conversation.");
    } finally {
      setBusy(false);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || busy) return;
    void sendMessage({ conversationId: activeId, clientMessageId: crypto.randomUUID(), body: draft, replyToMessageId: replyTo?.id ?? null });
  }

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  return <main className="backend-test-page">
    <header className="backend-test-header">
      <div><p className="auth-eyebrow">NON-PRODUCTION SERVER CHAT</p><h1>Vendrith Chat</h1><p>Messages are stored in the isolated E2E database. This is not the production game account.</p></div>
      <div className="server-chat-actions"><a href="/community">Community</a><a href="/notifications">Notifications</a><a href="/settings/account">Account</a><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button><button type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
    </header>
    <section className="backend-identity"><strong>{email ?? "Verified test player"}</strong><code>{userId}</code><span>Verified Supabase Auth identity · Non-production only</span></section>
    <section className="backend-create"><h2>Start a direct conversation</h2><form onSubmit={createConversation}><input aria-label="Recipient player UUID" placeholder="Other test player's Auth UUID" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /><button disabled={busy || !recipientId.trim()}>Create / open</button></form></section>
    <div className="backend-columns">
      <aside className="backend-conversations"><div className="backend-conversations-heading"><h2>{showArchived ? "Archived" : "Conversations"}</h2><button type="button" onClick={() => setShowArchived((current) => !current)}>{showArchived ? "Show active" : "Show archived"}</button></div>{conversations.map((conversation) => <button type="button" key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}><strong>{conversation.kind === "group" ? conversation.title || "Group conversation" : conversation.members.find((member) => member.user_id === conversation.otherUserId)?.display_name ?? `Player ${conversation.otherUserId.slice(0, 8)}`}</strong><small>{conversation.messages.at(-1)?.body ?? "No messages yet"}</small>{conversation.unreadCount > 0 && <span className="conversation-unread-count" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}</button>)}{!conversations.length && <p>{loading ? "Loading…" : "No server conversations yet."}</p>}</aside>
      <section className="backend-thread"><h2>{active ? active.kind === "group" ? active.title || "Group conversation" : active.members.find((member) => member.user_id === active.otherUserId)?.display_name ?? `Player ${active.otherUserId.slice(0, 8)}` : "Select a conversation"}</h2>
        {active && <><div className="backend-thread-tools"><p className="backend-id">Conversation ID: {active.id}{active.closedAt ? " · Closed (read-only)" : ""}</p><button type="button" onClick={() => void setActiveConversationArchived(!active.archivedAt)} disabled={busy}>{active.archivedAt ? "Restore for me" : "Archive for me"}</button></div><div className="backend-messages">{active.hasMore && <button type="button" className="backend-load-older" disabled={loadingOlder} onClick={() => void loadOlderMessages()}>{loadingOlder ? "Loading older messages…" : "Load older messages"}</button>}{active.messages.map((message) => {
          const messageReactions = reactions.filter((reaction) => reaction.message_id === message.id);
          return <article key={message.id} className={message.sender_id === userId ? "mine" : "theirs"}>
            {message.reply_to_message_id && <blockquote className="message-reply-context">{active.messages.find((item) => item.id === message.reply_to_message_id)?.body ?? "Original message"}</blockquote>}<p>{message.body}</p>
            <small>{message.edited_at ? "Edited · " : ""}{message.sender_id === userId ? "You" : active.members.find((member) => member.user_id === message.sender_id)?.display_name ?? "Other player"} · {new Date(message.created_at).toLocaleString()}</small>
            <div className="message-action-row">{!message.is_deleted && <button type="button" className="message-reply-button" onClick={() => setReplyTo(message)}>Reply</button>}{message.sender_id === userId && !message.is_deleted && Date.now() - new Date(message.created_at).getTime() <= 15 * 60 * 1000 && <><button type="button" className="message-reply-button" onClick={() => void editMessage(message)} disabled={busy}>Edit</button><button type="button" className="message-reply-button" onClick={() => void deleteMessage(message)} disabled={busy}>Delete</button></>}</div><div className="message-reactions">{["👍","❤️","😂","😮","😢","🙏"].map((emoji) => {
              const matching = messageReactions.filter((reaction) => reaction.emoji === emoji);
              const selected = matching.some((reaction) => reaction.user_id === userId);
              return <button type="button" key={emoji} className={selected ? "selected" : ""} aria-label={`React with ${emoji}`} onClick={() => void toggleReaction(message.id, emoji)}>{emoji}{matching.length > 0 && <span>{matching.length}</span>}</button>;
            })}</div>
          </article>;
        })}</div><div className="backend-attachments">{attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => void downloadAttachment(attachment)} disabled={busy}><span>{attachment.mime_type.startsWith("image/") ? "Image" : "File"} · {attachment.original_name}</span><small>{(attachment.byte_size / 1024).toFixed(1)} KB</small></button>)}</div>{!active.closedAt ? <form className="backend-composer" onSubmit={handleSend}>{replyTo && <div className="message-reply-draft"><span>Replying to: {replyTo.body.slice(0, 100)}</span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}<input aria-label="Attach a file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.currentTarget.value = ""; }} /><input aria-label="Message composer" maxLength={4000} placeholder="Write a server-backed message…" value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); }} /><button disabled={busy || !draft.trim()}>Send</button></form> : <p className="backend-status">This group is closed. Message history remains available in read-only mode.</p>}{failedRequest && <button className="backend-retry" type="button" disabled={busy} onClick={() => void sendMessage(failedRequest)}>Retry with same message ID</button>}</>}
      </section>
    </div>
    <div className="backend-status" role="status"><strong>{status}</strong>{error && <p>{error}</p>}<small>Live updates subscribe only to the selected conversation. If the connection drops, the client reconnects and reloads recent history. The server remains the source of truth.</small></div>
  </main>;
}
