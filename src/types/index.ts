export { MemberGoogleSheetIndex } from './membership-manager';
export { TelegramUpdate, InlineKeyboardButton, InlineKeyboardMarkup, SendMessageRequest, SendPhotoRequest, TelegramUserState } from './telegram';

export interface Environment {
  DB: D1Database;
  MEMBER_GOOGLE_SHEET_ID: string;
  MEMBER_GOOGLE_SHEET_PAGE_NAME: string;
  MEMBER_GOOGLE_SHEET_INDEX: string; // JSON string
  GOOGLE_API_KEY: string; // JSON string
  TELEGRAM_BOT_TOKEN: string;
  SECRET_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  BASE_URL: string;
  DEEPSEEK_API_KEY: string;
  AI: any; // Cloudflare AI binding
  MAIN_CHANNEL: string; // Main Telegram channel username (without @)
}
