"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Non-production Supabase is not configured.");
  browserClient ??= createBrowserClient(config.url, config.publishableKey);
  return browserClient;
}
