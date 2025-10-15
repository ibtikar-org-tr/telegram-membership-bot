import { Hono } from 'hono';
import { Environment, TelegramUpdate } from '../types';
import { MemberSheetServices } from '../services/membership-manager/member-sheet-services';
import { TelegramService } from '../services/telegram';
import { EmailService } from '../services/email';
import { TelegramUserStateService } from '../crud/membership-manager/telegram-user-state';
import { AllMessagesPrivateCrud } from '../crud/all-messages-private';
import { D1DatabaseConnection } from '../crud/database';
import { escapeMarkdownV2 } from '../utils/helpers';

const telegram = new Hono<{ Bindings: Environment }>();

// Helper function to generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    // Store all received messages in database
    try {
      const db = new D1DatabaseConnection(c.env.DB);
      const messagesCrud = new AllMessagesPrivateCrud(db);
      await messagesCrud.storeMessage(update.message);
    } catch (storageError) {
      // Log error but don't fail the request - message processing should continue
      console.error('Failed to store message:', storageError);
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
          `You are already registered with membership number ${existingMember.membership_number}\n\nName: ${escapeMarkdownV2(existingMember.latin_name)}\n\nUse /help to see available commands`
        );
        return c.json({ ok: true });
      } else {
        // New user - set state to wait for membership number
        await userStateService.setUserState(telegramId.toString(), 'waiting_membership_number');
        await telegramService.sendMessage(
          telegramId,
          `Please provide your membership number to verify your membership`
        );
        return c.json({ ok: true });
      }
    }

    // Handle /help command
    if (text === '/help') {
      await telegramService.sendHelpMessage(telegramId);
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
        // Normal state - show help menu for any text
        await telegramService.sendHelpMessage(telegramId);
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
      'Membership number not found in our database, Please check your membership number and try again, or contact support,\n\nUse /help for available commands'
    );
    // Clear state so user can try again or use other commands
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if member has an email address
  if (!member.email) {
    await telegramService.sendMessage(
      telegramId,
      'No email address found for this membership, Please contact support to update your email address'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered
  const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'This Telegram account is already registered, Please contact your admin if you need assistance'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this membership number is already linked to another Telegram account
  if (member.telegram_id && member.telegram_id !== telegramId.toString()) {
    await telegramService.sendMessage(
      telegramId,
      'This membership number is already registered with another Telegram account, If you believe this is an error, please contact support for assistance'
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
    `Verification email has been sent to ${escapeMarkdownV2(maskedEmail)}\n\nYou can either:\n1\\. Enter the 6\\-digit code from the email here in the chat\n2\\. Click the verification link in the email\n\nThe code will expire in 10 minutes`
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
      'Verification session expired or not found\\. Please use /verify to start again'
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
      'Invalid verification code\\. Please check and try again, or use the link from your email\n\nUse /verify to request a new code'
    );
    // Don't clear state - let user try again or wait for timeout
    return;
  }

  // Code is correct - proceed with verification
  const member = await memberSheetServices.getMemberByMembershipNumber(membershipNumber);
  
  if (!member) {
    await telegramService.sendMessage(
      telegramId,
      'Member not found\\. Please contact support'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered to any user
  const existingMember = await memberSheetServices.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'This Telegram account is already registered\\. Please contact your admin'
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
    `✅ Verification successful\\!\n\nYou are now registered to receive messages from our organization\\.\n\nYour membership: ${escapeMarkdownV2(member.latin_name)} \\- ${escapeMarkdownV2(membershipNumber)}\n\nUse /help to see available commands`
  );
}

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
    const userStateService = new TelegramUserStateService(c.env);

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

    // Clear any existing user state since they're now registered
    await userStateService.clearUserState(telegramId);

    // Send confirmation message
    await telegramService.sendMessage(
      parseInt(telegramId),
      `Verification successful, You are now registered to receive messages from our organization,\n\nYour membership: ${escapeMarkdownV2(member.latin_name)} , ${escapeMarkdownV2(membershipNumber)}\n\nUse /help to see available commands`
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