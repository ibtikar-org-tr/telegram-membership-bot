import { Hono } from 'hono';
import { Environment, TelegramUpdate } from '../types';
import { GoogleSheetsService } from '../services/google-sheets';
import { TelegramService } from '../services/telegram';
import { EmailService } from '../services/email';

const telegram = new Hono<{ Bindings: Environment }>();

telegram.post('/webhook', async (c) => {
  try {
    const update: TelegramUpdate = await c.req.json();
    
    if (!update.message) {
      return c.json({ ok: true });
    }

    const { message } = update;
    const telegramId = message.from.id;
    const username = message.from.username;
    const text = message.text || '';

    const telegramService = new TelegramService(c.env);
    const googleSheetsService = new GoogleSheetsService(c.env);
    const emailService = new EmailService(c.env);

    if (text === '/start') {
      await telegramService.sendMessage(
        telegramId,
        'Welcome! Please provide your email address to verify your membership.'
      );
    } else if (text.includes('@')) {
      // Assume it's an email address
      const email = text.trim();
      
      // Check if member exists in Google Sheets
      const member = await googleSheetsService.getMemberByEmail(email);
      
      if (!member) {
        await telegramService.sendMessage(
          telegramId,
          'Email not found in our membership database. Please contact support.'
        );
        return c.json({ ok: true });
      }

      // Check if this telegram_id is already registered
      const existingMember = await googleSheetsService.getMemberByTelegramId(telegramId.toString());
      if (existingMember) {
        await telegramService.sendMessage(
          telegramId,
          'User already exists, please contact your admin.'
        );
        return c.json({ ok: true });
      }

      // Create verification link with query parameters
      const verificationLink = `${c.env.BASE_URL}/telegram/verify?membership_number=${encodeURIComponent(member.membership_number)}&telegram_id=${telegramId}&telegram_username=${encodeURIComponent(username || '')}`;

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationLink);
      
      await telegramService.sendMessage(
        telegramId,
        'Verification email sent! Please check your email and click the verification link.'
      );
    } else {
      await telegramService.sendMessage(
        telegramId,
        'Please provide a valid email address or use /start to begin.'
      );
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

telegram.get('/verify', async (c) => {
  try {
    const membershipNumber = c.req.query('membership_number');
    const telegramId = c.req.query('telegram_id');
    const telegramUsername = c.req.query('telegram_username') || '';
    
    if (!membershipNumber || !telegramId) {
      return c.html('<h1>Invalid verification link</h1><p>Missing required parameters.</p>');
    }

    const googleSheetsService = new GoogleSheetsService(c.env);
    const telegramService = new TelegramService(c.env);

    // Check if the membership number exists
    const member = await googleSheetsService.getMemberByMembershipNumber(membershipNumber);
    if (!member) {
      return c.html('<h1>Verification Failed</h1><p>Member not found. Please contact support.</p>');
    }

    // Check if this telegram_id is already registered to any user
    const existingMember = await googleSheetsService.getMemberByTelegramId(telegramId);
    if (existingMember) {
      return c.html('<h1>User Already Exists</h1><p>This Telegram account is already registered. Please contact your admin.</p>');
    }

    // Update member with Telegram information
    await googleSheetsService.updateMember({
      membership_number: membershipNumber,
      telegram_id: telegramId,
      telegram_username: telegramUsername
    });

    // Send confirmation message
    await telegramService.sendMessage(
      parseInt(telegramId),
      `Verification successful! You are now registered to receive messages from our organization.\n\nYour membership: ${member.latin_name} (${membershipNumber})`
    );

    return c.html(`
      <h1>Verification Successful!</h1>
      <p>Hello ${member.latin_name},</p>
      <p>Your Telegram account has been successfully linked to your membership (${membershipNumber}).</p>
      <p>You can now close this window and return to Telegram.</p>
    `);
  } catch (error) {
    console.error('Verification error:', error);
    return c.html('<h1>Verification Failed</h1><p>An error occurred during verification. Please try again or contact support.</p>');
  }
});

export default telegram;