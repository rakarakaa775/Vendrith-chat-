import assert from "node:assert/strict";
import test from "node:test";
import {
  hasRecentAuthentication,
  passwordAuthTimeFromJwt,
} from "../supabase/functions/_shared/account-lifecycle.mjs";

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("reads the latest password authentication timestamp from Supabase AMR", () => {
  assert.equal(
    passwordAuthTimeFromJwt(jwt({
      amr: [{ method: "password", timestamp: 1_800_000_000 }],
    })),
    1_800_000_000,
  );
});

test("rejects missing, malformed, stale-method, and nonnumeric AMR claims", () => {
  assert.equal(passwordAuthTimeFromJwt("not-a-jwt"), null);
  assert.equal(passwordAuthTimeFromJwt(jwt({ sub: "user" })), null);
  assert.equal(
    passwordAuthTimeFromJwt(jwt({
      amr: [{ method: "token_refresh", timestamp: 1_800_000_000 }],
    })),
    null,
  );
  assert.equal(
    passwordAuthTimeFromJwt(jwt({
      amr: [{ method: "password", timestamp: "1800000000" }],
    })),
    null,
  );
});

test("requires password to be the most recent authentication method", () => {
  assert.equal(
    passwordAuthTimeFromJwt(jwt({
      amr: [
        { method: "totp", timestamp: 1_800_000_010 },
        { method: "password", timestamp: 1_800_000_000 },
      ],
    })),
    null,
  );
});

test("recent authentication guard enforces the ten-minute boundary and clock tolerance", () => {
  const now = 1_800_000_000;
  assert.equal(hasRecentAuthentication(now - 600, now, 600), true);
  assert.equal(hasRecentAuthentication(now - 601, now, 600), false);
  assert.equal(hasRecentAuthentication(now + 60, now, 600), true);
  assert.equal(hasRecentAuthentication(now + 61, now, 600), false);
  assert.equal(hasRecentAuthentication(0, now, 600), false);
  assert.equal(hasRecentAuthentication(null, now, 600), false);
});
