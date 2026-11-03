import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import CommunityClient from "./community-client";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <main className="auth-status"><h1>Community unavailable</h1><p>Non-production authentication is not configured.</p></main>;
  }
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return <CommunityClient userId={data.claims.sub} />;
}
