import { Hono } from 'hono';
import { Environment, TelegramUpdate } from '../types';
import { MemberSheetServices } from '../services/membership-manager/member-sheet-services';
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
    const memberSheetServices = new MemberSheetServices(c.env);
    const emailService = new EmailService(c.env);

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

    if (text === '/start') {
      await telegramService.sendMessage(
        telegramId,
        'Welcome! Please provide your membership number to verify your membership.'
      );
    } else {
      // Assume it's a membership number
      const membershipNumber = text.trim();
      
      // Check if member exists in Google Sheets
      const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
      
      if (!member) {
        await telegramService.sendMessage(
          telegramId,
          'Membership number not found in our database. Please check your membership number and try again, or contact support.'
        );
        return c.json({ ok: true });
      }

      // Check if member has an email address
      if (!member.email) {
        await telegramService.sendMessage(
          telegramId,
          'No email address found for this membership. Please contact support to update your email address.'
        );
        return c.json({ ok: true });
      }

      // Check if this telegram_id is already registered
      const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
      if (existingMember) {
        await telegramService.sendMessage(
          telegramId,
          'This Telegram account is already registered. Please contact your admin if you need assistance.'
        );
        return c.json({ ok: true });
      }

      // Create verification link with query parameters
      const verificationLink = `${c.env.BASE_URL}/telegram/verify?membership_number=${encodeURIComponent(member.membership_number)}&telegram_id=${telegramId}&telegram_username=${encodeURIComponent(username || '')}`;

      // Send verification email
      await emailService.sendVerificationEmail(member.email, verificationLink);
      
      // Show masked email to user
      const maskedEmail = maskEmail(member.email);
      
      await telegramService.sendMessage(
        telegramId,
        `Verification email has been sent to ${maskedEmail}. Please check your email and click the verification link to complete the registration.`
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

    const memberSheetServices = new MemberSheetServices(c.env);
    const telegramService = new TelegramService(c.env);

    // Check if the membership number exists
    const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
    if (!member) {
      return c.html('<h1>Verification Failed</h1><p>Member not found. Please contact support.</p>');
    }

    // Check if this telegram_id is already registered to any user
    const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId);
    if (existingMember) {
      return c.html('<h1>User Already Exists</h1><p>This Telegram account is already registered. Please contact your admin.</p>');
    }

    // Update member with Telegram information
    await memberSheetServices.updateMember({
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