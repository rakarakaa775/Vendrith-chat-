"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { mergeRealtimeMessage } from "../lib/realtime-messages.mjs";
import { useChatPresence } from "../lib/use-chat-presence";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
};
type PlayerProfile = { username: string | null; display_name: string };
type GroupMember = PlayerProfile & { user_id: string; role: "owner" | "admin" | "moderator" | "member" };
type Friend = { friend_user_id: string; username: string | null; display_name: string };
type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_by: string;
  created_at: string;
  otherUserId: string;
  otherProfile: PlayerProfile;
  members: GroupMember[];
  messages: Message[];
};
type ConversationProfileRow = {
  conversation_id: string;
  user_id: string;
  username: string | null;
  display_name: string;
};
type PendingMessage = { conversationId: string; clientMessageId: string; body: string };

function playerLabel(profile: PlayerProfile) {
  return profile.username ? `@${profile.username}` : (profile.display_name || "Vendrith Player");
}

function playerHandle(profile: PlayerProfile) {
  return profile.display_name || "Display name not set";
}

export default function ServerChat({ userId, email }: { userId: string; email?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeId, setActiveId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupAddMemberId, setGroupAddMemberId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading your server conversations…");
  const [failedRequest, setFailedRequest] = useState<PendingMessage | null>(null);
  const presence = useChatPresence();

  const loadConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [membershipResult, friendsResult] = await Promise.all([
      supabase.from("chat_members").select("conversation_id").eq("user_id", userId),
      supabase.rpc("chat_list_friends")
    ]);
    if (membershipResult.error) throw membershipResult.error;
    if (friendsResult.error) throw friendsResult.error;
    setFriends((friendsResult.data ?? []) as Friend[]);
    const ids = [...new Set((membershipResult.data ?? []).map((row: { conversation_id: string }) => row.conversation_id))];
    if (!ids.length) {
      setConversations([]);
      setActiveId("");
      setStatus("No conversations yet. Create a direct chat or a group with at least two friends.");
      return;
    }

    const { data: profileRows, error: profileError } = await supabase.rpc("chat_get_conversation_profiles", {
      p_conversation_ids: ids
    });
    if (profileError) throw profileError;
    const profiles = (profileRows ?? []) as ConversationProfileRow[];
    const rows = await Promise.all(ids.map(async (id) => {
      const [conversationResult, memberResult, messageResult] = await Promise.all([
        supabase.from("chat_conversations").select("id,kind,title,created_by,created_at").eq("id", id).single(),
        supabase.from("chat_members").select("user_id,role").eq("conversation_id", id),
        supabase.from("chat_messages").select("id,conversation_id,sender_id,client_message_id,body,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50)
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const memberRows = (memberResult.data ?? []) as { user_id: string; role: GroupMember["role"] }[];
      const members: GroupMember[] = memberRows.map((member) => {
        const profile = profiles.find((row) => row.conversation_id === id && row.user_id === member.user_id);
        return {
          user_id: member.user_id,
          role: member.role,
          username: profile?.username ?? null,
          display_name: profile?.display_name ?? "Vendrith Player"
        };
      });
      const other = members.find((member) => member.user_id !== userId);
      const conversation = conversationResult.data as { id: string; kind: "direct" | "group"; title: string | null; created_by: string; created_at: string };
      return {
        ...conversation,
        otherUserId: other?.user_id ?? "unknown",
        otherProfile: {
          username: other?.username ?? null,
          display_name: other?.display_name ?? "Vendrith Player"
        },
        members,
        messages: ((messageResult.data ?? []) as Message[]).reverse()
      };
    }));
    rows.sort((a, b) => (b.messages.at(-1)?.created_at ?? b.created_at).localeCompare(a.messages.at(-1)?.created_at ?? a.created_at));
    setConversations(rows);
    setActiveId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    setStatus(`${rows.length} server-backed conversation(s) loaded.`);
  }, [userId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { await loadConversations(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load server conversations.");
      setStatus("Server conversation load failed.");
    } finally { setLoading(false); }
  }, [loadConversations]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const handleFocus = () => { void loadConversations(); };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadConversations();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`vendrith-chat:${userId}:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeId}` },
        (payload: { new: Message }) => {
          const incoming = payload.new;
          if (incoming.conversation_id !== activeId) return;
          setConversations((current) => current.map((conversation) => {
            if (conversation.id !== activeId) return conversation;
            return { ...conversation, messages: mergeRealtimeMessage(conversation.messages, incoming, 50) };
          }).sort((a, b) =>
            (b.messages.at(-1)?.created_at ?? b.created_at).localeCompare(a.messages.at(-1)?.created_at ?? a.created_at)
          ));
          setStatus("Live updates connected. New messages arrive automatically.");
        }
      )
      .subscribe((channelStatus: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED", channelError?: Error) => {
        if (channelStatus === "SUBSCRIBED") {
          setError("");
          setStatus("Live updates connected. Synchronizing recent history…");
          void loadConversations()
            .then(() => setStatus("Live updates connected. New messages arrive automatically."))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Realtime history sync failed."));
        } else if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
          setStatus("Live updates disconnected. Reconnecting…");
          if (channelError) setError(channelError.message);
        } else if (channelStatus === "CLOSED") {
          setStatus("Live updates paused.");
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [activeId, userId, loadConversations]);

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !recipientId.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await createSupabaseBrowserClient().rpc("chat_create_direct_conversation", { p_other_user_id: recipientId.trim() });
      if (rpcError) throw rpcError;
      await loadConversations();
      setActiveId(data as string);
      setRecipientId("");
      setStatus("Direct conversation created or reopened on the non-production server.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the conversation."); }
    finally { setBusy(false); }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selectedMemberIds.length < 1 || !groupTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await createSupabaseBrowserClient().rpc("chat_create_group_conversation", {
        p_title: groupTitle.trim(),
        p_member_ids: selectedMemberIds
      });
      if (rpcError) throw rpcError;
      await loadConversations();
      setActiveId(data as string);
      setGroupTitle("");
      setSelectedMemberIds([]);
      setStatus("Group conversation created. You are the owner.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the group."); }
    finally { setBusy(false); }
  }

  async function runGroupAction(action: () => Promise<{ error: { message: string } | null }>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      await loadConversations();
      setStatus(success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The group action failed."); }
    finally { setBusy(false); }
  }

  async function sendMessage(request: PendingMessage) {
    if (busy) return;
    setBusy(true);
    setError("");
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
  const currentMember = active?.members.find((member) => member.user_id === userId);
  const activeLabel = active?.kind === "group" ? (active.title || "Group conversation") : active ? playerLabel(active.otherProfile) : "Select a conversation";
  const availableGroupFriends = friends.filter((friend) => !active?.members.some((member) => member.user_id === friend.friend_user_id));

  return <main className="backend-test-page">
    <header className="backend-test-header">
      <div><p className="auth-eyebrow">NON-PRODUCTION SERVER CHAT</p><h1>Vendrith Chat</h1><p>Direct and group messages are stored in the isolated E2E database.</p></div>
      <div className="server-chat-actions"><a href="/community">Friends &amp; Community</a><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button><button type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
    </header>
    <section className="backend-identity"><strong>{email ?? "Verified test player"}</strong><code>{userId}</code><span>Verified Supabase Auth identity · Non-production only</span></section>

    <section className="backend-create">
      <h2>Start a direct conversation</h2>
      <form onSubmit={createConversation}><input aria-label="Recipient player UUID" placeholder="Other test player's Auth UUID" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} /><button disabled={busy || !recipientId.trim()}>Create / open</button></form>
    </section>

    <section className="backend-create">
      <h2>Create a group</h2>
      <p>Select one or more accepted friends. Only unblocked friends can be added.</p>
      <form onSubmit={createGroup} className="backend-group-create">
        <input aria-label="Group name" maxLength={64} placeholder="Group name" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
        <div className="backend-friend-picker">
          {friends.length === 0 && <span>No accepted friends available yet.</span>}
          {friends.map((friend) => <label key={friend.friend_user_id}>
            <input type="checkbox" checked={selectedMemberIds.includes(friend.friend_user_id)} onChange={(event) => setSelectedMemberIds((current) => event.target.checked ? [...current, friend.friend_user_id] : current.filter((id) => id !== friend.friend_user_id))} />
            {friend.display_name} <small>{friend.username ? "@" + friend.username : ""}</small>
          </label>)}
        </div>
        <button disabled={busy || !groupTitle.trim() || selectedMemberIds.length < 1}>Create group ({selectedMemberIds.length}/1 minimum)</button>
      </form>
    </section>

    <div className="backend-columns">
      <aside className="backend-conversations">
        <h2>Conversations</h2>
        {conversations.map((conversation) => {
          const label = conversation.kind === "group" ? conversation.title || "Group conversation" : playerLabel(conversation.otherProfile);
          const preview = conversation.messages.at(-1)?.body ?? "No messages yet";
          return <button type="button" key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}>
            <strong>{conversation.kind === "group" ? "▣ " : ""}{label}</strong>
            <small>{conversation.kind === "group" ? `${conversation.members.length} members` : playerHandle(conversation.otherProfile)} · {preview}</small>
          </button>;
        })}
        {!conversations.length && <p>{loading ? "Loading…" : "No server conversations yet."}</p>}
      </aside>

      <section className="backend-thread">
        <h2>{activeLabel}</h2>
        {active && <>
          <p className="backend-id">{active.kind === "group" ? `${active.members.length} members · ` : playerHandle(active.otherProfile) + " · "}Conversation ID: {active.id}</p>
          {active.kind === "group" && <section className="backend-group-members">
            <div className="backend-group-heading"><strong>Group members</strong><span>Your role: {currentMember?.role ?? "member"}</span></div>
            <div className="backend-member-list">
              {active.members.map((member) => <div key={member.user_id} className="backend-member">
                <span><strong>{member.display_name}</strong><small>@{member.username ?? "player"} · {member.role}</small></span>
                {currentMember?.role === "owner" && member.user_id !== userId && <div className="backend-member-actions">
                  <button type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_set_group_member_role", { p_conversation_id: active.id, p_member_id: member.user_id, p_role: "admin" }), "Member promoted to admin.")}>Admin</button>
                  <button type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_set_group_member_role", { p_conversation_id: active.id, p_member_id: member.user_id, p_role: "moderator" }), "Member assigned as moderator.")}>Mod</button>
                  <button type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_set_group_member_role", { p_conversation_id: active.id, p_member_id: member.user_id, p_role: "member" }), "Member role restored.")}>Member</button>
                  <button type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_set_group_member_role", { p_conversation_id: active.id, p_member_id: member.user_id, p_role: "owner" }), "Group ownership transferred.")}>Transfer</button>
                </div>}
                {["owner", "admin", "moderator"].includes(currentMember?.role ?? "") && member.user_id !== userId && member.role !== "owner" && <button className="danger" type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_remove_group_member", { p_conversation_id: active.id, p_member_id: member.user_id }), "Group member removed.")}>Remove</button>}
              </div>)}
            </div>
            {["owner", "admin", "moderator"].includes(currentMember?.role ?? "") && availableGroupFriends.length > 0 && <form className="backend-group-add" onSubmit={(event) => { event.preventDefault(); if (!groupAddMemberId) return; void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_add_group_member", { p_conversation_id: active.id, p_member_id: groupAddMemberId }), "Friend added to group."); setGroupAddMemberId(""); }}>
              <select aria-label="Friend to add" value={groupAddMemberId} onChange={(event) => setGroupAddMemberId(event.target.value)}>
                <option value="">Choose a friend to add</option>
                {availableGroupFriends.map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.display_name} {friend.username ? "(@" + friend.username + ")" : ""}</option>)}
              </select>
              <button disabled={busy || !groupAddMemberId}>Add member</button>
            </form>}
            {currentMember?.role !== "owner" && <button className="backend-leave" type="button" disabled={busy} onClick={() => void runGroupAction(() => createSupabaseBrowserClient().rpc("chat_leave_group", { p_conversation_id: active.id }), "You left the group.")}>Leave group</button>}
          </section>}
          <div className="backend-messages">
            {active.messages.map((message) => {
              const sender = active.members.find((member) => member.user_id === message.sender_id);
              const senderLabel = message.sender_id === userId ? "You" : sender ? playerLabel(sender) : "Group member";
              return <article key={message.id} className={message.sender_id === userId ? "mine" : "theirs"}>
                <p>{message.body}</p><small>{senderLabel} · {new Date(message.created_at).toLocaleString()}</small>
              </article>;
            })}
          </div>
          <form className="backend-composer" onSubmit={handleSend}><input aria-label="Message composer" maxLength={4000} placeholder="Write a server-backed message…" value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); }} /><button disabled={busy || !draft.trim()}>Send</button></form>
          {failedRequest && <button className="backend-retry" type="button" disabled={busy} onClick={() => void sendMessage(failedRequest)}>Retry with same message ID</button>}
        </>}
      </section>
    </div>
    <div className="backend-status" role="status"><strong>{status}</strong>{error && <p>{error}</p>}<small>Server authorization controls membership, role changes, and message access. Removed members lose access to the group's history.</small></div>
  </main>;
}
