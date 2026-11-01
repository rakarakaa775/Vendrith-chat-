export const NON_PRODUCTION_PROJECT_REF = "npvlokuszipgwrdipeoi";

export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new Error("Supabase configuration is incomplete. Configure both URL and publishable key.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase URL is invalid.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== `${NON_PRODUCTION_PROJECT_REF}.supabase.co` || parsed.pathname !== "/") {
    throw new Error("This build is restricted to the Vendrith Non-Production E2E Supabase project.");
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("A Supabase publishable key is required.");
  }

  return { url: parsed.origin, publishableKey };
}
