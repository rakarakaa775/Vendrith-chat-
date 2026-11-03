"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useChatPresence } from "../../lib/use-chat-presence";

type Profile = { user_id: string; username: string; display_name: string; discoverable: boolean; show_online_status: boolean; show_last_seen: boolean };
type SearchUser = { user_id: string; username: string; display_name: string };
type Friend = { friend_user_id: string; username: string | null; display_name: string; friends_since: string };
type FriendRequest = { request_id: string; other_user_id: string; username: string | null; display_name: string; direction: "incoming" | "outgoing"; created_at: string };
type BlockedUser = { blocked_user_id: string; username: string | null; display_name: string; blocked_at: string };

export default function CommunityClient({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [savingPresence, setSavingPresence] = useState(false);
  const presence = useChatPresence();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading your community…");

  const refresh = useCallback(async () => {
    setError("");
    const supabase = createSupabaseBrowserClient();
    const [profileResult, friendsResult, requestsResult, blocksResult] = await Promise.all([
      supabase.from("chat_profiles").select("user_id,username,display_name,discoverable,show_online_status,show_last_seen").eq("user_id", userId).maybeSingle(),
      supabase.rpc("chat_list_friends"),
      supabase.rpc("chat_list_friend_requests"),
      supabase.rpc("chat_list_blocked_users")
    ]);
    if (profileResult.error) throw profileResult.error;
    if (friendsResult.error) throw friendsResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (blocksResult.error) throw blocksResult.error;
    const nextProfile = profileResult.data as Profile | null;
    setProfile(nextProfile);
    if (nextProfile) {
      setUsername(nextProfile.username);
      setDisplayName(nextProfile.display_name);
      setDiscoverable(nextProfile.discoverable);
      setShowOnlineStatus(nextProfile.show_online_status);
      setShowLastSeen(nextProfile.show_last_seen);
    }
    setFriends((friendsResult.data ?? []) as Friend[]);
    setRequests((requestsResult.data ?? []) as FriendRequest[]);
    setBlockedUsers((blocksResult.data ?? []) as BlockedUser[]);
    setStatus("Community data synchronized with the Non-Production server.");
  }, [userId]);

  useEffect(() => {
    let active = true;
    void refresh().catch((cause) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Could not load community data.");
        setStatus("Community data could not be loaded.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const searchUsers = useCallback(async (query: string) => {
    const { data, error: searchError } = await createSupabaseBrowserClient().rpc("chat_search_users", { p_query: query, p_limit: 20 });
    if (searchError) throw searchError;
    return (data ?? []) as SearchUser[];
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!profile || query.length < 3) {
      setSearchResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchUsers(query).then((data) => {
        if (active) setSearchResults(data);
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "User search failed.");
      });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [profile, searchQuery, searchUsers]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedName = displayName.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
      setError("Username must contain 3–20 lowercase letters, numbers, or underscores.");
      return;
    }
    if (normalizedName.length < 1 || normalizedName.length > 32) {
      setError("Display name must contain 1–32 characters.");
      return;
    }
    setSavingProfile(true);
    setError("");
    try {
      const { error: saveError } = await createSupabaseBrowserClient().rpc("chat_upsert_profile", {
        p_username: normalizedUsername,
        p_display_name: normalizedName,
        p_discoverable: discoverable
      });
      if (saveError) throw saveError;
      await refresh();
      setStatus("Your community profile has been saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally { setSavingProfile(false); }
  }

  async function runAction(id: string, action: () => Promise<{ error: { message: string } | null }>, success: string) {
    setBusyId(id);
    setError("");
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      await refresh();
      setStatus(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The community action failed.");
    } finally { setBusyId(""); }
  }

  async function savePresencePrivacy() {
    setSavingPresence(true);
    setError("");
    try {
      const { error: privacyError } = await createSupabaseBrowserClient().rpc("chat_set_presence_privacy", {
        p_show_online_status: showOnlineStatus,
        p_show_last_seen: showLastSeen
      });
      if (privacyError) throw privacyError;
      const { error: heartbeatError } = await createSupabaseBrowserClient().rpc("chat_presence_heartbeat");
      if (heartbeatError) throw heartbeatError;
      window.dispatchEvent(new Event("vendrith-presence-refresh"));
      await refresh();
      setStatus("Presence privacy settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save presence privacy settings.");
    } finally {
      setSavingPresence(false);
    }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.assign("/login");
  }

  const incoming = requests.filter((request) => request.direction === "incoming");
  const outgoing = requests.filter((request) => request.direction === "outgoing");

  return (
    <main className="community-page">
      <header className="community-header">
        <div>
          <p className="auth-eyebrow">VENDRITH CHAT · PHASE 6</p>
          <h1>Friends & Community</h1>
          <p>Find players, manage friend requests, and control who can contact you.</p>
        </div>
        <nav className="community-nav" aria-label="Community navigation">
          <a href="/">Back to chat</a>
          <button type="button" onClick={() => void refresh()}>Refresh</button>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </nav>
      </header>

      <section className="community-identity">
        <strong>Authenticated player</strong>
        <code>{userId}</code>
        <span>Non-Production E2E account · Community actions are server-authorized.</span>
      </section>

      <section className="community-card">
        <div className="community-section-title">
          <div><h2>Your player profile</h2><p>Your email and private Auth metadata are never shown in player search.</p></div>
          {profile && <span className="community-state">{profile.discoverable ? "Discoverable" : "Hidden from search"}</span>}
        </div>
        <form className="community-profile-form" onSubmit={saveProfile}>
          <label>Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} autoComplete="off" placeholder="e.g. vendrith_player" />
          </label>
          <label>Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} placeholder="How other players see you" />
          </label>
          <label className="community-checkbox">
            <input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} />
            Allow other players to find me by username or display name
          </label>
          <button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : profile ? "Save profile" : "Create profile"}</button>
        </form>
      </section>

      {profile && <section className="community-card">
        <div className="community-section-title"><div><h2>Online status &amp; privacy</h2><p>Only accepted friends can see your presence. Status expires after 90 seconds without a heartbeat.</p></div></div>
        <div className="community-profile-form">
          <label className="community-checkbox"><input type="checkbox" checked={showOnlineStatus} onChange={(event) => setShowOnlineStatus(event.target.checked)} /> Show my online status to friends</label>
          <label className="community-checkbox"><input type="checkbox" checked={showLastSeen} onChange={(event) => setShowLastSeen(event.target.checked)} disabled={!showOnlineStatus} /> Show my last seen time to friends when offline</label>
          <button type="button" disabled={savingPresence} onClick={() => void savePresencePrivacy()}>{savingPresence ? "Saving…" : "Save presence privacy"}</button>
        </div>
      </section>}

      {profile && <>
        <section className="community-card">
          <div className="community-section-title"><div><h2>Find players</h2><p>Search requires at least three characters. Only opted-in profiles appear.</p></div></div>
          <label className="community-search"><span aria-hidden="true">⌕</span>
            <input aria-label="Search players" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search username or display name…" autoComplete="off" />
          </label>
          <div className="community-list" aria-live="polite">
            {searchQuery.trim().length < 3 && <p className="community-empty">Enter at least three characters to search.</p>}
            {searchQuery.trim().length >= 3 && searchResults.length === 0 && <p className="community-empty">No discoverable players found.</p>}
            {searchResults.map((player) => {
              const isFriend = friends.some((friend) => friend.friend_user_id === player.user_id);
              const hasOutgoing = outgoing.some((request) => request.other_user_id === player.user_id);
              const hasIncoming = incoming.some((request) => request.other_user_id === player.user_id);
              return <article className="community-row" key={player.user_id}>
                <div className="community-avatar">{player.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-row-copy"><strong>{player.display_name}</strong><span>@{player.username}</span></div>
                {isFriend ? <span className="community-state">Friend</span> : hasIncoming ? <span className="community-state">Incoming request</span> : hasOutgoing ? <span className="community-state">Requested</span> :
                  <button type="button" disabled={busyId === player.user_id} onClick={() => void runAction(player.user_id, () => createSupabaseBrowserClient().rpc("chat_send_friend_request", { p_recipient_id: player.user_id }), "Friend request sent.")}>Add friend</button>}
                <button className="danger" type="button" disabled={busyId === player.user_id} onClick={() => void runAction(player.user_id, () => createSupabaseBrowserClient().rpc("chat_block_user", { p_other_user_id: player.user_id }), "Player blocked.")}>Block</button>
              </article>;
            })}
          </div>
        </section>

        <div className="community-grid">
          <section className="community-card">
            <div className="community-section-title"><div><h2>Incoming requests</h2><p>{incoming.length} waiting for your response.</p></div></div>
            <div className="community-list">
              {incoming.length === 0 && <p className="community-empty">No incoming requests.</p>}
              {incoming.map((request) => <article className="community-row" key={request.request_id}>
                <div className="community-avatar">{request.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-row-copy"><strong>{request.display_name}</strong><span>{request.username ? "@" + request.username : "Vendrith player"}</span></div>
                <div className="community-row-actions">
                  <button type="button" disabled={busyId === request.request_id} onClick={() => void runAction(request.request_id, () => createSupabaseBrowserClient().rpc("chat_respond_friend_request", { p_request_id: request.request_id, p_accept: true }), "Friend request accepted.")}>Accept</button>
                  <button className="secondary" type="button" disabled={busyId === request.request_id} onClick={() => void runAction(request.request_id, () => createSupabaseBrowserClient().rpc("chat_respond_friend_request", { p_request_id: request.request_id, p_accept: false }), "Friend request declined.")}>Decline</button>
                </div>
              </article>)}
            </div>
          </section>
          <section className="community-card">
            <div className="community-section-title"><div><h2>Sent requests</h2><p>{outgoing.length} awaiting a response.</p></div></div>
            <div className="community-list">
              {outgoing.length === 0 && <p className="community-empty">No pending sent requests.</p>}
              {outgoing.map((request) => <article className="community-row" key={request.request_id}>
                <div className="community-avatar">{request.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-row-copy"><strong>{request.display_name}</strong><span>{request.username ? "@" + request.username : "Vendrith player"}</span></div>
                <button className="secondary" type="button" disabled={busyId === request.request_id} onClick={() => void runAction(request.request_id, () => createSupabaseBrowserClient().rpc("chat_cancel_friend_request", { p_request_id: request.request_id }), "Friend request cancelled.")}>Cancel</button>
              </article>)}
            </div>
          </section>
        </div>

        <div className="community-grid">
          <section className="community-card">
            <div className="community-section-title"><div><h2>Your friends</h2><p>{friends.length} accepted connection(s).</p></div></div>
            <div className="community-list">
              {friends.length === 0 && <p className="community-empty">Your friend list is empty for now.</p>}
              {friends.map((friend) => <article className="community-row" key={friend.friend_user_id}>
                <div className="community-avatar">{friend.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-row-copy"><strong>{friend.display_name}</strong><span>{friend.username ? "@" + friend.username : "Vendrith player"}</span><span className="community-presence">{presence[friend.friend_user_id]?.is_online ? "● Online" : presence[friend.friend_user_id]?.last_seen_at ? "Offline · last seen " + new Date(presence[friend.friend_user_id].last_seen_at as string).toLocaleString() : "Offline or status hidden"}</span></div>
                <button className="secondary" type="button" disabled={busyId === friend.friend_user_id} onClick={() => void runAction(friend.friend_user_id, () => createSupabaseBrowserClient().rpc("chat_remove_friend", { p_other_user_id: friend.friend_user_id }), "Friend removed.")}>Remove</button>
                <button className="danger" type="button" disabled={busyId === friend.friend_user_id} onClick={() => void runAction(friend.friend_user_id, () => createSupabaseBrowserClient().rpc("chat_block_user", { p_other_user_id: friend.friend_user_id }), "Player blocked and friendship removed.")}>Block</button>
              </article>)}
            </div>
          </section>
          <section className="community-card">
            <div className="community-section-title"><div><h2>Blocked players</h2><p>Blocked players cannot find you or start new direct messages.</p></div></div>
            <div className="community-list">
              {blockedUsers.length === 0 && <p className="community-empty">You have not blocked anyone.</p>}
              {blockedUsers.map((blocked) => <article className="community-row" key={blocked.blocked_user_id}>
                <div className="community-avatar muted">{blocked.display_name.slice(0, 1).toUpperCase()}</div>
                <div className="community-row-copy"><strong>{blocked.display_name}</strong><span>{blocked.username ? "@" + blocked.username : "Vendrith player"}</span></div>
                <button className="secondary" type="button" disabled={busyId === blocked.blocked_user_id} onClick={() => void runAction(blocked.blocked_user_id, () => createSupabaseBrowserClient().rpc("chat_unblock_user", { p_other_user_id: blocked.blocked_user_id }), "Player unblocked.")}>Unblock</button>
              </article>)}
            </div>
          </section>
        </div>
      </>}

      {loading && <p className="community-feedback">Loading community data…</p>}
      {error && <p className="community-error" role="alert">{error}</p>}
      <p className="community-feedback" role="status">{status}</p>
    </main>
  );
}
