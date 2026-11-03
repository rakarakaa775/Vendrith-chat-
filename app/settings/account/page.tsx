import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSupabaseConfig } from "../../../lib/supabase/config";
import AccountSettingsClient from "./account-settings-client";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  if (!getSupabaseConfig()) return <main className="auth-status"><h1>Account settings unavailable</h1><p>Configure the isolated Non-Production environment first.</p><a href="/">Back to chat</a></main>;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="auth-status"><h1>Authentication unavailable</h1><p>Non-Production authentication is not configured.</p></main>;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return <main className="auth-status"><h1>Authentication required</h1><p>Sign in to manage account security.</p><a href="/login">Continue to sign in</a></main>;
  return <AccountSettingsClient />;
}
