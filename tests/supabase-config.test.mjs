import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig } from "../lib/supabase/config.ts";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_ALLOW_LOCAL_SUPABASE_E2E:
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_SUPABASE_E2E,
};

function setConfig(
  {
    nodeEnv = "development",
    url,
    key = "sb_publishable_local_test_key",
    allowLocal = "0",
  },
) {
  process.env.NODE_ENV = nodeEnv;
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  if (key === null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  process.env.NEXT_PUBLIC_ALLOW_LOCAL_SUPABASE_E2E = allowLocal;
}

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("returns null when Supabase is not configured", () => {
  setConfig({ url: undefined, key: null });
  assert.equal(getSupabaseConfig(), null);
});

test("accepts only the fixed hosted Non-Production project with a publishable key", () => {
  setConfig({ url: "https://npvlokuszipgwrdipeoi.supabase.co" });
  assert.deepEqual(getSupabaseConfig(), {
    url: "https://npvlokuszipgwrdipeoi.supabase.co",
    publishableKey: "sb_publishable_local_test_key",
  });
});

test("accepts loopback Supabase only with the explicit local E2E flag", () => {
  setConfig({ url: "http://127.0.0.1:54321", allowLocal: "1" });
  assert.deepEqual(getSupabaseConfig(), {
    url: "http://127.0.0.1:54321",
    publishableKey: "sb_publishable_local_test_key",
  });
});

test("rejects loopback Supabase without the explicit local E2E flag", () => {
  setConfig({ url: "http://127.0.0.1:54321", allowLocal: "0" });
  assert.throws(getSupabaseConfig, /restricted to the Vendrith Non-Production/);
});

test("rejects local E2E configuration in production builds", () => {
  setConfig({
    nodeEnv: "production",
    url: "http://127.0.0.1:54321",
    allowLocal: "1",
  });
  assert.throws(getSupabaseConfig, /restricted to the Vendrith Non-Production/);
});

test("rejects non-loopback hosts and unexpected local ports", () => {
  setConfig({ url: "http://192.168.1.10:54321", allowLocal: "1" });
  assert.throws(getSupabaseConfig, /restricted to the Vendrith Non-Production/);
  setConfig({ url: "http://127.0.0.1:54322", allowLocal: "1" });
  assert.throws(getSupabaseConfig, /restricted to the Vendrith Non-Production/);
});

test("rejects malformed or partial configuration and non-publishable keys", () => {
  setConfig({ url: "not-a-url" });
  assert.throws(getSupabaseConfig, /URL is invalid/);
  setConfig({ url: "https://npvlokuszipgwrdipeoi.supabase.co", key: null });
  assert.throws(getSupabaseConfig, /configuration is incomplete/);
  setConfig({
    url: "https://npvlokuszipgwrdipeoi.supabase.co",
    key: "eyJlegacy",
  });
  assert.throws(getSupabaseConfig, /publishable key is required/);
});
