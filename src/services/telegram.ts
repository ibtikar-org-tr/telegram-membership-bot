import { Environment, TelegramUpdate, SendMessageRequest, SendPhotoRequest, InlineKeyboardButton, InlineKeyboardMarkup } from '../types';
// import { escapeMarkdownV2 } from '../utils/helpers';

export class TelegramService {
  private env: Environment;
  private botToken: string;

  constructor(env: Environment) {
    this.env = env;
    this.botToken = env.TELEGRAM_BOT_TOKEN;
  }

  async sendMessage(
    chatId: number | string, 
    text: string, 
    parseMode?: string, 
    inlineKeyboard?: InlineKeyboardButton[][],
    messageThreadId?: number,
    replyToMessageId?: number,
    disableNotification?: boolean
  ): Promise<number | undefined> {
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

    // Add message_thread_id if provided (for forum topics)
    if (messageThreadId !== undefined) {
      payload.message_thread_id = messageThreadId;
    }

    // Add reply_to_message_id if provided (to reply to a specific message)
    if (replyToMessageId !== undefined) {
      payload.reply_to_message_id = replyToMessageId;
    }

    // Add disable_notification if provided (for silent messages)
    if (disableNotification !== undefined) {
      payload.disable_notification = disableNotification;
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

    const result = await response.json() as { result?: { message_id?: number } };
    return result.result?.message_id;
  }

  async editMessage(
    chatId: number | string, 
    messageId: number, 
    text: string, 
    parseMode?: string, 
    inlineKeyboard?: InlineKeyboardButton[][],
    messageThreadId?: number
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;

    console.log('Editing message', messageId, 'in chat', chatId);
    let compatibleText = text;
    if (!parseMode) {
      parseMode = 'MarkdownV2'; // Default to MarkdownV2 if not specified
    }
  
    const payload: any = {
      chat_id: chatId,
      message_id: messageId,
      text: compatibleText,
      parse_mode: parseMode,
    };

    if (inlineKeyboard && inlineKeyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    // Add message_thread_id if provided (for forum topics)
    if (messageThreadId !== undefined) {
      payload.message_thread_id = messageThreadId;
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

  async sendDocument(chatId: number | string, document: string | Blob, caption?: string, parseMode?: string, filename?: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;

    console.log('Sending document to', chatId, 'with caption:', caption);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    
    if (typeof document === 'string') {
      // Document is a URL or file_id
      form.append('document', document);
    } else {
      // Document is a Blob/File
      form.append('document', document, filename || 'document');
    }

    if (caption) {
      form.append('caption', caption);
      if (!parseMode) {
        parseMode = 'MarkdownV2'; // Default to MarkdownV2 if not specified
      }
      form.append('parse_mode', parseMode);
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

  async sendBulkPhoto(chatIds: (number | string)[], photo: string | Blob, caption?: string, parseMode?: string): Promise<void> {
    const promises = chatIds.map(chatId => 
      this.sendPhoto(chatId, photo, caption, parseMode).catch(error => {
        console.error(`Failed to send photo to ${chatId}:`, error);
        return error;
      })
    );

    await Promise.allSettled(promises);
  }

  async sendBulkDocument(chatIds: (number | string)[], document: string | Blob, caption?: string, parseMode?: string, filename?: string): Promise<void> {
    const promises = chatIds.map(chatId => 
      this.sendDocument(chatId, document, caption, parseMode, filename).catch(error => {
        console.error(`Failed to send document to ${chatId}:`, error);
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
        allowed_updates: [
          'message',
          'callback_query',
          'chat_join_request'
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to set webhook: ${response.status} ${error}`);
    }
  }

  async checkChannelMembership(userId: number, channelUsername: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/getChatMember`;
    
    // Add @ prefix if not present
    const formattedChannel = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: formattedChannel,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to check channel membership: ${response.status}`);
        return false;
      }

      const result = await response.json() as { 
        ok: boolean; 
        result?: { 
          status: string;
        } 
      };

      // User is a member if status is: creator, administrator, member
      // User is NOT a member if status is: left, kicked
      const memberStatuses = ['creator', 'administrator', 'member'];
      return result.ok && result.result ? memberStatuses.includes(result.result.status) : false;
    } catch (error) {
      console.error('Error checking channel membership:', error);
      return false;
    }
  }

  async getChat(chatId: number | string): Promise<any> {
    const url = `https://api.telegram.org/bot${this.botToken}/getChat`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get chat info: ${response.status} ${error}`);
      }

      const result = await response.json() as { ok: boolean; result?: any };
      return result.result;
    } catch (error) {
      console.error('Error getting chat info:', error);
      throw error;
    }
  }

  async getChatAdministrators(chatId: number | string): Promise<any[]> {
    const url = `https://api.telegram.org/bot${this.botToken}/getChatAdministrators`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get chat administrators: ${response.status} ${error}`);
      }

      const result = await response.json() as { ok: boolean; result?: any[] };
      return result.result || [];
    } catch (error) {
      console.error('Error getting chat administrators:', error);
      throw error;
    }
  }

  async getChatMemberCount(chatId: number | string): Promise<number> {
    const url = `https://api.telegram.org/bot${this.botToken}/getChatMemberCount`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get chat member count: ${response.status} ${error}`);
      }

      const result = await response.json() as { ok: boolean; result?: number };
      return result.result || 0;
    } catch (error) {
      console.error('Error getting chat member count:', error);
      return 0;
    }
  }

  async sendHelpMessage(chatId: number | string): Promise<void> {
    const helpText = `
*قائمة المساعدة*

مرحباً بك في بوت العضوية لدينا\\! إليك الأوامر المتاحة:

🔹 */start* \\- عرض رسالة الترحيب ومعلومات السياسة
🔹 */verify* \\- بدء عملية التحقق من العضوية
🔹 */myinfo* \\- عرض معلومات عضويتك
🔹 */groups* \\- عرض المجموعات المتاحة وطلب الانضمام
🔹 */help* \\- عرض قائمة المساعدة هذه

يمكنك طرح أسئلتك على هذا البوت كونه مرتبط بالذكاء الاصطناعي\\.
إذا كنت بحاجة إلى مساعدة أخرى\\، يرجى الاتصال بفريق الدعم لدينا\\.

_يُستخدم هذا البوت للتحقق من العضوية والإشعارات\\._
    `;

    await this.sendMessage(chatId, helpText.trim());
  }

  async sendWelcomeMessage(chatId: number | string): Promise<void> {
    const welcomeText = `
*مرحباً بك في تجمّع إبتكار\\!* 🎉

شكراً لاهتمامك بالتواصل معنا عبر تيليجرام\\.

*حول هذا البوت*
تم تصميم هذا البوت للتحقق من عضويتك وإبقائك على اطلاع بالإشعارات والإعلانات المهمة من تجمّع إبتكار\\.

*إشعار الخصوصية*
• نقوم بجمع بيانات الاستخدام لتحسين أداء البوت وتجربة المستخدم\\.
• باستخدامك لهذا البوت، فإنك توافق على جمع بياناتك واستخدامها كما هو موضح في هذا الإشعار\\.
• لمعرفة المزيد حول سياسة الخصوصية الخاصة بنا، يرجى زيارة [موقعنا](https://ibtikar.org.tr) أو زيارة الكود مفتوح المصدر على [GitHub](https://github.com/ibtikar-org-tr/telegram-membership-bot) أو الاتصال بالدعم\\.

*كيفية البدء*
1\\. استخدم الأمر */verify* لبدء عملية التحقق
2\\. قدم رقم عضويتك
3\\. تحقق من بريدك الإلكتروني المسجل للحصول على رابط التحقق
4\\. انقر على الرابط لإكمال التحقق

*هل تحتاج إلى مساعدة؟*
استخدم الأمر */help* لعرض جميع الأوامر المتاحة\\.
يمكنك أيضاً طرح أسئلتك على هذا البوت كونه مرتبط بالذكاء الاصطناعي\\.
في حال نسيت بيانات العضوية يمكنك زيارة الرابط التالي: [استعادة بيانات العضوية](https://iforgot.ibtikar.tr)\\.

مرحباً بك على متن الطائرة\\! 🚀
    `;

    await this.sendMessage(chatId, welcomeText.trim());
  }

  async approveChatJoinRequest(chatId: number | string, userId: number): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/approveChatJoinRequest`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to approve chat join request: ${response.status} ${error}`);
      }

      console.log(`Approved chat join request for user ${userId} in chat ${chatId}`);
    } catch (error) {
      console.error('Error approving chat join request:', error);
      throw error;
    }
  }

  async declineChatJoinRequest(chatId: number | string, userId: number): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/declineChatJoinRequest`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to decline chat join request: ${response.status} ${error}`);
      }

