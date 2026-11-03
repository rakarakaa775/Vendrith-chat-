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
type Tab = "discover" | "friends" | "requests" | "blocked" | "profile";

const tabs: { id: Tab; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "blocked", label: "Blocked" },
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
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Loading your community…");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const refresh = useCallback(async () => {
    setError("");
    const [profileResult, friendsResult, requestsResult, blockedResult, presenceResult] = await Promise.all([
      supabase.rpc("chat_get_my_profile"),
      supabase.rpc("chat_list_friends"),
      supabase.rpc("chat_list_friend_requests"),
      supabase.rpc("chat_list_blocked_users"),
      supabase.rpc("chat_list_friend_presence")
    ]);
    const failed = [profileResult, friendsResult, requestsResult, blockedResult, presenceResult].find((item) => item.error);
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
    setNotice("Community data is up to date.");
  }, [supabase]);

  useEffect(() => {
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

        {tab === "profile" && (
          <>
            <div className="community-section-title"><div><h2>Your community profile</h2><p>This profile is separate from your sign-in email and is used for player discovery.</p></div></div>
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
