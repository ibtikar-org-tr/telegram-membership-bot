import { Hono } from 'hono';
import { Environment } from '../types';
import { GoogleSheetsService } from '../services/google-sheets';
import { TelegramService } from '../services/telegram';
import { authMiddleware } from '../middleware/auth';

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
    const googleSheetsService = new GoogleSheetsService(c.env);

    if (target === 'all') {
      // Send to all members with telegram_id
      const members = await googleSheetsService.getMembers();
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
      let member = await googleSheetsService.getMemberByMembershipNumber(target);
      
      if (!member) {
        member = await googleSheetsService.getMemberByEmail(target);
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

    const telegramService = new TelegramService(c.env);
    const googleSheetsService = new GoogleSheetsService(c.env);

    // Search for member by membership number (assuming member_id refers to membership_number)
    const member = await googleSheetsService.getMemberByMembershipNumber(member_id);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    if (!member.telegram_id) {
      return c.json({ error: 'Member has not registered for Telegram notifications' }, 400);
    }

    // Send message with or without boxes
    if (boxes && Array.isArray(boxes) && boxes.length > 0) {
      // Validate boxes structure
      const validBoxes = boxes.filter(box => 
        box && typeof box.text === 'string' && typeof box.link === 'string'
      );
      
      if (validBoxes.length === 0) {
        return c.json({ error: 'Invalid boxes format. Each box must have text and link properties' }, 400);
      }

      await telegramService.sendMessageWithBoxes(member.telegram_id, message, validBoxes);
    } else {
      await telegramService.sendMessage(member.telegram_id, message);
    }
    
    return c.json({ 
      success: true, 
      message: `Message sent to ${member.latin_name} (${member.membership_number})`,
      telegram_id: member.telegram_id
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