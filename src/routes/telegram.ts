import { Hono } from 'hono';
import { Environment, TelegramUpdate } from '../types';
import { GoogleSheetsService } from '../services/google-sheets';
import { TelegramService } from '../services/telegram';
import { EmailService } from '../services/email';
import { generateVerificationCode } from '../utils/helpers';

const telegram = new Hono<{ Bindings: Environment }>();

// Store verification codes temporarily (in production, use a more persistent solution)
const verificationCodes = new Map<string, { email: string, telegramId: number, username?: string }>();

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

      // Generate verification code
      const verificationCode = generateVerificationCode();
      verificationCodes.set(verificationCode, {
        email,
        telegramId,
        username
      });

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationCode);
      
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
    const verificationCode = c.req.query('code');
    
    if (!verificationCode || !verificationCodes.has(verificationCode)) {
      return c.html('<h1>Invalid or expired verification code</h1>');
    }

    const verificationData = verificationCodes.get(verificationCode)!;
    const googleSheetsService = new GoogleSheetsService(c.env);
    const telegramService = new TelegramService(c.env);

    // Update member with Telegram information
    await googleSheetsService.updateMember({
      membership_number: '', // We'll need to get this from the member data
      telegram_id: verificationData.telegramId.toString(),
      telegram_username: verificationData.username || ''
    });

    // Get member to find membership number
    const member = await googleSheetsService.getMemberByEmail(verificationData.email);
    if (member) {
      await googleSheetsService.updateMember({
        membership_number: member.membership_number,
        telegram_id: verificationData.telegramId.toString(),
        telegram_username: verificationData.username || ''
      });
    }

    // Send confirmation message
    await telegramService.sendMessage(
      verificationData.telegramId,
      'Verification successful! You are now registered to receive messages from our organization.'
    );

    // Remove verification code
    verificationCodes.delete(verificationCode);

    return c.html('<h1>Verification Successful!</h1><p>You can now close this window and return to Telegram.</p>');
  } catch (error) {
    console.error('Verification error:', error);
    return c.html('<h1>Verification Failed</h1><p>Please try again or contact support.</p>');
  }
});

export default telegram;