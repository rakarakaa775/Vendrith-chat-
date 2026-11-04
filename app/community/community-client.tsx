"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  discoverable: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  avatar_path?: string | null;
};
type SearchUser = { user_id: string; username: string; display_name: string };
type Friend = { friend_user_id: string; username: string; display_name: string; friends_since: string };
type FriendRequest = {
  request_id: string;
  other_user_id: string;
  username: string;
  display_name: string;
  direction: "incoming" | "outgoing";
  created_at: string;
};
type BlockedUser = { blocked_user_id: string; username: string; display_name: string; blocked_at: string };
type Presence = { friend_user_id: string; is_online: boolean; last_seen_at: string | null };
type GroupMember = { user_id: string; role: "owner" | "admin" | "moderator" | "member"; username: string; display_name: string };
type GroupConversation = { id: string; title: string; description: string; avatar_url: string | null; closed_at: string | null; created_at: string; members: GroupMember[] };
type GroupReport = { report_id: string; target_user_id: string | null; message_id: string | null; category: string; details: string; created_at: string };
type ModerationEvent = { id: string; actor_id: string; report_id: string | null; target_user_id: string | null; action: string; note: string; created_at: string };
type GroupInvitation = { invitation_id: string; conversation_id: string; group_title: string; group_description: string; inviter_id: string; inviter_username: string; inviter_display_name: string; invitee_id: string; invitee_username: string; invitee_display_name: string; direction: "incoming" | "outgoing"; created_at: string };
type Tab = "discover" | "friends" | "requests" | "blocked" | "groups" | "profile";

const tabs: { id: Tab; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "blocked", label: "Blocked" },
  { id: "groups", label: "Groups" },
  { id: "profile", label: "My profile" }
];

