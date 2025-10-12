import { Environment, TelegramUpdate, SendMessageRequest, InlineKeyboardButton, InlineKeyboardMarkup } from '../types';

export class TelegramService {
  private env: Environment;
  private botToken: string;

  constructor(env: Environment) {
    this.env = env;
    this.botToken = env.TELEGRAM_BOT_TOKEN;
  }

  async sendMessage(chatId: number | string, text: string, parseMode?: string, inlineKeyboard?: InlineKeyboardButton[][]): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    const payload: SendMessageRequest = {
      chat_id: chatId,
      text: text,
    };

    if (parseMode) {
      payload.parse_mode = parseMode;
    }

    if (inlineKeyboard && inlineKeyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${error}`);
    }
  }

  async sendBulkMessage(chatIds: (number | string)[], text: string, parseMode?: string): Promise<void> {
    const promises = chatIds.map(chatId => 
      this.sendMessage(chatId, text, parseMode).catch(error => {
        console.error(`Failed to send message to ${chatId}:`, error);
        return error;
      })
    );

    await Promise.allSettled(promises);
  }

  async sendMessageWithBoxes(chatId: number | string, text: string, boxes: Array<{text: string, link: string}>, parseMode?: string): Promise<void> {
    // Create inline keyboard from boxes
    const inlineKeyboard: InlineKeyboardButton[][] = boxes.map(box => [
      {
        text: box.text,
        url: box.link
      }
    ]);

    await this.sendMessage(chatId, text, parseMode, inlineKeyboard);
  }

  async setWebhook(webhookUrl: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/setWebhook`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to set webhook: ${response.status} ${error}`);
    }
  }
}