      console.log(`Declined chat join request for user ${userId} in chat ${chatId}`);
    } catch (error) {
      console.error('Error declining chat join request:', error);
      throw error;
    }
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/deleteMessage`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to delete message: ${response.status} ${error}`);
        return false;
      }

      console.log(`Deleted message ${messageId} in chat ${chatId}`);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  async canSendMessageToUser(userId: number): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendChatAction`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: userId,
          action: 'typing',
        }),
      });

      // If we can send a chat action, the user has started the bot
      return response.ok;
    } catch (error) {
      console.error('Error checking if user has bot activated:', error);
      return false;
    }
  }

  async createChatInviteLink(
    chatId: number | string,
    userId: number,
    userName?: string
  ): Promise<string | null> {
    const url = `https://api.telegram.org/bot${this.botToken}/createChatInviteLink`;
    
    try {
      // Create an invite link that:
      // 1. Can only be used once (member_limit: 1)
      // 2. Is named after the user for tracking
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          name: userName ? `Link for ${userName}` : `Link for user ${userId}`,
          member_limit: 1, // Can only be used once
          creates_join_request: false // No join request needed, direct join
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create chat invite link: ${response.status} ${error}`);
        return null;
      }

      const result = await response.json() as { 
        ok: boolean; 
        result?: { 
          invite_link: string;
          name?: string;
          creator: any;
          creates_join_request: boolean;
          is_primary: boolean;
          is_revoked: boolean;
          member_limit?: number;
        } 
      };

      if (result.ok && result.result) {
        console.log(`Created private invite link for user ${userId}: ${result.result.invite_link}`);
        return result.result.invite_link;
      }

      return null;
    } catch (error) {
      console.error('Error creating chat invite link:', error);
      return null;
    }
  }
}