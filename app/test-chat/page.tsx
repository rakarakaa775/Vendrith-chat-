import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getSupabaseConfig } from "../../lib/supabase/config";
import ChatBackendConsole from "./test-chat-client";

export const dynamic = "force-dynamic";

export default async function TestChatPage() {
  if (!getSupabaseConfig()) {
    return <main className="auth-status"><h1>Non-production Auth is not configured</h1><a href="/">Back to local preview</a></main>;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return <ChatBackendConsole userId={data.claims.sub} />;
}
