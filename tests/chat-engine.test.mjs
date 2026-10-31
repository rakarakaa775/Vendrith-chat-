import test from "node:test";
import assert from "node:assert/strict";
import { appendMessage, createLocalChatStore, normalizeMessageBody, paginateMessages, ChatValidationError } from "../lib/chat-engine.mjs";

const base = {
  conversationId: "conversation-1", senderId: "local-player", clientMessageId: "request-1",
  body: "  Hello, Vendrith!  ", createdAt: "2026-11-01T10:00:00.000Z"
};

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("normalizes message whitespace and rejects empty content", () => {
  assert.equal(normalizeMessageBody("  hello  "), "hello");
  assert.throws(() => normalizeMessageBody("  \n "), { code: "empty_message" });
});

test("rejects messages beyond the documented limit", () => {
  assert.throws(() => normalizeMessageBody("x".repeat(4001)), { code: "message_too_long" });
});

test("appends a locally saved message with a stable request identifier", () => {
  const result = appendMessage([], base);
  assert.equal(result.message.body, "Hello, Vendrith!");
  assert.equal(result.message.status, "saved_locally");
  assert.equal(result.message.clientMessageId, "request-1");
  assert.equal(result.duplicate, false);
});

test("makes duplicate send requests idempotent", () => {
  const first = appendMessage([], base);
  const second = appendMessage(first.messages, base);
  assert.equal(second.duplicate, true);
  assert.equal(second.messages.length, 1);
  assert.equal(second.message.id, first.message.id);
});

test("orders messages deterministically and paginates older history", () => {
  const messages = [
    { id: "c", createdAt: "2026-11-01T10:02:00.000Z" },
    { id: "a", createdAt: "2026-11-01T10:00:00.000Z" },
    { id: "b", createdAt: "2026-11-01T10:01:00.000Z" }
  ];
  const page = paginateMessages(messages, { limit: 2 });
  assert.deepEqual(page.items.map((message) => message.id), ["b", "c"]);
  assert.equal(page.hasMore, true);
  const older = paginateMessages(messages, { limit: 2, before: page.nextCursor });
  assert.deepEqual(older.items.map((message) => message.id), ["a"]);
  assert.equal(older.hasMore, false);
});

test("local store persists messages and reloads them", () => {
  const storage = memoryStorage();
  const store = createLocalChatStore(storage, {
    seed: { "conversation-1": [] }, now: () => "2026-11-01T10:00:00.000Z", createId: () => "message-1"
  });
  store.load();
  store.send(base);
  const reloaded = createLocalChatStore(storage).load();
  assert.equal(reloaded["conversation-1"].length, 1);
  assert.equal(reloaded["conversation-1"][0].body, "Hello, Vendrith!");
});

test("local store does not create a second message for a retried request", () => {
  const store = createLocalChatStore(memoryStorage(), {
    seed: { "conversation-1": [] }, now: () => "2026-11-01T10:00:00.000Z", createId: () => "message-1"
  });
  store.load();
  store.send(base);
  const retry = store.send(base);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.messages.length, 1);
});

test("local store rejects unknown conversations", () => {
  const store = createLocalChatStore(memoryStorage(), { seed: {} });
  assert.throws(() => store.send(base), (error) => error instanceof ChatValidationError && error.code === "conversation_not_found");
});

test("local store reports corrupt saved data instead of silently overwriting it", () => {
  const storage = memoryStorage();
  storage.setItem("vendrith-chat:local:v1", "{not-json");
  const store = createLocalChatStore(storage, { seed: { "conversation-1": [] } });
  assert.throws(() => store.load(), (error) => error instanceof ChatValidationError && error.code === "corrupt_local_store");
});

test("local storage write failures are surfaced so the UI can preserve the draft", () => {
  const storage = {
    getItem: () => JSON.stringify({ version: 1, conversations: { "conversation-1": [] } }),
    setItem: () => { throw new Error("Storage quota exceeded"); },
    removeItem: () => {}
  };
  const store = createLocalChatStore(storage);
  assert.throws(() => store.send(base), /Storage quota exceeded/);
});


test("corrupt JSON is reported with a recoverable error and the raw backup is preserved", () => {
  const storage = memoryStorage();
  storage.setItem("vendrith-chat:local:v1", "{broken-json");
  const store = createLocalChatStore(storage, { seed: { "conversation-1": [] } });
  assert.throws(() => store.load(), (error) => error instanceof ChatValidationError && error.code === "corrupt_local_store");
  assert.equal(store.exportRaw(), "{broken-json");
});

test("unsupported or malformed message records are rejected without overwriting source data", () => {
  const storage = memoryStorage();
  const raw = JSON.stringify({ version: 1, conversations: { "conversation-1": [{ id: 7 }] } });
  storage.setItem("vendrith-chat:local:v1", raw);
  const store = createLocalChatStore(storage);
  assert.throws(() => store.load(), (error) => error instanceof ChatValidationError && error.code === "invalid_local_store");
  assert.equal(store.exportRaw(), raw);
});

test("reset requires explicit confirmation and restores only the supplied local seed", () => {
  const storage = memoryStorage();
  storage.setItem("vendrith-chat:local:v1", "{broken");
  const store = createLocalChatStore(storage, { seed: { "conversation-1": [] } });
  assert.throws(() => store.reset(), (error) => error instanceof ChatValidationError && error.code === "reset_confirmation_required");
  assert.equal(store.exportRaw(), "{broken");
  const restored = store.reset({ confirmed: true });
  assert.deepEqual(restored, { "conversation-1": [] });
  assert.deepEqual(store.load(), { "conversation-1": [] });
});

test("a failed local write can be retried with the same request ID without duplication", () => {
  const values = new Map([["vendrith-chat:local:v1", JSON.stringify({ version: 1, conversations: { "conversation-1": [] } })]]);
  let failNextWrite = true;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("Temporary storage failure");
      }
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key)
  };
  const store = createLocalChatStore(storage);
  assert.throws(() => store.send(base), /Temporary storage failure/);
  const retry = store.send(base);
  assert.equal(retry.duplicate, false);
  assert.equal(retry.message.clientMessageId, "request-1");
  assert.equal(store.load()["conversation-1"].length, 1);
});
