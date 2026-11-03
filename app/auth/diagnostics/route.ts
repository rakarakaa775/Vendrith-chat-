import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSupabaseConfig } from "../../../lib/supabase/config";

export const dynamic = "force-dynamic";

function safeError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
  return {
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 100) : "UnknownError",
    message: typeof candidate.message === "string" ? candidate.message.slice(0, 240) : "No error message",
    status: typeof candidate.status === "number" ? candidate.status : null,
    code: typeof candidate.code === "string" ? candidate.code.slice(0, 80) : null,
  };
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map(({ name }) => name);
  let configHost: string | null = null;

  try {
    const config = getSupabaseConfig();
    configHost = config ? new URL(config.url).host : null;
  } catch (error) {
    return NextResponse.json({
      diagnostic: "vendrith-auth-preview-v1",
      config: "invalid",
      configError: safeError(error),
      hasAuthCookie: cookieNames.some((name) => name.startsWith("sb-") && name.endsWith("-auth-token")),
      cookieNames,
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      diagnostic: "vendrith-auth-preview-v1",
      config: "missing",
      configHost,
      hasAuthCookie: cookieNames.some((name) => name.startsWith("sb-") && name.endsWith("-auth-token")),
      cookieNames,
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const [claimsResult, userResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  return NextResponse.json({
    diagnostic: "vendrith-auth-preview-v1",
    config: "valid",
    configHost,
    hasAuthCookie: cookieNames.some((name) => name.startsWith("sb-") && name.endsWith("-auth-token")),
    cookieNames,
    claims: {
      verified: Boolean(claimsResult.data?.claims?.sub),
      error: safeError(claimsResult.error),
    },
    user: {
      verified: Boolean(userResult.data?.user?.id),
      error: safeError(userResult.error),
    },
    note: "No access tokens, refresh tokens, email addresses, or user IDs are returned.",
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
