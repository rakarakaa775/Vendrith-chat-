import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/middleware";
import { getSupabaseConfig } from "./lib/supabase/config";

export async function middleware(request: NextRequest) {
  try {
    return await updateSupabaseSession(request);
  } catch {
    // A configured but invalid target must fail closed; it must never fall back to local preview.
    try {
      getSupabaseConfig();
      return NextResponse.json({ error: "Supabase configuration could not be validated." }, { status: 503 });
    } catch (error) {
      if (error instanceof Error && error.message === "Supabase configuration is incomplete. Configure both URL and publishable key.") {
        return NextResponse.json({ error: "Supabase configuration is incomplete." }, { status: 503 });
      }
      if (error instanceof Error && error.message === "This build is restricted to the Vendrith Non-Production E2E Supabase project.") {
        return NextResponse.json({ error: "This deployment is not allowed to connect to that Supabase project." }, { status: 503 });
      }
      return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
