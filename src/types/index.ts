export interface Environment {
  DB: D1Database;
  GOOGLE_SHEET_ID: string;
  GOOGLE_SHEET_INDEX: string; // JSON string
  GOOGLE_API_KEY: string; // JSON string
  TELEGRAM_BOT_TOKEN: string;
  SECRET_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  BASE_URL: string;
}

export interface GoogleSheetIndex { // The main Google Sheet (members sheet)
  membership_number: number | string;
  ar_name: number | string;
  latin_name: number | string;
  whatsapp: number | string;
  email: number | string;
  sex: number | string;
  password: number | string;
  phone: number | string;
  telegram_id: number | string;
  telegram_username: number | string;
}

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