// Model for storing all group messages

export interface AllMessagesGroups {
  id: string;
  message_json: string; // Stored as JSON string
  chat_id: string; // Telegram group/chat ID
  user_id: string; // Telegram user ID (sender)
  notes: string | null;
  created_at: string;
}

export interface AllMessagesGroupsModel {
  message_json: string;
  chat_id: string;
  user_id: string;
  notes?: string | null;
}

// Helper type for the parsed message JSON
export type GroupMessageData = any; // Can be customized to match Telegram message structure
