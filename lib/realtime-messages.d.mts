export type RealtimeMessageRecord = {
  id: string;
  created_at: string;
  [key: string]: unknown;
};
export function mergeRealtimeMessage<T extends RealtimeMessageRecord>(
  messages: T[], incoming: T, limit?: number
): T[];
