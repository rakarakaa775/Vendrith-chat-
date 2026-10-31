export const MAX_MESSAGE_LENGTH: number;
export class ChatValidationError extends Error { code: string; }
export type ChatMessage = {
  id: string; clientMessageId: string; conversationId: string; senderId: string;
  sender: string; body: string; createdAt: string; time: string; mine: boolean;
  status: "saved_locally";
};
export function normalizeMessageBody(value: unknown): string;
export function compareMessages(a: ChatMessage, b: ChatMessage): number;
export function appendMessage(messages: ChatMessage[], input: Partial<ChatMessage> & { conversationId: string; senderId: string; clientMessageId: string; body: string }): { messages: ChatMessage[]; message: ChatMessage; duplicate: boolean };
export function paginateMessages(messages: ChatMessage[], options?: { limit?: number; before?: { createdAt: string; id: string } | null }): { items: ChatMessage[]; hasMore: boolean; nextCursor: { createdAt: string; id: string } | null };
export function createLocalChatStore(storage: { getItem(key: string): string | null; setItem(key: string, value: string): void }, options?: { seed?: Record<string, ChatMessage[]>; now?: () => string; createId?: () => string; key?: string }): { load(): Record<string, ChatMessage[]>; send(input: Partial<ChatMessage> & { conversationId: string; senderId: string; clientMessageId: string; body: string }): { messages: ChatMessage[]; message: ChatMessage; duplicate: boolean } };
