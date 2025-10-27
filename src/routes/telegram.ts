import { Hono } from 'hono';
import { Environment, TelegramUpdate, InlineKeyboardButton } from '../types';
import { MemberSheetServices } from '../services/membership-manager/member-sheet-services';
import { TelegramService } from '../services/telegram';
import { EmailService } from '../services/email';
import { TelegramUserStateService } from '../crud/membership-manager/telegram-user-state';
import { AllMessagesPrivateCrud } from '../crud/all-messages-private';
import { AllMessagesGroupsCrud } from '../crud/all-messages-groups';
import { TaskCrud } from '../crud/task-follower/task';
import { D1DatabaseConnection } from '../crud/database';
import { escapeMarkdownV2 } from '../utils/helpers';
import LLMService from '../services/ai-services/deepseek';
import { AI_CONFIG } from '../utils/ai-config';
import { GroupServices } from '../services/group-services';
import { GroupMemberTrackingService } from '../services/group-member-tracking';
import { ShameService } from '../services/task-follower/shame-service';
import { handleChatJoinRequest } from '../services/membership-manager/chat-join-request-handler';

const telegram = new Hono<{ Bindings: Environment }>();

// Helper function to generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

telegram.post('/webhook', async (c) => {
  try {
    const update: TelegramUpdate = await c.req.json();
    
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const telegramId = callbackQuery.from.id;
      const username = callbackQuery.from.username;
      const callbackData = callbackQuery.data;
      const messageId = callbackQuery.message?.message_id;

      const telegramService = new TelegramService(c.env);
      const memberSheetServices = new MemberSheetServices(c.env);
      const userStateService = new TelegramUserStateService(c.env);

      // Handle "shame_" callback (shame button clicks)
      if (callbackData?.startsWith('shame_')) {
        const taskId = callbackData.replace('shame_', '');
        const db = new D1DatabaseConnection(c.env.DB);
        const shameService = new ShameService(db, c.env);

        const result = await shameService.handleShameButtonClick(taskId, telegramId.toString());

        // Answer the callback query with appropriate message
        await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: result.message.replace(/\\/g, ''), // Remove markdown escaping for alert
            show_alert: true
          })
        });

        return c.json({ ok: true });
      }

      // Handle "check_subscription" callback
      if (callbackData === 'check_subscription') {
        // Check if user is now subscribed
        const isSubscribed = await telegramService.checkChannelMembership(telegramId, c.env.MAIN_CHANNEL);
        
        if (isSubscribed) {
          // User is subscribed - proceed with verification
          await userStateService.setUserState(telegramId.toString(), 'waiting_membership_number');
          
          // Edit the message to remove buttons and show success
          if (messageId) {
            await telegramService.editMessage(
              telegramId,
              messageId,
              `✅ تم التحقق من اشتراكك بنجاح\\!\n\nالآن يرجى إدخال رقم العضوية للتحقق من عضويتك`
            );
          } else {
            await telegramService.sendMessage(
              telegramId,
              `✅ تم التحقق من اشتراكك بنجاح\\!\n\nالآن يرجى إدخال رقم العضوية للتحقق من عضويتك`
            );
          }

          // Answer the callback query
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '✅ تم التحقق من اشتراكك'
            })
          });
        } else {
          // User is still not subscribed
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ لم يتم العثور على اشتراك. يرجى الاشتراك في القناة أولاً',
              show_alert: true
            })
          });
        }
      }

      // Handle "join_group_" callback (group join requests)
      if (callbackData?.startsWith('join_group_')) {
        const chatId = callbackData.replace('join_group_', '');
        const db = new D1DatabaseConnection(c.env.DB);
        const { GroupsCrud } = await import('../crud/groups');
        const groupsCrud = new GroupsCrud(db);
        
        // Get group info
        const group = await groupsCrud.getGroupByChatId(chatId);
        
        if (!group) {
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ المجموعة غير موجودة',
              show_alert: true
            })
          });
          return c.json({ ok: true });
        }

        // Check if user is verified
        const member = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
        
        if (!member || !member.telegram_id) {
          // User is not verified
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ يجب عليك التحقق من عضويتك أولاً باستخدام /verify',
              show_alert: true
            })
          });
          return c.json({ ok: true });
        }

        // User is verified - create private invite link
        try {
          const fullName = member.latin_name || `${callbackQuery.from.first_name} ${callbackQuery.from.last_name || ''}`.trim();
          const inviteLink = await telegramService.createChatInviteLink(
            chatId,
            telegramId,
            fullName
          );
          
          if (inviteLink) {
            // Edit the message to show the invite link
            if (messageId) {
              await telegramService.editMessage(
                telegramId,
                messageId,
                `✅ *تم إنشاء رابط الانضمام\\!*\n\n` +
                `المجموعة: *${escapeMarkdownV2(group.title)}*\n\n` +
                `إليك رابط الانضمام الخاص بك:\n` +
                `${escapeMarkdownV2(inviteLink)}\n\n` +
                `⚠️ *ملاحظة مهمة:*\n` +
                `• هذا الرابط خاص بك فقط\n` +
                `• يمكن استخدامه مرة واحدة فقط\n` +
                `• لا تشاركه مع أي شخص آخر`
              );
            } else {
              await telegramService.sendMessage(
                telegramId,
                `✅ *تم إنشاء رابط الانضمام\\!*\n\n` +
                `المجموعة: *${escapeMarkdownV2(group.title)}*\n\n` +
                `إليك رابط الانضمام الخاص بك:\n` +
                `${escapeMarkdownV2(inviteLink)}\n\n` +
                `⚠️ *ملاحظة مهمة:*\n` +
                `• هذا الرابط خاص بك فقط\n` +
                `• يمكن استخدامه مرة واحدة فقط\n` +
                `• لا تشاركه مع أي شخص آخر`
              );
            }
            
            await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callback_query_id: callbackQuery.id,
                text: '✅ تم إنشاء رابط الانضمام'
              })
            });
          } else {
            // Failed to create invite link
            await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callback_query_id: callbackQuery.id,
                text: '❌ فشل إنشاء رابط الانضمام. يرجى المحاولة لاحقاً',
                show_alert: true
              })
            });
          }
        } catch (error) {
          console.error('Error creating invite link for group:', error);
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ حدث خطأ. يرجى المحاولة لاحقاً',
              show_alert: true
            })
          });
        }
        
        return c.json({ ok: true });
      }

      return c.json({ ok: true });
    }
    
    // Handle chat join requests
    if (update.chat_join_request) {
      return await handleChatJoinRequest(update, c);
    }
    
    if (!update.message) {
      return c.json({ ok: true });
    }

    const { message } = update;
    const telegramId = message.from.id;
    const username = message.from.username;
    const text = message.text || '';
    const chatType = message.chat.type; // 'private', 'group', 'supergroup', or 'channel'

    // Store all received messages in appropriate database table
    try {
      const db = new D1DatabaseConnection(c.env.DB);
      
      if (chatType === 'private') {
        // Store private messages
        const messagesCrud = new AllMessagesPrivateCrud(db);
        await messagesCrud.storeMessage(update.message);
      } else if (chatType === 'group' || chatType === 'supergroup') {
        // Store group messages
        const groupMessagesCrud = new AllMessagesGroupsCrud(db);
        await groupMessagesCrud.storeMessage(update.message);
        
        // Track member changes
        const memberTrackingService = new GroupMemberTrackingService(db);
        await memberTrackingService.processMessage(update.message);
      }
    } catch (storageError) {
      // Log error but don't fail the request - message processing should continue
      console.error('Failed to store message:', storageError);
    }

    // Handle group-specific commands
    if (chatType !== 'private') {
      // Handle /summarize command in groups
      if (text.startsWith('/summarize')) {
        const groupServices = new GroupServices(c.env);
        // Pass message_thread_id if present (for forum topics)
        const messageThreadId = message.message_thread_id;
        const commandMessageId = message.message_id;
        await groupServices.handleSummarizeCommand(message.chat.id, text, messageThreadId, commandMessageId);
        return c.json({ ok: true });
      }
      
      // For other group messages, we just store them and return
      return c.json({ ok: true });
    }

    const telegramService = new TelegramService(c.env);
    const memberSheetServices = new MemberSheetServices(c.env);
    const emailService = new EmailService(c.env);
    const userStateService = new TelegramUserStateService(c.env);

    // Helper function to mask email for privacy
    const maskEmail = (email: string): string => {
      if (!email || !email.includes('@')) {
        return email;
      }
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 3) {
        return `${localPart[0]}****${localPart[localPart.length - 1]}@${domain}`;
      }
      const maskedLocal = `${localPart.slice(0, 3)}****${localPart.slice(-2)}`;
      return `${maskedLocal}@${domain}`;
    };

    // Handle /start command
    if (text === '/start') {
      await telegramService.sendWelcomeMessage(telegramId);
      return c.json({ ok: true });
    }

    // Handle /verify command
    if (text === '/verify') {
      // Check if user is already registered
      const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
      
      if (existingMember) {
        // User is already registered
        await userStateService.clearUserState(telegramId.toString());
        await telegramService.sendMessage(
          telegramId,
          `أنت مسجل بالفعل برقم العضوية ${existingMember.membership_number}\n\nالاسم: ${escapeMarkdownV2(existingMember.latin_name)}\n\nاستخدم /help لعرض الأوامر المتاحة`
        );
        return c.json({ ok: true });
      }

      // Check if user is subscribed to the main channel
      const isSubscribed = await telegramService.checkChannelMembership(telegramId, c.env.MAIN_CHANNEL);
      
      if (!isSubscribed) {
        // User is not subscribed - send message with channel link
        const channelLink = `https://t.me/${c.env.MAIN_CHANNEL}`;
        const subscribeButton: InlineKeyboardButton[][] = [
          [
            {
              text: '📢 اشترك في القناة',
              url: channelLink
            }
          ],
          [
            {
              text: '✅ تحققت من الاشتراك',
              callback_data: 'check_subscription'
            }
          ]
        ];

        await telegramService.sendMessage(
          telegramId,
          `للتحقق من عضويتك، يجب عليك أولاً الاشتراك في قناتنا الرسمية:\n\n${escapeMarkdownV2(channelLink)}\n\nبعد الاشتراك، اضغط على الزر أدناه للمتابعة`,
          'MarkdownV2',
          subscribeButton
        );
        return c.json({ ok: true });
      }

      // User is subscribed - proceed with verification
      // New user - set state to wait for membership number
      await userStateService.setUserState(telegramId.toString(), 'waiting_membership_number');
      await telegramService.sendMessage(
        telegramId,
        `يرجى إدخال رقم العضوية للتحقق من عضويتك`
      );
      return c.json({ ok: true });
    }

    // Handle /help command
    if (text === '/help') {
      await telegramService.sendHelpMessage(telegramId);
      return c.json({ ok: true });
    }

    // Handle /info command - show membership information
    if (text === '/info' || text === '/myinfo' || text === '/iforgot') {
      const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
      
      if (!existingMember) {
        await telegramService.sendMessage(
          telegramId,
          'لم يتم العثور على معلومات العضوية\\. يرجى استخدام /verify لتسجيل حسابك'
        );
        return c.json({ ok: true });
      }

      // Build membership info message
      const infoText = `
*معلومات العضوية* 📋

🆔 *رقم العضوية:* ${escapeMarkdownV2(existingMember.membership_number)}
👤 *الاسم بالعربية:* ${escapeMarkdownV2(existingMember.ar_name || 'غير متوفر')}
👤 *الاسم اللاتيني:* ${escapeMarkdownV2(existingMember.latin_name || 'غير متوفر')}
📧 *البريد الإلكتروني:* ${escapeMarkdownV2(existingMember.email || 'غير متوفر')}
📱 *الهاتف:* ${escapeMarkdownV2(existingMember.phone || 'غير متوفر')}
💬 *واتساب:* ${escapeMarkdownV2(existingMember.whatsapp || 'غير متوفر')}

_هذه المعلومات مسجلة في نظامنا\\._
      `.trim();

      await telegramService.sendMessage(telegramId, infoText);
      return c.json({ ok: true });
    }

    // Handle /groups command - show available groups
    if (text === '/groups') {
      const db = new D1DatabaseConnection(c.env.DB);
      const { GroupsCrud } = await import('../crud/groups');
      const groupsCrud = new GroupsCrud(db);
      
      // Get public groups (active and no admin approval needed)
      const publicGroups = await groupsCrud.getPublicGroups();
      
      if (publicGroups.length === 0) {
        await telegramService.sendMessage(
          telegramId,
          'لا توجد مجموعات متاحة حالياً\\. يرجى المحاولة لاحقاً\\.'
        );
        return c.json({ ok: true });
      }

      // Build groups list with inline keyboard
      let groupsText = '*المجموعات المتاحة* 🏢\n\n';
      groupsText += 'يمكنك طلب الانضمام إلى أي من المجموعات التالية:\n\n';
      
      const buttons: InlineKeyboardButton[][] = [];
      
      for (const group of publicGroups) {
        // Add group info to message
        const groupNumber = publicGroups.indexOf(group) + 1;
        groupsText += `*${groupNumber}\\. ${escapeMarkdownV2(group.title)}*\n`;
        
        if (group.description) {
          groupsText += `   ${escapeMarkdownV2(group.description)}\n`;
        }
        
        if (group.member_count) {
          groupsText += `   👥 ${group.member_count} عضو\n`;
        }
        
        groupsText += '\n';
        
        // Add button to request join
        // We'll use callback_data to handle the join request
        buttons.push([
          {
            text: `انضم إلى ${group.title}`,
            callback_data: `join_group_${group.chat_id}`
          }
        ]);
      }
      
      await telegramService.sendMessage(
        telegramId,
        groupsText.trim(),
        'MarkdownV2',
        buttons
      );
      
      return c.json({ ok: true });
    }

    // Get user's current state
    const currentState = await userStateService.getUserStateValue(telegramId.toString());

    // Handle based on current state
    switch (currentState) {
      case 'waiting_membership_number':
        // Process membership number
        await handleMembershipNumberInput(
          text.trim(),
          telegramId,
          username,
          memberSheetServices,
          emailService,
          telegramService,
          userStateService,
          maskEmail,
          c.env
        );
        break;

      case 'waiting_verification_code':
        // Process verification code
        await handleVerificationCodeInput(
          text.trim(),
          telegramId,
          username,
          memberSheetServices,
          telegramService,
          userStateService,
          c.env
        );
        break;

      case 'normal':
      default:
        // Normal state - handle with AI for non-command messages
        if (!text.startsWith('/')) {
          try {
            // Send "Thinking..."
            const thinkingMessageId = await telegramService.sendMessage(
              telegramId, 
              '_جارٍ التفكير\\.\\.\\._'
            );

            // Get today's conversation history for this user
            const db = new D1DatabaseConnection(c.env.DB);
            const messagesCrud = new AllMessagesPrivateCrud(db);
            const todaysConversation = await messagesCrud.getTodaysConversation(telegramId, 100);

            // Get recent tasks for this user (last 24 hours of activity)
            const taskCrud = new TaskCrud(db);
            const recentTasks = await taskCrud.getRecentTasksByTelegramId(telegramId.toString(), 20);

            const llmService = new LLMService(c.env);
            
            // Build conversation history with today's messages and task context
            let aiResponse: string;
            
            const conversationHistory: Array<{
              role: 'system' | 'user' | 'assistant';
              content: string;
            }> = [];

            // Build enhanced system prompt with task context
            let systemPrompt = AI_CONFIG;
            
            if (recentTasks.length > 0) {
              systemPrompt += '\n\n--- USER\'S RECENT TASKS (Last 24 hours) ---\n';
              systemPrompt += 'The user has the following recent tasks:\n\n';
              
              recentTasks.forEach((task, index) => {
                const roleText = task.owner_telegram_id === telegramId.toString() ? 'Owner' : 'Manager';
                systemPrompt += `${index + 1}. [${roleText}] ${task.taskText}\n`;
                systemPrompt += `   Project: ${task.projectName}\n`;
                systemPrompt += `   Status: ${task.status}\n`;
                systemPrompt += `   Priority: ${task.priority}\n`;
                if (task.dueDate) {
                  systemPrompt += `   Due Date: ${new Date(task.dueDate).toLocaleDateString()}\n`;
                }
                if (task.notes) {
                  systemPrompt += `   Notes: ${task.notes}\n`;
                }
                systemPrompt += '\n';
              });
              
              systemPrompt += 'Use this task information when the user asks about their tasks, deadlines, or work status.\n';
            }

            // Add system prompt first
            conversationHistory.push({
              role: 'system',
              content: systemPrompt
            });

            // Add today's conversation (if any)
            if (todaysConversation.length > 0) {
              for (const msg of todaysConversation) {
                // Skip command messages
                if (!msg.content.startsWith('/')) {
                  conversationHistory.push({
                    role: msg.role,
                    content: msg.content
                  });
                }
              }
            }

            // Add the current message if it's not already the last one
            const lastMessage = todaysConversation[todaysConversation.length - 1];
            if (!lastMessage || lastMessage.content !== text || lastMessage.role !== 'user') {
              conversationHistory.push({
                role: 'user',
                content: text
              });
            }

            // Use chatWithHistory if we have conversation context, otherwise use simple chat
            if (conversationHistory.length > 1) {
              aiResponse = await llmService.chatWithHistory(conversationHistory);
            } else {
              aiResponse = await llmService.chat(text, systemPrompt);
            }

            // Store the bot response for future conversation context
            await messagesCrud.storeBotResponse(telegramId, text, aiResponse);

            // Edit the "Thinking..." message with the AI response
            if (thinkingMessageId) {
              await telegramService.editMessage(
                telegramId,
                thinkingMessageId,
                escapeMarkdownV2(aiResponse)
              );
            } else {
              // Fallback: send as new message if editing fails
              await telegramService.sendMessage(telegramId, escapeMarkdownV2(aiResponse));
            }
          } catch (aiError) {
            console.error('AI error:', aiError);
            // Fallback to help message if AI fails
            await telegramService.sendHelpMessage(telegramId);
          }
        } else {
          // For unknown commands, show help menu
          await telegramService.sendHelpMessage(telegramId);
        }
        break;
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper function to handle membership number input
async function handleMembershipNumberInput(
  membershipNumber: string,
  telegramId: number,
  username: string | undefined,
  memberSheetServices: MemberSheetServices,
  emailService: EmailService,
  telegramService: TelegramService,
  userStateService: TelegramUserStateService,
  maskEmail: (email: string) => string,
  env: Environment
) {
  // Check if member exists in Google Sheets
  const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
  
  if (!member) {
    await telegramService.sendMessage(
      telegramId,
      'رقم العضوية غير موجود في قاعدة البيانات\\. يرجى التحقق من رقم عضويتك والمحاولة مرة أخرى\\، أو الاتصال بالدعم\\.\n\nاستخدم /help للأوامر المتاحة'
    );
    // Clear state so user can try again or use other commands
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if member has an email address
  if (!member.email) {
    await telegramService.sendMessage(
      telegramId,
      'لم يتم العثور على عنوان بريد إلكتروني لهذه العضوية\\. يرجى الاتصال بالدعم لتحديث عنوان بريدك الإلكتروني'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered
  const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'حساب تيليجرام هذا مسجل بالفعل\\. يرجى الاتصال بالمسؤول إذا كنت بحاجة إلى مساعدة'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this membership number is already linked to another Telegram account
  if (member.telegram_id && member.telegram_id !== telegramId.toString()) {
    await telegramService.sendMessage(
      telegramId,
      'رقم العضوية هذا مسجل بالفعل مع حساب تيليجرام آخر\\. إذا كنت تعتقد أن هذا خطأ\\، يرجى الاتصال بالدعم للحصول على المساعدة'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  
  // Store verification code and membership number in user state notes
  // Format: code|membership_number|username
  const stateData = `${verificationCode}|${member.membership_number}|${username || ''}`;
  await userStateService.setUserState(telegramId.toString(), 'waiting_verification_code', stateData);

  // Create verification link with query parameters
  const verificationLink = `${env.BASE_URL}/telegram/verify?membership_number=${encodeURIComponent(member.membership_number)}&telegram_id=${telegramId}&telegram_username=${encodeURIComponent(username || '')}`;

  // Send verification email with code
  await emailService.sendVerificationEmail(member.email, verificationLink, verificationCode);
  
  // Show masked email to user
  const maskedEmail = maskEmail(member.email);
  
  await telegramService.sendMessage(
    telegramId,
    `تم إرسال بريد التحقق إلى ${escapeMarkdownV2(maskedEmail)}\n\nيمكنك:\n1\\. إدخال الرمز المكون من 6 أرقام من البريد الإلكتروني هنا في المحادثة\n2\\. النقر على رابط التحقق في البريد الإلكتروني\n\nسينتهي صلاحية الرمز خلال 10 دقائق`
  );
}

// Helper function to handle verification code input
async function handleVerificationCodeInput(
  code: string,
  telegramId: number,
  username: string | undefined,
  memberSheetServices: MemberSheetServices,
  telegramService: TelegramService,
  userStateService: TelegramUserStateService,
  env: Environment
) {
  // Get the stored verification data from notes
  const stateNotes = await userStateService.getUserStateNotes(telegramId.toString());
  
  if (!stateNotes) {
    await telegramService.sendMessage(
      telegramId,
      'انتهت صلاحية جلسة التحقق أو لم يتم العثور عليها\\. يرجى استخدام /verify للبدء من جديد'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Parse stored data: code|membership_number|username
  const [storedCode, membershipNumber, storedUsername] = stateNotes.split('|');
  
  // Validate code
  if (code !== storedCode) {
    await telegramService.sendMessage(
      telegramId,
      'رمز التحقق غير صحيح\\. يرجى التحقق والمحاولة مرة أخرى\\، أو استخدام الرابط من بريدك الإلكتروني\n\nاستخدم /verify لطلب رمز جديد'
    );
    // Don't clear state - let user try again or wait for timeout
    return;
  }

  // Code is correct - proceed with verification
  const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
  
  if (!member) {
    await telegramService.sendMessage(
      telegramId,
      'لم يتم العثور على العضو\\. يرجى الاتصال بالدعم'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered to any user
  const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'حساب تيليجرام هذا مسجل بالفعل\\. يرجى الاتصال بالمسؤول'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Update member with Telegram information
  await memberSheetServices.updateMember({
    membership_number: membershipNumber,
    telegram_id: telegramId.toString(),
    telegram_username: username || storedUsername || ''
  });

  // Clear user state since they're now registered
  await userStateService.clearUserState(telegramId.toString());

  // Send confirmation message
  await telegramService.sendMessage(
    telegramId,
    `✅ تم التحقق بنجاح\\!\n\nأنت الآن مسجل لتلقي الرسائل من منظمتنا\\.\n\nعضويتك: ${escapeMarkdownV2(member.latin_name)} \\- ${escapeMarkdownV2(membershipNumber)}\n\nاستخدم /help لعرض الأوامر المتاحة`
  );
}

telegram.get('/verify', async (c) => {
  try {
    const membershipNumber = c.req.query('membership_number');
    const telegramId = c.req.query('telegram_id');
    const telegramUsername = c.req.query('telegram_username') || '';
    
    if (!membershipNumber || !telegramId) {
      return c.html('<h1>رابط تحقق غير صالح</h1><p>المعاملات المطلوبة مفقودة.</p>');
    }

    const memberSheetServices = new MemberSheetServices(c.env);
    const telegramService = new TelegramService(c.env);
    const userStateService = new TelegramUserStateService(c.env);

    // Check if the membership number exists
    const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
    if (!member) {
      return c.html('<h1>فشل التحقق</h1><p>لم يتم العثور على العضو. يرجى الاتصال بالدعم.</p>');
    }

    // Check if this telegram_id is already registered to any user
    const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId);
    if (existingMember) {
      return c.html('<h1>المستخدم موجود بالفعل</h1><p>حساب تيليجرام هذا مسجل بالفعل. يرجى الاتصال بالمسؤول.</p>');
    }

    // Update member with Telegram information
    await memberSheetServices.updateMember({
      membership_number: membershipNumber,
      telegram_id: telegramId,
      telegram_username: telegramUsername
    });

    // Clear any existing user state since they're now registered
    await userStateService.clearUserState(telegramId);

    // Send confirmation message
    await telegramService.sendMessage(
      parseInt(telegramId),
      `تم التحقق بنجاح\\. أنت الآن مسجل لتلقي الرسائل من منظمتنا\\.\n\nعضويتك: ${escapeMarkdownV2(member.latin_name)} \\، ${escapeMarkdownV2(membershipNumber)}\n\nاستخدم /help لعرض الأوامر المتاحة`
    );

    return c.html(`
      <h1>تم التحقق بنجاح!</h1>
      <p>مرحباً ${member.latin_name}،</p>
      <p>تم ربط حساب تيليجرام الخاص بك بعضويتك (${membershipNumber}) بنجاح.</p>
      <p>يمكنك الآن إغلاق هذه النافذة والعودة إلى تيليجرام.</p>
    `);
  } catch (error) {
    console.error('Verification error:', error);
    return c.html('<h1>فشل التحقق</h1><p>حدث خطأ أثناء التحقق. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.</p>');
  }
});

export default telegram;