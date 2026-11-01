import { createSupabaseServerClient } from "../lib/supabase/server";
import { getSupabaseConfig } from "../lib/supabase/config";
import ChatPreview from "./chat-preview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const config = getSupabaseConfig();
  if (!config) return <ChatPreview />;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="auth-status"><h1>Authentication unavailable</h1><p>Non-production authentication is not configured.</p></main>;

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return <main className="auth-status"><h1>Authentication required</h1><p>Please sign in to the non-production test environment.</p><a href="/login">Continue to sign in</a></main>;

  return <ChatPreview authenticatedLabel={typeof claims.email === "string" ? claims.email : "Verified test player"} />;
}
