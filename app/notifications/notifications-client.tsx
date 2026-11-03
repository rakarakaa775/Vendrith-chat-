"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type Notification = {
  id: string; category: "messages" | "friends" | "groups" | "moderation";
  event_type: string; title: string; body: string; conversation_id: string | null;
  actor_id: string | null; related_id: string | null; created_at: string; read_at: string | null;
};
type Preferences = { messages_enabled: boolean; friends_enabled: boolean; groups_enabled: boolean; moderation_enabled: boolean };
const defaults: Preferences = { messages_enabled: true, friends_enabled: true, groups_enabled: true, moderation_enabled: true };

export default function NotificationsClient() {
  const [items, setItems] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Loading notifications…");
  const supabase = createSupabaseBrowserClient();

  const refresh = useCallback(async () => {
    setError("");
    const [notifications, prefs] = await Promise.all([
      supabase.rpc("chat_list_notifications", { p_limit: 100 }),
      supabase.rpc("chat_get_notification_preferences")
    ]);
    if (notifications.error) throw notifications.error;
    if (prefs.error) throw prefs.error;
    setItems((notifications.data ?? []) as Notification[]);
    setPreferences(((prefs.data ?? [defaults])[0] ?? defaults) as Preferences);
    setNotice("Your private notification inbox is up to date.");
  }, [supabase]);

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load notifications."));
  }, [refresh]);

  async function markRead(id?: string) {
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("chat_mark_notification_read", { p_notification_id: id ?? null });
      if (rpcError) throw rpcError;
      setItems((current) => current.map((item) => (!id || item.id === id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
      setNotice(id ? "Notification marked as read." : "All notifications marked as read.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notification state."); }
    finally { setBusy(false); }
  }

  async function savePreferences(next: Preferences) {
    setPreferences(next);
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("chat_set_notification_preferences", {
        p_messages: next.messages_enabled, p_friends: next.friends_enabled,
        p_groups: next.groups_enabled, p_moderation: next.moderation_enabled
      });
      if (rpcError) throw rpcError;
      setNotice("Notification preferences saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save notification preferences.");
      void refresh();
    } finally { setBusy(false); }
  }

  const unread = items.filter((item) => !item.read_at).length;
  return <main className="notifications-page">
    <header className="community-header">
      <div><p className="auth-eyebrow">VENDRITH CHAT</p><h1>Notifications</h1><p>{unread} unread notification(s)</p></div>
      <div className="community-header-actions"><a href="/">Back to chat</a><button type="button" onClick={() => void refresh().catch((cause) => setError(cause.message))}>Refresh</button></div>
    </header>
    <section className="notification-preferences">
      <div><h2>Notification preferences</h2><p>Choose which in-app events should create notifications.</p></div>
      {(Object.keys(defaults) as (keyof Preferences)[]).map((key) => <label key={key}><input type="checkbox" checked={preferences[key]} disabled={busy} onChange={(event) => void savePreferences({ ...preferences, [key]: event.target.checked })} />{key.replace("_enabled", "").replace(/^./, (letter) => letter.toUpperCase())}</label>)}
    </section>
    <section className="notification-inbox">
      <div className="notification-inbox-title"><h2>Inbox</h2><button type="button" disabled={busy || unread === 0} onClick={() => void markRead()}>Mark all read</button></div>
      {items.map((item) => <article key={item.id} className={item.read_at ? "notification-item" : "notification-item unread"}>
        <div><span className="notification-category">{item.category}</span><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
        <div className="notification-actions">{!item.read_at && <button type="button" disabled={busy} onClick={() => void markRead(item.id)}>Mark read</button>}{item.conversation_id && <a href="/">Open chat</a>}</div>
      </article>)}
      {!items.length && <p className="notification-empty">You’re all caught up. New friend requests and incoming messages will appear here.</p>}
    </section>
    <p className="community-notice" role="status">{notice}</p>
    {error && <p className="community-error" role="alert">{error}</p>}
  </main>;
}
