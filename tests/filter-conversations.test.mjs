import test from "node:test";
import assert from "node:assert/strict";
import { filterConversations } from "../lib/filter-conversations.mjs";

const conversations = [
  { name: "Elaria Moonwhisper", message: "The northern gate is ready." },
  { name: "Thorne Ashford", message: "Did you find the map fragment?" },
  { name: "Myrin Vale", message: "I left the supplies near the docks." },
];

test("returns every conversation when the query is empty", () => {
  assert.deepEqual(filterConversations(conversations, ""), conversations);
});

test("matches conversation names without case sensitivity", () => {
  assert.deepEqual(filterConversations(conversations, "ELARIA"), [conversations[0]]);
});

test("matches message snippets", () => {
  assert.deepEqual(filterConversations(conversations, "map fragment"), [conversations[1]]);
});

test("trims whitespace around the query", () => {
  assert.deepEqual(filterConversations(conversations, "  docks  "), [conversations[2]]);
});

test("returns an empty array when nothing matches", () => {
  assert.deepEqual(filterConversations(conversations, "dragon"), []);
});
