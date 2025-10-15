import { Hono } from 'hono';
import { Environment } from '../types';
import { MemberSheetServices } from '../services/membership-manager/member-sheet-services';
import { TelegramService } from '../services/telegram';
import { authMiddleware } from '../middleware/auth';
import { sendMessageToMember } from '../services/membership-manager/member-services';
import { escapeMarkdownV2 } from '../utils/helpers';

const api = new Hono<{ Bindings: Environment }>();

// Apply auth middleware to all API routes
api.use('*', authMiddleware);

api.post('/send-message', async (c) => {
  try {
    const { message, target } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    const telegramService = new TelegramService(c.env);
    const memberSheetServices = new MemberSheetServices(c.env);

    if (target === 'all') {
      // Send to all members with telegram_id
      const members = await memberSheetServices.getMembers();
      const telegramIds = members
        .filter(member => member.telegram_id)
        .map(member => member.telegram_id);

      if (telegramIds.length === 0) {
        return c.json({ error: 'No members with Telegram IDs found' }, 404);
      }

      await telegramService.sendBulkMessage(telegramIds, message);
      
      return c.json({ 
        success: true, 
        message: `Message sent to ${telegramIds.length} members` 
      });
    } else if (target) {
      // Send to specific member by membership number or email
      let member = await memberSheetServices.getMemberByMembershipNumber(target);
      
      if (!member) {
        member = await memberSheetServices.getMemberByEmail(target);
      }

      if (!member) {
        return c.json({ error: 'Member not found' }, 404);
      }

      if (!member.telegram_id) {
        return c.json({ error: 'Member has not registered for Telegram notifications' }, 400);
      }

      await telegramService.sendMessage(member.telegram_id, message);
      
      return c.json({ 
        success: true, 
        message: `Message sent to ${member.latin_name}` 
      });
    } else {
      return c.json({ error: 'Target is required (use "all" for all members or specific membership number/email)' }, 400);
    }
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/notify-member', async (c) => {
  try {
    const { member_id, message, boxes } = await c.req.json();
    
    if (!member_id) {
      return c.json({ error: 'member_id is required' }, 400);
    }

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }
    
    const escapedMessage = escapeMarkdownV2(message);
    
    const result = await sendMessageToMember(c.env, member_id, escapedMessage, boxes);

    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ 
      success: true, 
      message: result.message,
      telegram_id: result.telegram_id
    });
  } catch (error) {
    console.error('Notify member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/webhook/setup', async (c) => {
  try {
    const telegramService = new TelegramService(c.env);
    const webhookUrl = `${c.env.BASE_URL}/telegram/webhook`;
    
    await telegramService.setWebhook(webhookUrl);
    
    return c.json({ 
      success: true, 
      message: 'Webhook setup successfully',
      webhook_url: webhookUrl 
    });
  } catch (error) {
    console.error('Webhook setup error:', error);
    return c.json({ error: 'Failed to setup webhook' }, 500);
  }
});

export default api;