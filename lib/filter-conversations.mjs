export function filterConversations(conversations, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return conversations;
  }

  return conversations.filter((conversation) => {
    const name = conversation.name.toLowerCase();
    const message = conversation.message.toLowerCase();

    return name.includes(normalizedQuery) || message.includes(normalizedQuery);
  });
}
