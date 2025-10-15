// Model for storing all private messages from users

export interface AllMessagesPrivate {
  id: string;
  message_json: string; // Stored as JSON string
  notes: string | null;
  created_at: string;
}

export interface AllMessagesPrivateModel {
  message_json: string;
  notes?: string | null;
}

// Helper type for the parsed message JSON
export type MessageData = any; // Can be customized to match Telegram message structure
