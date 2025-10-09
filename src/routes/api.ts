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

api.get('/members', async (c) => {
  try {
    const googleSheetsService = new GoogleSheetsService(c.env);
    const members = await googleSheetsService.getMembers();
    
    // Filter out sensitive information
    const publicMembers = members.map(member => ({
      membership_number: member.membership_number,
      latin_name: member.latin_name,
      ar_name: member.ar_name,
      email: member.email,
      telegram_id: member.telegram_id,
      telegram_username: member.telegram_username,
    }));
    
    return c.json({ members: publicMembers });
  } catch (error) {
    console.error('Get members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.get('/members/telegram', async (c) => {
  try {
    const googleSheetsService = new GoogleSheetsService(c.env);
    const members = await googleSheetsService.getMembers();
    
    // Only return members with Telegram IDs
    const telegramMembers = members
      .filter(member => member.telegram_id)
      .map(member => ({
        membership_number: member.membership_number,
        latin_name: member.latin_name,
        ar_name: member.ar_name,
        email: member.email,
        telegram_id: member.telegram_id,
        telegram_username: member.telegram_username,
      }));
    
    return c.json({ 
      members: telegramMembers,
      count: telegramMembers.length 
    });
  } catch (error) {
    console.error('Get telegram members error:', error);
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