export default function CommunityClient({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("discover");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberId, setGroupMemberId] = useState("");
  const [reportsByGroup, setReportsByGroup] = useState<Record<string, GroupReport[]>>({});
  const [auditByGroup, setAuditByGroup] = useState<Record<string, ModerationEvent[]>>({});
  const [reviewGroupId, setReviewGroupId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Loading your community…");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const refresh = useCallback(async () => {
    setError("");
    const [profileResult, friendsResult, requestsResult, blockedResult, presenceResult, groupsResult, invitationsResult] = await Promise.all([
      supabase.rpc("chat_get_my_profile"),
      supabase.rpc("chat_list_friends"),
      supabase.rpc("chat_list_friend_requests"),
      supabase.rpc("chat_list_blocked_users"),
      supabase.rpc("chat_list_friend_presence"),
      supabase.from("chat_conversations").select("id,title,description,avatar_url,closed_at,created_at").eq("kind", "group").order("created_at", { ascending: false }),
      supabase.rpc("chat_list_group_invitations")
    ]);
    const failed = [profileResult, friendsResult, requestsResult, blockedResult, presenceResult, groupsResult, invitationsResult].find((item) => item.error);
    if (failed?.error) throw failed.error;

    const ownProfile = (profileResult.data ?? null) as Profile | null;
    setProfile(ownProfile);
    if (ownProfile) {
      setUsername(ownProfile.username ?? "");
      setDisplayName(ownProfile.display_name ?? "");
      setDiscoverable(Boolean(ownProfile.discoverable));
      setShowOnline(Boolean(ownProfile.show_online_status));
      setShowLastSeen(Boolean(ownProfile.show_last_seen));
    }
    setFriends((friendsResult.data ?? []) as Friend[]);
    setRequests((requestsResult.data ?? []) as FriendRequest[]);
    setBlocked((blockedResult.data ?? []) as BlockedUser[]);
    setPresence((presenceResult.data ?? []) as Presence[]);
    setGroupInvitations((invitationsResult.data ?? []) as GroupInvitation[]);
    const groupRows = (groupsResult.data ?? []) as { id: string; title: string; description: string; avatar_url: string | null; closed_at: string | null; created_at: string }[];
    const expandedGroups = await Promise.all(groupRows.map(async (group) => {
      const [membersResult, profilesResult] = await Promise.all([
        supabase.from("chat_members").select("user_id,role").eq("conversation_id", group.id),
        supabase.rpc("chat_get_conversation_profiles", { p_conversation_ids: [group.id] })
      ]);
      if (membersResult.error) throw membersResult.error;
      if (profilesResult.error) throw profilesResult.error;
      const profiles = new Map(((profilesResult.data ?? []) as { user_id: string; username: string; display_name: string }[]).map((item) => [item.user_id, item]));
      const members = ((membersResult.data ?? []) as { user_id: string; role: GroupMember["role"] }[]).map((member) => ({
        ...member,
        username: profiles.get(member.user_id)?.username ?? "player",
        display_name: profiles.get(member.user_id)?.display_name ?? "Vendrith player"
      }));
      return { ...group, title: group.title || "Untitled group", description: group.description || "", members };
    }));
    setGroups(expandedGroups);
    setNotice("Community data is up to date.");
  }, [supabase]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "requests") setTab("requests");
    void refresh().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not load community data.");
      setNotice("Community data could not be loaded.");
    });
    void supabase.rpc("chat_presence_heartbeat");
    const heartbeat = window.setInterval(() => {
      void supabase.rpc("chat_presence_heartbeat");
    }, 45000);
    return () => window.clearInterval(heartbeat);
  }, [refresh, supabase]);

  async function perform(key: string, action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The community action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function searchPlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || query.trim().length < 2) return;
    setBusy("search");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("chat_search_users", {
        p_query: query.trim(),
        p_limit: 20
      });
      if (rpcError) throw rpcError;
      setResults((data ?? []) as SearchUser[]);
      setNotice(`${data?.length ?? 0} discoverable player(s) found.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Player search failed.");
    } finally {
      setBusy("");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform("profile", async () => {
      const { data, error: rpcError } = await supabase.rpc("chat_upsert_profile", {
        p_username: username.trim().toLowerCase(),
        p_display_name: displayName.trim(),
        p_discoverable: discoverable
      });
      if (rpcError) throw rpcError;
      setProfile(data as Profile);
      const { error: privacyError } = await supabase.rpc("chat_set_presence_privacy", {
        p_show_online_status: showOnline,
        p_show_last_seen: showLastSeen
      });
      if (privacyError) throw privacyError;
    }, "Your Vendrith Chat profile and privacy settings were saved.");
  }

  async function startConversation(otherUserId: string) {
    await perform(`message:${otherUserId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_create_direct_conversation", {
        p_other_user_id: otherUserId
      });
      if (rpcError) throw rpcError;
      window.location.assign("/");
    }, "Opening your conversation…");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupTitle.trim() || !groupMemberId || busy) return;
    await perform("create-group", async () => {
      const { error: rpcError } = await supabase.rpc("chat_create_group_conversation", {
        p_title: groupTitle.trim(),
        p_member_ids: [groupMemberId]
      });
      if (rpcError) throw rpcError;
      setGroupTitle("");
      setGroupMemberId("");
    }, "Group conversation created.");
  }

  async function reportGroupMember(groupId: string, memberId: string) {
    const details = window.prompt("Describe the issue (optional, up to 1000 characters):");
    if (details === null) return;
    await perform(`report:${groupId}:${memberId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_submit_group_report", {
        p_conversation_id: groupId,
        p_reported_user_id: memberId,
        p_message_id: null,
        p_category: "other",
        p_details: details.slice(0, 1000)
      });
      if (rpcError) throw rpcError;
    }, "Group report submitted privately to moderators.");
  }

  async function loadGroupReports(groupId: string) {
    setBusy(`reports:${groupId}`);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("chat_list_group_reports", { p_conversation_id: groupId });
      if (rpcError) throw rpcError;
      setReportsByGroup((current) => ({ ...current, [groupId]: (data ?? []) as GroupReport[] }));
      setReviewGroupId(groupId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load group reports.");
    } finally {
      setBusy("");
    }
  }

  async function loadModerationHistory(groupId: string) {
    setBusy(`audit:${groupId}`);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("chat_list_group_moderation_events", { p_conversation_id: groupId });
      if (rpcError) throw rpcError;
      setAuditByGroup((current) => ({ ...current, [groupId]: (data ?? []) as ModerationEvent[] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load moderation history.");
    } finally { setBusy(""); }
  }

  async function resolveGroupReport(groupId: string, reportId: string, decision: "dismiss" | "remove_member") {
    await perform(`resolve-report:${reportId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_resolve_group_report", {
        p_report_id: reportId,
        p_decision: decision,
        p_note: decision === "dismiss" ? "Reviewed by group moderation." : "Member removed after report review."
      });
      if (rpcError) throw rpcError;
      const { data, error: listError } = await supabase.rpc("chat_list_group_reports", { p_conversation_id: groupId });
      if (listError) throw listError;
      setReportsByGroup((current) => ({ ...current, [groupId]: (data ?? []) as GroupReport[] }));
    }, decision === "dismiss" ? "Report dismissed." : "Reported member removed.");
  }

  async function editGroupMetadata(group: GroupConversation) {
    const nextTitle = window.prompt("Group name (1–64 characters):", group.title);
    if (nextTitle === null) return;
    const nextDescription = window.prompt("Group description (up to 500 characters):", group.description);
    if (nextDescription === null) return;
    await perform(`group-metadata:${group.id}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_update_group_metadata", {
        p_conversation_id: group.id, p_title: nextTitle.trim(),
        p_description: nextDescription.trim(), p_avatar_url: group.avatar_url
      });
      if (rpcError) throw rpcError;
    }, "Group details updated.");
  }

  async function transferGroupOwnership(groupId: string, memberId: string) {
    const confirmed = window.confirm("Transfer group ownership? You will become an admin.");
    if (!confirmed) return;
    await perform(`transfer-owner:${groupId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_set_group_member_role", {
        p_conversation_id: groupId, p_member_id: memberId, p_role: "owner"
      });
      if (rpcError) throw rpcError;
    }, "Group ownership transferred.");
  }

  async function inviteGroupMember(groupId: string) {
    if (!groupMemberId || busy) return;
    await perform(`invite-group:${groupId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_create_group_invitation", {
        p_conversation_id: groupId, p_invitee_id: groupMemberId
      });
      if (rpcError) throw rpcError;
      setGroupMemberId("");
    }, "Group invitation sent.");
  }

  async function respondGroupInvitation(invitationId: string, accept: boolean) {
    await perform(`respond-invitation:${invitationId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_respond_group_invitation", {
        p_invitation_id: invitationId, p_accept: accept
      });
      if (rpcError) throw rpcError;
    }, accept ? "Group invitation accepted." : "Group invitation declined.");
  }

  async function cancelGroupInvitation(invitationId: string) {
    await perform(`cancel-invitation:${invitationId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_cancel_group_invitation", {
        p_invitation_id: invitationId
      });
      if (rpcError) throw rpcError;
    }, "Group invitation cancelled.");
  }

  async function uploadProfileAvatar(file: File) {
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "";
    if (!extension || file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }
    await perform("avatar", async () => {
      const path = `profiles/${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("vendrith-chat-avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.rpc("chat_set_profile_avatar", { p_avatar_path: path });
      if (profileError) throw profileError;
    }, "Profile avatar updated.");
  }

  async function addGroupMember(groupId: string) {
    if (!groupMemberId || busy) return;
    await perform(`add-group-member:${groupId}`, async () => {
      const { error: rpcError } = await supabase.rpc("chat_add_group_member", {
        p_conversation_id: groupId,
        p_member_id: groupMemberId
      });
      if (rpcError) throw rpcError;
      setGroupMemberId("");
    }, "Player added to group.");
  }

  const friendIds = new Set(friends.map((friend) => friend.friend_user_id));
  const incoming = requests.filter((request) => request.direction === "incoming");
  const outgoing = requests.filter((request) => request.direction === "outgoing");
  const presenceByUser = new Map(presence.map((item) => [item.friend_user_id, item]));

  return (
    <main className="community-page">
      <header className="community-header">
        <div>
          <p className="auth-eyebrow">VENDRITH SOCIAL</p>
          <h1>Community</h1>
          <p>Find players, manage friendships, and control your visibility.</p>
        </div>
        <div className="community-header-actions">
          <a href="/">Back to chat</a>
          <button type="button" onClick={() => void refresh().catch((cause) => setError(cause.message))}>Refresh</button>
        </div>
      </header>

      <nav className="community-tabs" aria-label="Community sections">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
            {item.id === "requests" && incoming.length > 0 && <span>{incoming.length}</span>}
          </button>
        ))}
      </nav>

      <section className="community-panel">
        {tab === "discover" && (
          <>
            <div className="community-section-title"><div><h2>Find players</h2><p>Search by public username or display name. Email addresses are never shown.</p></div></div>
            <form className="community-search" onSubmit={searchPlayers}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={40} placeholder="Search username or display name…" aria-label="Search players" />
              <button type="submit" disabled={busy === "search" || query.trim().length < 2}>{busy === "search" ? "Searching…" : "Search"}</button>
            </form>
            <div className="community-list">
              {results.map((player) => {
                const isFriend = friendIds.has(player.user_id);
                const request = requests.find((item) => item.other_user_id === player.user_id);
                const isBlocked = blocked.some((item) => item.blocked_user_id === player.user_id);
                return (
                  <article className="community-person" key={player.user_id}>
                    <div className="community-avatar">{(player.display_name || player.username).slice(0, 1).toUpperCase()}</div>
                    <div className="community-person-copy"><strong>{player.display_name}</strong><span>@{player.username}</span></div>
                    <div className="community-person-actions">
                      {isFriend ? <button type="button" onClick={() => void startConversation(player.user_id)} disabled={Boolean(busy)}>Message</button>
                        : isBlocked ? <span className="community-muted">Blocked</span>
                        : request ? <span className="community-muted">{request.direction === "incoming" ? "Request received" : "Request sent"}</span>
                        : <button type="button" onClick={() => void perform(`request:${player.user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_send_friend_request", { p_recipient_id: player.user_id }); if (rpcError) throw rpcError; }, "Friend request sent.")} disabled={Boolean(busy)}>Add friend</button>}
                      {!isBlocked && <button className="community-subtle-button" type="button" onClick={() => void perform(`block:${player.user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_block_user", { p_other_user_id: player.user_id }); if (rpcError) throw rpcError; }, "Player blocked.")} disabled={Boolean(busy)}>Block</button>}
                    </div>
                  </article>
                );
              })}
              {results.length === 0 && <p className="community-empty">Search for a player to see discoverable profiles.</p>}
            </div>
          </>
        )}

        {tab === "friends" && (
          <>
            <div className="community-section-title"><div><h2>Your friends</h2><p>{friends.length} friend(s) in your Vendrith Chat list.</p></div></div>
            <div className="community-list">
              {friends.map((friend) => {
                const status = presenceByUser.get(friend.friend_user_id);
                return <article className="community-person" key={friend.friend_user_id}>
                  <div className="community-avatar">{friend.display_name.slice(0, 1).toUpperCase()}</div>
                  <div className="community-person-copy"><strong>{friend.display_name}</strong><span>@{friend.username} · <i className={status?.is_online ? "presence-online" : "presence-offline"} /> {status?.is_online ? "Online" : "Offline"}</span></div>
                  <div className="community-person-actions">
                    <button type="button" onClick={() => void startConversation(friend.friend_user_id)} disabled={Boolean(busy)}>Message</button>
                    <button className="community-subtle-button" type="button" onClick={() => void perform(`remove:${friend.friend_user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_remove_friend", { p_other_user_id: friend.friend_user_id }); if (rpcError) throw rpcError; }, "Friend removed.")} disabled={Boolean(busy)}>Remove</button>
                    <button className="community-danger-button" type="button" onClick={() => void perform(`block:${friend.friend_user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_block_user", { p_other_user_id: friend.friend_user_id }); if (rpcError) throw rpcError; }, "Player blocked.")} disabled={Boolean(busy)}>Block</button>
                  </div>
                </article>;
              })}
              {friends.length === 0 && <p className="community-empty">You have no friends yet. Find players in Discover.</p>}
            </div>
          </>
        )}

        {tab === "requests" && (
          <>
            <div className="community-section-title"><div><h2>Friend requests</h2><p>Accept or decline incoming requests, or cancel requests you sent.</p></div></div>
            <h3 className="community-subheading">Incoming ({incoming.length})</h3>
            <div className="community-list">
              {incoming.map((request) => <article className="community-person" key={request.request_id}>
                <div className="community-avatar">{request.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-person-copy"><strong>{request.display_name}</strong><span>@{request.username}</span></div>
                <div className="community-person-actions">
                  <button type="button" onClick={() => void perform(`accept:${request.request_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_respond_friend_request", { p_request_id: request.request_id, p_accept: true }); if (rpcError) throw rpcError; }, "Friend request accepted.")} disabled={Boolean(busy)}>Accept</button>
                  <button className="community-subtle-button" type="button" onClick={() => void perform(`decline:${request.request_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_respond_friend_request", { p_request_id: request.request_id, p_accept: false }); if (rpcError) throw rpcError; }, "Friend request declined.")} disabled={Boolean(busy)}>Decline</button>
                </div>
              </article>)}
              {incoming.length === 0 && <p className="community-empty">No incoming requests.</p>}
            </div>
            <h3 className="community-subheading">Sent ({outgoing.length})</h3>
            <div className="community-list">
              {outgoing.map((request) => <article className="community-person" key={request.request_id}>
                <div className="community-avatar">{request.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-person-copy"><strong>{request.display_name}</strong><span>@{request.username}</span></div>
                <div className="community-person-actions"><button className="community-subtle-button" type="button" onClick={() => void perform(`cancel:${request.request_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_cancel_friend_request", { p_request_id: request.request_id }); if (rpcError) throw rpcError; }, "Friend request cancelled.")} disabled={Boolean(busy)}>Cancel request</button></div>
              </article>)}
              {outgoing.length === 0 && <p className="community-empty">No outgoing requests.</p>}
            </div>
          </>
        )}

        {tab === "blocked" && (
          <>
            <div className="community-section-title"><div><h2>Blocked players</h2><p>Blocked players cannot discover you, send requests, or start new direct conversations.</p></div></div>
            <div className="community-list">
              {blocked.map((player) => <article className="community-person" key={player.blocked_user_id}>
                <div className="community-avatar">{player.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-person-copy"><strong>{player.display_name}</strong><span>@{player.username}</span></div>
                <div className="community-person-actions"><button type="button" onClick={() => void perform(`unblock:${player.blocked_user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_unblock_user", { p_other_user_id: player.blocked_user_id }); if (rpcError) throw rpcError; }, "Player unblocked.")} disabled={Boolean(busy)}>Unblock</button></div>
              </article>)}
              {blocked.length === 0 && <p className="community-empty">You have no blocked players.</p>}
            </div>
          </>
        )}

        {tab === "groups" && (
          <>
            <div className="community-section-title"><div><h2>Group invitations</h2><p>Accept invitations from friends or cancel invitations you sent.</p></div></div>
            <div className="community-list">
              {groupInvitations.map((invitation) => <article className="community-group-card" key={invitation.invitation_id}>
                <strong>{invitation.group_title}</strong>
                <p>{invitation.direction === "incoming" ? `Invited by ${invitation.inviter_display_name} (@${invitation.inviter_username})` : `Invitation sent to ${invitation.invitee_display_name} (@${invitation.invitee_username})`}</p>
                <small>{new Date(invitation.created_at).toLocaleString()}</small>
                <div className="community-person-actions">
                  {invitation.direction === "incoming" ? <><button type="button" onClick={() => void respondGroupInvitation(invitation.invitation_id, true)} disabled={Boolean(busy)}>Accept</button><button className="community-subtle-button" type="button" onClick={() => void respondGroupInvitation(invitation.invitation_id, false)} disabled={Boolean(busy)}>Decline</button></> : <button className="community-subtle-button" type="button" onClick={() => void cancelGroupInvitation(invitation.invitation_id)} disabled={Boolean(busy)}>Cancel invitation</button>}
                </div>
              </article>)}
              {groupInvitations.length === 0 && <p className="community-empty">No pending group invitations.</p>}
            </div>
            <div className="community-section-title"><div><h2>Group conversations</h2><p>Create a group with a friend and manage its member roles.</p></div></div>
            <form className="community-search community-group-create" onSubmit={createGroup}>
              <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} maxLength={60} placeholder="Group name…" aria-label="Group name" required />
              <select value={groupMemberId} onChange={(event) => setGroupMemberId(event.target.value)} aria-label="Choose first group member" required>
                <option value="">Choose a friend…</option>
                {friends.map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.display_name} (@{friend.username})</option>)}
              </select>
              <button type="submit" disabled={Boolean(busy) || !groupTitle.trim() || !groupMemberId}>Create group</button>
            </form>
            <div className="community-list">
              {groups.map((group) => {
                const myRole = group.members.find((member) => member.user_id === userId)?.role ?? "member";
                const canManage = myRole === "owner" || myRole === "admin";
                const canModerate = canManage || myRole === "moderator";
                return <article className="community-group-card" key={group.id}>
                  <div className="community-group-heading"><div><strong>{group.title}</strong><span>{group.members.length} members · Your role: {myRole}{group.closed_at ? " · Closed" : ""}</span>{group.description && <p>{group.description}</p>}</div><div>{(myRole === "owner" || myRole === "admin") && !group.closed_at && <button className="community-subtle-button" type="button" onClick={() => void editGroupMetadata(group)} disabled={Boolean(busy)}>Edit details</button>}{myRole === "owner" && !group.closed_at && <button className="community-danger-button" type="button" onClick={() => { if (window.confirm("Close this group for everyone? Members will keep read access, but new messages will be blocked.")) void perform(`close-group:${group.id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_close_group", { p_conversation_id: group.id }); if (rpcError) throw rpcError; }, "Group closed. Members retain read access."); }} disabled={Boolean(busy)}>Close group</button>}<button className="community-subtle-button" type="button" onClick={() => void perform(`leave-group:${group.id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_leave_group", { p_conversation_id: group.id }); if (rpcError) throw rpcError; }, "You left the group.")} disabled={Boolean(busy)}>Leave group</button></div></div>
                  {group.members.map((member) => <div className="community-group-member" key={member.user_id}>
                    <span>{member.display_name} <small>@{member.username}</small></span>
                    <strong>{member.role}</strong>
                    {member.user_id !== userId && <div className="community-person-actions">
                      {myRole === "owner" && <button className="community-subtle-button" type="button" onClick={() => void transferGroupOwnership(group.id, member.user_id)} disabled={Boolean(busy)}>Transfer ownership</button>}{myRole === "owner" && (["admin", "moderator", "member"] as const).filter((role) => role !== member.role).map((role) => <button className="community-subtle-button" key={role} type="button" onClick={() => void perform(`role:${group.id}:${member.user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_set_group_member_role", { p_conversation_id: group.id, p_member_id: member.user_id, p_role: role }); if (rpcError) throw rpcError; }, `Member role changed to ${role}.`)} disabled={Boolean(busy)}>Make {role}</button>)}
                      {canModerate && <button className="community-danger-button" type="button" onClick={() => void perform(`remove-member:${group.id}:${member.user_id}`, async () => { const { error: rpcError } = await supabase.rpc("chat_remove_group_member", { p_conversation_id: group.id, p_member_id: member.user_id }); if (rpcError) throw rpcError; }, "Group member removed.")} disabled={Boolean(busy)}>Remove</button>}
                      <button className="community-subtle-button" type="button" onClick={() => void reportGroupMember(group.id, member.user_id)} disabled={Boolean(busy)}>Report</button>
                    </div>}
                  </div>)}
                  {canModerate && <div className="community-group-add">
                    <select value={groupMemberId} onChange={(event) => setGroupMemberId(event.target.value)} aria-label={`Choose a friend to add to ${group.title}`}>
                      <option value="">Add a friend…</option>
                      {friends.filter((friend) => !group.members.some((member) => member.user_id === friend.friend_user_id)).map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.display_name}</option>)}
                    </select>
                    <button type="button" onClick={() => void inviteGroupMember(group.id)} disabled={Boolean(busy) || !groupMemberId}>Invite friend</button>
                  </div>}
                  {canModerate && <div className="community-group-review">
                    <button className="community-subtle-button" type="button" onClick={() => void loadGroupReports(group.id)} disabled={Boolean(busy)}>Review reports</button><button className="community-subtle-button" type="button" onClick={() => void loadModerationHistory(group.id)} disabled={Boolean(busy)}>Audit history</button>
                    {(auditByGroup[group.id] ?? []).length > 0 && <div className="community-report-list"><h3>Moderation history</h3>{auditByGroup[group.id].map((event) => <div className="community-report" key={event.id}><strong>{event.action}</strong><p>{event.note || "No note recorded."}</p><small>{event.actor_id.slice(0, 8)} → {event.target_user_id?.slice(0, 8) ?? "group"} · {new Date(event.created_at).toLocaleString()}</small></div>)}</div>}{reviewGroupId === group.id && <div className="community-report-list">
                      {(reportsByGroup[group.id] ?? []).map((report) => <div className="community-report" key={report.report_id}>
                        <strong>{report.category}</strong><p>{report.details || "No additional details."}</p><small>{report.target_user_id ? `Reported player: ${report.target_user_id.slice(0, 8)}` : "Message report"} · {new Date(report.created_at).toLocaleString()}</small>
                        <div className="community-person-actions">
                          <button className="community-subtle-button" type="button" onClick={() => void resolveGroupReport(group.id, report.report_id, "dismiss")} disabled={Boolean(busy)}>Dismiss</button>
                          {report.target_user_id && <button className="community-danger-button" type="button" onClick={() => void resolveGroupReport(group.id, report.report_id, "remove_member")} disabled={Boolean(busy)}>Remove member</button>}
                        </div>
                      </div>)}
                      {(reportsByGroup[group.id] ?? []).length === 0 && <p className="community-empty">No open reports.</p>}
                    </div>}
                  </div>}
                </article>;
              })}
              {groups.length === 0 && <p className="community-empty">No group conversations yet. Add a friend first, then create a group.</p>}
            </div>
          </>
        )}

        {tab === "profile" && (
          <>
            <div className="community-section-title"><div><h2>Your community profile</h2><p>This profile is separate from your sign-in email and is used for player discovery.</p></div></div>
            <div className="community-profile-form">
              <label>Profile avatar<input aria-label="Upload profile avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProfileAvatar(file); event.currentTarget.value = ""; }} /></label>
              <small>Private avatar storage · JPEG, PNG, or WebP · maximum 5 MB. Only your account and accepted friends can read it.</small>
            </div>
            <form className="community-profile-form" onSubmit={saveProfile}>
              <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required placeholder="your_username" /></label>
              <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={1} maxLength={32} required placeholder="Your display name" /></label>
              <label className="community-toggle"><input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} /> Allow other players to find me</label>
              <label className="community-toggle"><input type="checkbox" checked={showOnline} onChange={(event) => setShowOnline(event.target.checked)} /> Show my online status to friends</label>
              <label className="community-toggle"><input type="checkbox" checked={showLastSeen} onChange={(event) => setShowLastSeen(event.target.checked)} /> Show my last seen time to friends</label>
              <button type="submit" disabled={Boolean(busy) || !username.trim() || !displayName.trim()}>{busy === "profile" ? "Saving…" : profile ? "Save profile" : "Create profile"}</button>
            </form>
            <p className="community-profile-note">Your account identity is still the verified Supabase Auth UUID. Your username and display name are presentation fields only.</p>
          </>
        )}
      </section>

      <footer className="community-status" role="status">
        <strong>{notice}</strong>
        {error && <p>{error}</p>}
        <small>Community actions are handled by authenticated Non-Production RPCs. Presence is approximate and expires automatically.</small>
      </footer>
    </main>
  );
}
