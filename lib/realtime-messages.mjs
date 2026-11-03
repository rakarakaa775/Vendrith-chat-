export function mergeRealtimeMessage(messages, incoming, limit = 50) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Message limit must be a positive integer.");
  if (!incoming || typeof incoming.id !== "string" || typeof incoming.created_at !== "string") {
    throw new TypeError("Incoming realtime message must include an id and created_at timestamp.");
  }
  const unique = new Map();
  for (const message of messages) {
    if (message && typeof message.id === "string") unique.set(message.id, message);
  }
  unique.set(incoming.id, incoming);
  return [...unique.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(-limit);
}
