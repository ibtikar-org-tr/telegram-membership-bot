export interface Environment {
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

export interface GoogleSheetIndex {
  membership_number: number;
  ar_name: number;
  latin_name: number;
  whatsapp: number;
  email: number;
  sex: number;
  password: number;
  phone: number;
  telegram_id: number;
  telegram_username: number;
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

export interface SendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: string;
}