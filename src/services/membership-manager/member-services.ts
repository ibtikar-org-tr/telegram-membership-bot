import { TelegramService } from '../telegram';
import { MemberSheetServices } from './member-sheet-services';
import { Environment } from '../../types';
import { Member } from '../../types/membership-manager';

export async function sendMessageToMember(
  env: Environment, 
  member_id: string, 
  message: string, 
  boxes: Array<{ text: string, link: string }>, 
  photo?: string | Blob,
  cachedMember?: Member | null // Optional: pass cached member to avoid extra API calls
) {
  try {
    const telegramService = new TelegramService(env);

    // Use cached member if provided, otherwise fetch from Google Sheets
    let member: Member | null = cachedMember || null;
    
    if (!member) {
      const memberSheetServices = new MemberSheetServices(env);
      member = await memberSheetServices.getMemberByMembershipNumber(member_id);
    }

    if (!member) {
      console.error('Member not found for ID:', member_id);
      return { error: 'Member not found' };
    }

    if (!member.telegram_id) {
      return { error: 'Member has not registered for Telegram notifications' };
    }

    // Send message/photo with or without boxes
    if (photo) {
      // Send photo with caption
      if (boxes && Array.isArray(boxes) && boxes.length > 0) {
        // Validate boxes structure
        const validBoxes = boxes.filter(box => 
          box && typeof box.text === 'string' && typeof box.link === 'string'
        );
        
        if (validBoxes.length === 0) {
          return { error: 'Invalid boxes format. Each box must have text and link properties' };
        }

        await telegramService.sendPhotoWithBoxes(member.telegram_id, photo, message, validBoxes);
      } else {
        await telegramService.sendPhoto(member.telegram_id, photo, message);
      }
    } else {
      // Send text message
      if (boxes && Array.isArray(boxes) && boxes.length > 0) {
        // Validate boxes structure
        const validBoxes = boxes.filter(box => 
          box && typeof box.text === 'string' && typeof box.link === 'string'
        );
        
        if (validBoxes.length === 0) {
          return { error: 'Invalid boxes format. Each box must have text and link properties' };
        }

        await telegramService.sendMessageWithBoxes(member.telegram_id, message, validBoxes);
      } else {
        await telegramService.sendMessage(member.telegram_id, message);
      }
    }

    return { 
      success: true, 
      message: `Message sent to ${member.latin_name} (${member.membership_number})`,
      telegram_id: member.telegram_id
    };
  } catch (error) {
    console.error('Notify member error:', error);
    return { error: 'Internal server error' };
  }
};


