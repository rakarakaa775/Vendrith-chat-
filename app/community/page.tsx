import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getSupabaseConfig } from "../../lib/supabase/config";
import CommunityClient from "./community-client";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const config = getSupabaseConfig();
  if (!config) {
    return <main className="auth-status"><h1>Community unavailable</h1><p>Configure the isolated Non-Production environment to use player community features.</p><a href="/">Back to preview</a></main>;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <main className="auth-status"><h1>Authentication unavailable</h1><p>Non-Production authentication is not configured.</p></main>;
  }

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return <main className="auth-status"><h1>Authentication required</h1><p>Sign in to access the Vendrith community.</p><a href="/login">Continue to sign in</a></main>;
  }

  return <CommunityClient userId={claims.sub} />;
}
