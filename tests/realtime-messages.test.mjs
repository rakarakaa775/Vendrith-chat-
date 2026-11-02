import test from "node:test";
import assert from "node:assert/strict";
import { mergeRealtimeMessage } from "../lib/realtime-messages.mjs";

const message = (id, created_at, body = id) => ({ id, created_at, body });

test("merges a realtime insert without duplicating an already loaded message", () => {
  const existing = [message("m1", "2026-11-02T10:00:00.000Z")];
  const merged = mergeRealtimeMessage(existing, message("m1", "2026-11-02T10:00:00.000Z"));
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], existing[0]);
});

test("sorts out-of-order realtime inserts deterministically by timestamp and id", () => {
  const merged = mergeRealtimeMessage(
    [message("b", "2026-11-02T10:00:00.000Z"), message("z", "2026-11-02T10:01:00.000Z")],
    message("a", "2026-11-02T10:00:00.000Z")
  );
  assert.deepEqual(merged.map((item) => item.id), ["a", "b", "z"]);
});

test("keeps only the newest 50 messages after a realtime insert", () => {
  const existing = Array.from({ length: 50 }, (_, index) =>
    message(`m${String(index).padStart(2, "0")}`, `2026-11-02T10:${String(index).padStart(2, "0")}:00.000Z`)
  );
  const merged = mergeRealtimeMessage(existing, message("m50", "2026-11-02T10:50:00.000Z"));
  assert.equal(merged.length, 50);
  assert.equal(merged[0].id, "m01");
  assert.equal(merged.at(-1).id, "m50");
});

test("replaying the same realtime event is idempotent", () => {
  const first = mergeRealtimeMessage([], message("m1", "2026-11-02T10:00:00.000Z"));
  const second = mergeRealtimeMessage(first, message("m1", "2026-11-02T10:00:00.000Z"));
  assert.deepEqual(second, first);
});

test("rejects invalid limits and malformed realtime payloads", () => {
  assert.throws(() => mergeRealtimeMessage([], message("m1", "now"), 0), RangeError);
  assert.throws(() => mergeRealtimeMessage([], { id: "m1" }), TypeError);
});
