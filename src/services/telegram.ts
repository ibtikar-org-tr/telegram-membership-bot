import { Environment, TelegramUpdate, SendMessageRequest, SendPhotoRequest, InlineKeyboardButton, InlineKeyboardMarkup } from '../types';
// import { escapeMarkdownV2 } from '../utils/helpers';

export class TelegramService {
  private env: Environment;
  private botToken: string;

  constructor(env: Environment) {
    this.env = env;
    this.botToken = env.TELEGRAM_BOT_TOKEN;
  }

  async sendMessage(chatId: number | string, text: string, parseMode?: string, inlineKeyboard?: InlineKeyboardButton[][]): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    console.log('Sending message to', chatId, 'with text:', text);
    let compatibleText = text;
    if (!parseMode) {
      parseMode = 'MarkdownV2'; // Default to MarkdownV2 if not specified
      // compatibleText = escapeMarkdownV2(text); Not a good idea, at least for now
    }
  
    const payload: SendMessageRequest = {
      chat_id: chatId,
      text: compatibleText,
      parse_mode: parseMode,
    };

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

  async sendPhoto(chatId: number | string, photo: string | Blob, caption?: string, parseMode?: string, inlineKeyboard?: InlineKeyboardButton[][]): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

    console.log('Sending photo to', chatId, 'with caption:', caption);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    
    if (typeof photo === 'string') {
      // Photo is a URL or file_id
      form.append('photo', photo);
    } else {
      // Photo is a Blob/File
      form.append('photo', photo, 'photo.jpg');
    }

    if (caption) {
      form.append('caption', caption);
      if (!parseMode) {
        parseMode = 'MarkdownV2'; // Default to MarkdownV2 if not specified
      }
      form.append('parse_mode', parseMode);
    }

    if (inlineKeyboard && inlineKeyboard.length > 0) {
      form.append('reply_markup', JSON.stringify({
        inline_keyboard: inlineKeyboard
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      body: form,
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

  async sendPhotoWithBoxes(chatId: number | string, photo: string | Blob, caption: string, boxes: Array<{text: string, link: string}>, parseMode?: string): Promise<void> {
    // Create inline keyboard from boxes
    const inlineKeyboard: InlineKeyboardButton[][] = boxes.map(box => [
      {
        text: box.text,
        url: box.link
      }
    ]);

    await this.sendPhoto(chatId, photo, caption, parseMode, inlineKeyboard);
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

  async sendHelpMessage(chatId: number | string): Promise<void> {
    const helpText = `
*Help Menu*

Welcome to our membership bot\\! Here are the available commands:

🔹 */start* \\- Begin registration or view registration status
🔹 */help* \\- Show this help menu

If you need assistance, please contact our support team\\.

_This bot is used for membership verification and notifications\\._
    `;

    await this.sendMessage(chatId, helpText.trim());
  }
}