export type SearchableConversation = {
  name: string;
  message: string;
};

export declare function filterConversations<T extends SearchableConversation>(
  conversations: T[],
  query: string
): T[];
