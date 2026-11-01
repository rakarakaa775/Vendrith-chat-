import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const ALLOWED_NEXT_PATHS = new Set(["/", "/reset-password"]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const safeNext = requestedNext && ALLOWED_NEXT_PATHS.has(requestedNext) ? requestedNext : "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(safeNext, request.url));
      }
    }
  }

  return NextResponse.redirect(new URL("/auth/error", request.url));
}
