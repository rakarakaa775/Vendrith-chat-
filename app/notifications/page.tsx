import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getSupabaseConfig } from "../../lib/supabase/config";
import NotificationsClient from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  if (!getSupabaseConfig()) return <main className="auth-status"><h1>Notifications unavailable</h1><p>Configure the isolated Non-Production environment first.</p><a href="/">Back to chat</a></main>;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="auth-status"><h1>Authentication unavailable</h1><p>Non-Production authentication is not configured.</p></main>;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return <main className="auth-status"><h1>Authentication required</h1><p>Sign in to view your notifications.</p><a href="/login">Continue to sign in</a></main>;
  return <NotificationsClient />;
}
