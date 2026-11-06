export const NON_PRODUCTION_PROJECT_REF = "npvlokuszipgwrdipeoi";

export type SupabaseConfig = { url: string; publishableKey: string };

function isExplicitLocalE2E(url: URL): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_SUPABASE_E2E === "1" &&
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "54321" &&
    url.pathname === "/" &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?.trim();

  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase configuration is incomplete. Configure both URL and publishable key.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase URL is invalid.");
  }

  const localE2E = isExplicitLocalE2E(parsed);
  const hostedNonProduction = parsed.protocol === "https:" &&
    parsed.hostname === `${NON_PRODUCTION_PROJECT_REF}.supabase.co` &&
    parsed.pathname === "/" &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash;

  if (!localE2E && !hostedNonProduction) {
    throw new Error(
      "This build is restricted to the Vendrith Non-Production E2E Supabase project.",
    );
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("A Supabase publishable key is required.");
  }

  return { url: parsed.origin, publishableKey };
}
