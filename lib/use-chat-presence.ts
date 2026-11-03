"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "./supabase/browser";

export type FriendPresence = {
  friend_user_id: string;
  is_online: boolean;
  last_seen_at: string | null;
};

export function useChatPresence() {
  const [presence, setPresence] = useState<Record<string, FriendPresence>>({});

  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      const supabase = createSupabaseBrowserClient();
      const [heartbeat, friends] = await Promise.all([
        supabase.rpc("chat_presence_heartbeat"),
        supabase.rpc("chat_list_friend_presence")
      ]);
      if (heartbeat.error) throw heartbeat.error;
      if (friends.error) throw friends.error;
      if (!active) return;
      const next: Record<string, FriendPresence> = {};
      for (const row of (friends.data ?? []) as FriendPresence[]) next[row.friend_user_id] = row;
      setPresence(next);
    };

    void sync().catch(() => {});
    const interval = window.setInterval(() => { void sync().catch(() => {}); }, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void sync().catch(() => {});
    };
    window.addEventListener("focus", handleVisibility);
    window.addEventListener("vendrith-presence-refresh", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      window.removeEventListener("vendrith-presence-refresh", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return presence;
}
