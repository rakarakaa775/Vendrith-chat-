import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import RealtimeProbeClient from "./realtime-probe-client";

export const dynamic = "force-dynamic";

export default async function RealtimeProbePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="auth-status"><h1>Realtime probe unavailable</h1><p>Non-production Supabase is not configured.</p></main>;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return <RealtimeProbeClient userId={data.claims.sub} />;
}
