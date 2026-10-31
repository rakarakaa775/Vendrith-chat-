export const MAX_MESSAGE_LENGTH = 4000;

export class ChatValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ChatValidationError";
    this.code = code;
  }
}

export function normalizeMessageBody(value) {
  if (typeof value !== "string") throw new ChatValidationError("invalid_body", "Message must be text.");
  const body = value.trim();
  if (!body) throw new ChatValidationError("empty_message", "Write a message before sending.");
  if (body.length > MAX_MESSAGE_LENGTH) throw new ChatValidationError("message_too_long", `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  return body;
}

export function compareMessages(a, b) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function appendMessage(messages, input) {
  if (!Array.isArray(messages)) throw new ChatValidationError("invalid_history", "Message history is invalid.");
  const conversationId = String(input?.conversationId ?? "").trim();
  const senderId = String(input?.senderId ?? "").trim();
  const clientMessageId = String(input?.clientMessageId ?? "").trim();
  if (!conversationId || !senderId || !clientMessageId) {
    throw new ChatValidationError("missing_identity", "Conversation, sender, and request identifiers are required.");
  }
  const duplicate = messages.find((message) => message.clientMessageId === clientMessageId);
  if (duplicate) return { messages, message: duplicate, duplicate: true };
  const body = normalizeMessageBody(input.body);
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new ChatValidationError("invalid_timestamp", "Message timestamp is invalid.");
  const message = {
    id: input.id ?? clientMessageId,
    clientMessageId,
    conversationId,
    senderId,
    sender: input.sender ?? "You",
    body,
    createdAt: new Date(createdAt).toISOString(),
    time: input.time ?? new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    mine: input.mine ?? true,
    status: "saved_locally"
  };
  return { messages: [...messages, message].sort(compareMessages), message, duplicate: false };
}

export function paginateMessages(messages, { limit = 50, before = null } = {}) {
  if (!Array.isArray(messages)) throw new ChatValidationError("invalid_history", "Message history is invalid.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ChatValidationError("invalid_page_size", "Page size must be between 1 and 100.");
  }
  const ordered = [...messages].sort(compareMessages);
  const eligible = before ? ordered.filter((message) => compareMessages(message, before) < 0) : ordered;
  const items = eligible.slice(-limit);
  const hasMore = eligible.length > items.length;
  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? { createdAt: items[0].createdAt, id: items[0].id } : null
  };
}

export function createLocalChatStore(storage, { seed = {}, now = () => new Date().toISOString(), createId = () => globalThis.crypto.randomUUID(), key = "vendrith-chat:local:v1" } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("A Storage-compatible adapter is required.");
  }
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return structuredClone(seed);
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.conversations !== "object" || Array.isArray(parsed.conversations)) {
      throw new ChatValidationError("invalid_local_store", "Saved local chat data has an unsupported format.");
    }
    return parsed.conversations;
  }
  function load() {
    const conversations = read();
    if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify({ version: 1, conversations }));
    return conversations;
  }
  function send(input) {
    const conversations = read();
    const conversationId = String(input?.conversationId ?? "");
    if (!Object.hasOwn(conversations, conversationId)) {
      throw new ChatValidationError("conversation_not_found", "This conversation is not available in the local preview.");
    }
    const result = appendMessage(conversations[conversationId], { ...input, createdAt: input.createdAt ?? now(), id: input.id ?? createId() });
    if (!result.duplicate) {
      storage.setItem(key, JSON.stringify({ version: 1, conversations: { ...conversations, [conversationId]: result.messages } }));
    }
    return result;
  }
  return { load, send };
}
