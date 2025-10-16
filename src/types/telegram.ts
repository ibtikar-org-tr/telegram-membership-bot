export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface SendPhotoRequest {
  chat_id: number | string;
  photo: string | Blob;
  caption?: string;
  parse_mode?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface TelegramUserState {
  telegram_id: string;
  state: string;
  notes?: string;
  created_at: string;
  modified_at: string;
}